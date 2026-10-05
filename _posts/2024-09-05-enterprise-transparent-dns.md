---
layout: post
title: "企业级无侵入式DNS方案"
date: 2024-09-05 09:06:00 +0800
description: "首先，应用ServiceA通过DNS查询获取到ServiceB的可用IP列表 2. DNS-F会拦截到ServiceA的查询请求，判断自己是否该查询的答案，如果有（服务已在VIPServer中注册）则直接返回IP列表；…"
tags: [网络, DNS]
original_url: https://www.cnblogs.com/xushengbin/p/18397675
---
## 参考资料

<https://blog.csdn.net/qq_36996635/article/details/126062991>

![image](/assets/images/posts/enterprise-transparent-dns/img-01.png)

1. 首先，应用ServiceA通过DNS查询获取到ServiceB的可用IP列表
2. DNS-F会拦截到ServiceA的查询请求，判断自己是否该查询的答案，如果有（服务已在VIPServer中注册）则直接返回IP列表；
3. 如果查询的服务在VIPServer中没有注册，DNS-F把DNS查询转发给系统的nameserver，由真正的DNS系统解析；

这个方案太方便了，需要有配套的软件发布设施来保障，小公司不太适用。

## 计划尝试的方案

<https://nacos.io/zh-cn/docs/v2/ecology/use-nacos-sync.html>  
 <https://nacos.io/zh-cn/docs/v2/ecology/use-nacos-with-coredns.html>

1、把eureka上的服务，同步到nacos  

2、利用nacos dns能力，像使用dns一样无侵入式实现服务发现。  
 `dig   $nacos_service_name   @$dns_ip   -p $dns_port `  

在机器上配置一个dns地址，就能实现。

3、利用nacos实现对mysql等服务的dns功能。类似于百度的BNS，服务会提供主动的健康检查功能。  
 <https://www.yuque.com/nacos/ebook/qrkw0g>
