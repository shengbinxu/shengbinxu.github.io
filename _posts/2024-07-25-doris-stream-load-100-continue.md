---
layout: post
title: "doris stream load抱错：There is no 100-continue header"
date: 2024-07-25 13:42:00 +0800
description: "通过doris stream load http接口（请求的是FE地址，中间加了一层nginx反向代理），导入数据时，设置了Expect头，但是接口还是返回： “There is no 100-continue header”"
tags: [doris, 数据仓库]
original_url: https://www.cnblogs.com/xushengbin/p/18322832
---
## 问题描述

通过doris stream load http接口（请求的是FE地址，中间加了一层nginx反向代理），导入数据时，设置了Expect头，但是接口还是返回： “There is no 100-continue header”

## 排查方法

1、修改doris debug log level，能在log中看到请求信息

<https://doris.apache.org/docs/1.2/advanced/best-practice/debug-log/>

![image](/assets/images/posts/doris-stream-load-100-continue/img-01.png)

2、使用tcpdump在doris fe机器上抓包

```text
tcpdump tcp port 18030 -X -e  -vv -s 0
```

![image](/assets/images/posts/doris-stream-load-100-continue/img-02.png)

能清晰看到每一步的http header以及response信息。

类似于UI版本的wireshark。但是服务器上无法安装wireshark，tcpdump一定程度可以替代。

## 对Expect:100-continue的理解

先抓个包：

![image](/assets/images/posts/doris-stream-load-100-continue/img-03.png)

发送http请求，带上header: Expect:100-continue

服务器有两次响应，为啥：  

1511	34.305571	182.42.157.222	18030	192.168.0.59	56959	HTTP	91	HTTP/1.1 100 Continue  

1515	34.309376	182.42.157.222	18030	192.168.0.59	56959	HTTP/JSON	387	HTTP/1.1 200 OK , JSON (application/json)

---

**以下是CHATGPT的解释：**  

当客户端发送 HTTP 请求时，如果请求头中包含 `Expect: 100-continue`，则服务器在收到请求头后会先发送一个中间响应 `100 Continue`，以告知客户端可以继续发送请求体（通常是比较大的数据，比如文件上传）。

下面是这个过程的详细解释：

1. **客户端发送请求头：**  
   客户端首先发送 HTTP 请求头，并在其中包含 `Expect: 100-continue` 头。这样做的目的是在确认服务器愿意接收请求体之前，不立即发送请求体，避免浪费带宽。
2. **服务器响应 `100 Continue`：**  
   服务器在接收到请求头后，会进行初步检查。如果请求头没有问题且服务器准备好接收请求体，则会返回一个 `100 Continue` 响应。这是一个临时响应，表示客户端可以继续发送剩余的数据。
3. **客户端发送请求体：**  
   收到 `100 Continue` 响应后，客户端继续发送请求体的数据（如文件内容或较大的 JSON 数据）。
4. **服务器处理请求并返回最终响应：**  
   服务器在接收到完整的请求后，进行处理，并返回最终的响应。例如，处理完请求体中的数据后返回 `HTTP/1.1 200 OK` 以及 JSON 数据。

在你的捕获数据中：

1. 第一个响应（
   1511 34.305571
   ）是服务器返回的
   HTTP/1.1 100 Continue
   响应，表示服务器已经接收到请求头，客户端可以继续发送请求体。
2. 第二个响应（
   1515 34.309376
   ）是服务器在处理完请求体后返回的最终响应
   HTTP/1.1 200 OK
   ，其中包含了 JSON 数据。

这个机制的主要作用是提升网络传输效率，特别是在发送大文件时，避免在服务器不准备接收时浪费带宽。

---

**个人总结：**

1. 浏览器发起http请求，只传输header，不发送body
2. 服务器返回
   HTTP/1.1 100 Continue
   , 表明客户端可以继续发送请求体
3. 浏览器通过已经建立好的tcp通道继续发送请求体
4. 服务器响应200

## 解决方案

在nginx反向代理中加入` proxy_set_header Expect $http_expect;` doris不抱错了。

但是，疑问仍在： 难道nginx默认不会把Expect头传递给后端吗？

我用tcpdump抓包发现不管是否加入这一行配置，doris fe收到的请求中都会带上`Expect: 100-continue`,  实在是不明白结果为啥不一样。

问题解决了，但是原因还想不明白。
