---
layout: post
title: "往 netty Channel中写入字符串"
date: 2024-03-05 14:29:00 +0800
description: "上面是一个 netty client，在ClientHandler中写入数据："
tags: [netty, java]
original_url: https://www.cnblogs.com/xushengbin/p/18053987
---
示例代码：

```java
EventLoopGroup group = new NioEventLoopGroup();
 Bootstrap bootstrap = new Bootstrap();
            bootstrap.group(group)
                    .channel(NioSocketChannel.class)
                    .option(ChannelOption.SO_KEEPALIVE, true)
                    .handler(new ChannelInitializer<SocketChannel>() {
                        @Override
                        protected void initChannel(SocketChannel ch) {
                            // 添加你需要的ChannelHandler
                            ch.pipeline().addLast(new ClientHandler());
                        }
                    });
```

上面是一个 netty client，在ClientHandler中写入数据：

```java
class ClientHandler extends ChannelInboundHandlerAdapter {
   @Override
    public void channelActive(ChannelHandlerContext ctx) throws Exception {
        super.channelActive(ctx);
//        ChannelFuture channelFuture = ctx.writeAndFlush(Unpooled.copiedBuffer("Netty rocks!",
//                CharsetUtil.UTF_8));
        ChannelFuture channelFuture = ctx.writeAndFlush("nihao");
        channelFuture.addListener(f -> {
            if (f.isSuccess()) {
                System.out.println("write success");
            } else {
                System.err.println("failed to write");
                f.cause().printStackTrace();
            }
        });
    }
}
```

write了一个字符串“nihao”，这时候报错了：  

java.lang.UnsupportedOperationException: unsupported message type: String (expected: ByteBuf, FileRegion)

> <https://stackoverflow.com/questions/49396919/why-is-channelhandlercontext-writeandflush-not-processing-my-string>

不支持写入字符串类型。

参考上述链接，需要再增加一个StringEncoder handler就可以了。

```text
      ch.pipeline().addLast(new StringEncoder()).addLast(new ClientHandler());
```

![image](/assets/images/posts/netty-write-string-to-channel/img-01.png)

![image](/assets/images/posts/netty-write-string-to-channel/img-02.png)

参考这里关于handler执行顺序的解析，当执行出站操作时（这里的write，对应的就是出站事件），会执行StringEncoder handler（它是ChannelOutboundHandlerAdapter类型），会把字符串转换成byte数组。

```java
public class StringEncoder extends MessageToMessageEncoder<CharSequence> {
    private final Charset charset;

    public StringEncoder() {
        this(Charset.defaultCharset());
    }

    public StringEncoder(Charset charset) {
        this.charset = (Charset)ObjectUtil.checkNotNull(charset, "charset");
    }

    protected void encode(ChannelHandlerContext ctx, CharSequence msg, List<Object> out) throws Exception {
        if (msg.length() != 0) {
            out.add(ByteBufUtil.encodeString(ctx.alloc(), CharBuffer.wrap(msg), this.charset));
        }
    }
}
```

## 知识扩展

> There are two ways of sending messages in Netty. You can write directly to the Channel or write to a ChannelHandlerContext object associated with a ChannelHandler. The former approach causes the message to start from the tail of the ChannelPipeline, the latter causes the message to start from the next handler in the ChannelPipeline.
