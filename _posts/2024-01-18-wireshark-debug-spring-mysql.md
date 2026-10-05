---
layout: post
title: "wireshark实践 - 调试spring连接mysql失败问题"
date: 2024-01-18 21:47:00 +0800
description: "url格式写错了（两个jdbc），然后呢，在spring项目中查询mysql时，一直卡死，没有返回。"
tags: [wireshark, mysql]
original_url: https://www.cnblogs.com/xushengbin/p/17973489
---
## 问题描述

```properties
spring:
  datasource:
    driver-class-name: com.mysql.jdbc.Driver
    url:  jdbc:jdbc:mysql://122.224.147.xxx:90/dev?characterEncoding=utf8
    username: xxx
    password: xxx
    type: com.alibaba.druid.pool.DruidDataSource
```

url格式写错了（两个jdbc），然后呢，在spring项目中查询mysql时，一直卡死，没有返回。

刚开始没注意到配置文件格式错误了，于是用wireshark进行debug：

![image](/assets/images/posts/wireshark-debug-spring-mysql/img-01.webp)

![image](/assets/images/posts/wireshark-debug-spring-mysql/img-02.webp)

当我尝试用mysql协议解包时，提示我“解码器不完整”。

也就是说，jdbc向mysql server发请求时，用的不是mysql协议（正常是通过jdbc配置该告诉java，这是mysql还是pg。现在jdbc配置错了，所以用的协议也就错了）。

可以再验证下这个分析： 现在把jdbc配置改为pg，`jdbc:postgresql://122.224.147.xxx:90/dev?characterEncoding=utf8`，用pg协议去请求mysql server，看看会发生什么：  

报错和上面的截图一致。

接下来改为正确的jdbc配置请求mysql，看下报文：

![image](/assets/images/posts/wireshark-debug-spring-mysql/img-03.webp)

![image](/assets/images/posts/wireshark-debug-spring-mysql/img-04.webp)

1、三次握手成功之后，服务器主动告知自己的版本号等信息  

2、客户端发起登陆请求，把用户名、密码、db发送给server

## 总结

我们看到wireshark抓包对于排查问题真是一把利器。
