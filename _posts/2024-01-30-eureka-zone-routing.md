---
layout: post
title: "Eureka使用技巧： 服务间调用时，巧妙利用zone，指定要调用哪个实例"
date: 2024-01-30 21:21:00 +0800
description: "Spring Cloud架构下，我们在开发时，一般会搭建一个测试的Eureka Server，多个工程师的应用，都往这个Server进行注册。"
tags: [eureka, 微服务]
original_url: https://www.cnblogs.com/xushengbin/p/17988551
---
## 问题描述

Spring Cloud架构下，我们在开发时，一般会搭建一个测试的Eureka Server，多个工程师的应用，都往这个Server进行注册。  

现有有A、B两个service，A要调用B。  

B有两个实例，一个是我开发的，另外一个是张三同学开发的。  

我在B上新开发了几个接口，因此我就想让A只请求我开发的B服务。怎么办呢？

## 解决办法：

我在启动B服务时，增加配置：

```properties
eureka:
  client:
    service-url:
      defaultZone: http://xxx:12000/eureka
  instance:
    prefer-ip-address: true
    status-page-url-path: /swagger-ui.html
    metadata-map:
      zone: xushengbin
```

在metadata-map中增加zone标签，值就是我的名字。

我在启动A服务时，增加同样的zone标签（配置同上）。

这样，相当于我指定了，我开发的A、B两个服务都在同一个zone（机房的意思），而张三开发的B服务未指定机房。  

Spring Cloud是利用ribbon做负载均衡，A请求B时，ribbon会优先取同机房的实例（如果同机房没有可用实例，才会请求其他机房的实例）。  

因此呢，这样配置之后，A就之后请求我开发的B服务的实例。

A请求B时，我们看下日志信息：

```text
{NFLoadBalancer:name=entity,current list of Servers=[192.168.0.142:10011],Load balancer stats=Zone stats: {xushengbin=[Zone:xushengbin;	Instance count:1;	Active connections count: 0;	Circuit breaker tripped count: 0;	Active connections per server: 0.0;]
},Server stats: [[Server:192.168.0.142:10011;	Zone:xushengbin;	Total Requests:0;	Successive connection failure:0;	Total blackout seconds:0;	Last connection made:Thu Jan 01 08:00:00 CST 1970;	First connection made: Thu Jan 01 08:00:00 CST 1970;	Active Connections:0;	total failure count in last (1000) msecs:0;	average resp time:0.0;	90 percentile resp time:0.0;	95 percentile resp time:0.0;	min resp time:0.0;	max resp time:0.0;	stddev resp time:0.0]
]}
```

获取到的server list，只包含zone为xushengbin的实例（不包含张三同学的实例）。

此时，如果我停掉我开发的B服务的实例，B服务只剩下张三的实例，看下日志：

```text
{NFLoadBalancer:name=entity,current list of Servers=[192.168.0.110:10001],Load balancer stats=Zone stats: {defaultzone=[Zone:defaultzone;	Instance count:1;	Active connections count: 0;	Circuit breaker tripped count: 0;	Active connections per server: 0.0;]
},Server stats: [[Server:192.168.0.110:10001;	Zone:defaultZone;	Total Requests:0;	Successive connection failure:0;	Total blackout seconds:0;	Last connection made:Thu Jan 01 08:00:00 CST 1970;	First connection made: Thu Jan 01 08:00:00 CST 1970;	Active Connections:0;	total failure count in last (1000) msecs:0;	average resp time:0.0;	90 percentile resp time:0.0;	95 percentile resp time:0.0;	min resp time:0.0;	max resp time:0.0;	stddev resp time:0.0]
]}
```

此时返回的就是defaultzone的实例，也就是张三同学的实例。

## 总结

用好Eureka提供的zone、region功能，用处很大。

![image](/assets/images/posts/eureka-zone-routing/img-01.png)

目前能想到的场景：

1、搭建Spring Cloud测试环境时，如果要在测试环境部署所有的service，代价可能比较大。这时候就可以采取这样的路由策略：

如果一个service在测试环境有可用实例，就访问它。如果没有，就访问生产环境的实例。

操作方法：

- 测试环境搭建单独的网关（zuul），标记
  zone:test
- 给所有测试环境的service标记
  zone:test
  假如流量是
  网关 -&gt; A -&gt; B
  ， 网关请求A时，会优先选择部署在test区域的A实例，A请求B时也会优先选择部署在test区域的B实例。

2、对于提供SaaS服务的公司，一些政府客户会要求私有化部署。如果所有服务都私有化部署的话，后期维护、更新成本会很高。这时候就可以偷懒一下，只对特定的几个服务进行私有化部署，其他未部署的服务让流量到公有云平台。（只是不成熟的设想，网络问题很难解决）

操作方式：

- 私有云、公有云分布部署一个Eureka Server，私有云Eureka作为公有云的Peer，也就是说，注册到公有云的服务，都会同步到私有云的注册中心。
  这时候，私有云的Java Service，在请求其他服务时，就会优先找私有云上部署的实例，找不到再请求公有云的实例。
