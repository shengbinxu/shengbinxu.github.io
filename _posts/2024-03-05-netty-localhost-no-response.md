---
layout: post
title: "netty client请求127.0.0.1:8081，server端无响应问题排查"
date: 2024-03-05 11:59:00 +0800
description: "client 和 server 建立链接之后，并发送报文："
tags: [netty, 线上排查]
original_url: https://www.cnblogs.com/xushengbin/p/18053651
---
## 问题描述

代码：<https://github.com/normanmaurer/netty-in-action/tree/2.0-SNAPSHOT/chapter2>  

利用netty，起了两个服务：  

echoServer，绑定 8081 端口。  

echoClient，请求 127.0.0.1:8081 端口。

client 和 server 建立链接之后，并发送报文：

```java
public class EchoClientHandler
    extends SimpleChannelInboundHandler<ByteBuf> {
    @Override
    public void channelActive(final ChannelHandlerContext ctx) {
        ChannelFuture channelFuture = ctx.writeAndFlush(Unpooled.copiedBuffer("Netty rocks!",
                CharsetUtil.UTF_8));
    }
}
```

此时echoServer却没有触发ChannelInboundHandlerAdapter::channelRead函数调用。

```java
public class EchoServerHandler extends ChannelInboundHandlerAdapter {
    @Override
    public void channelRead(ChannelHandlerContext ctx, Object msg) {
        ByteBuf in = (ByteBuf) msg;
        System.out.println(
                "Server received: " + in.toString(CharsetUtil.UTF_8));
        ctx.write(in);
    }
}
```

百思不得其解。

## 问题排查

![image](/assets/images/posts/netty-localhost-no-response/img-01.webp)

我的电脑上有两个进程在监听 8081 端口。

![image](/assets/images/posts/netty-localhost-no-response/img-02.webp)

- vscode，监听的是127.0.0.1:8081
- netty server监听的是\*.8081，也就是客户端请求任意一个网卡上的 8081 端口，都是达到这个地址

**知识点 1**： 同一个机器允许多个进程绑定同一个端口， 只要网卡不同就可以。

因此呢，我的netty client实际上请求的是 VsCode的系统进程。  

把netty client的 ip 改为本机 ip 就正常了。

**知识点2**：当同一台机器上同时存在127.0.0.1:8081、\*.8081两个server时，会优先匹配特定网卡上的 8081 进程，然后再匹配监听\*.8081的进程。

我们来验证下**知识点 2**：

还是上面的代码，分别起两个netty server，分别监听0.0.0.0:8081、127.0.0.1:8081:

![image](/assets/images/posts/netty-localhost-no-response/img-03.webp)

![image](/assets/images/posts/netty-localhost-no-response/img-04.webp)

第一步：netty client请求127.0.0.1:8081，监听了127.0.0.1:8081的server会收到请求。

第二步：netty client请求172.20.10.2 8081，监听了0.0.0.0:8081的 server 会收到请求

第三步：停掉监听了127.0.0.1:8081 的 server，netty client继续请求127.0.0.1:8081，此时监听了0.0.0.0:8081的 server 会收到请求
