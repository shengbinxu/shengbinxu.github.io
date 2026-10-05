---
layout: post
title: "利用ssh隧道提升 feign 调用开发效率"
date: 2024-03-20 14:35:00 +0800
description: "spring cloud架构下，微服务间很多是通过 feign进行调用的。"
tags: [ssh, spring cloud]
original_url: https://www.cnblogs.com/xushengbin/p/18085170
---
## 问题描述

spring cloud架构下，微服务间很多是通过 feign进行调用的。  

作为一家小公司，很多微服务在开发环境没有部署实例，这就导致，想在本地做开发调试，要花精力起很多依赖服务。耗时费力。

## 解决办法

1、利用 ssh 隧道，让办公网可以访问测试环境（阿里云、默认不开放端口）的微服务。

```bash
ssh -f -N -g -L 127.0.0.1:9999:目标服务器 ip:10004 xushengbin@跳板机 IP
```

这样，通过本机的 9999 端口，就能访问到阿里云上部署的微服务（10004）了

> <https://www.cnblogs.com/f-ck-need-u/p/10482832.html>

2、指定feign地址为127.0.0.1:9999

```text
@FeignClient(value = "product", url = "http://127.0.0.1:9999")
public interface DeviceClient {
    @RequestMapping(
            value = {"queryDevices"},
            method = {RequestMethod.POST}
    )
    List<DeviceDto> queryDevices(@RequestBody QueryDeviceRequest var1);
}
```

这样已经挺好了。

但是，代码上线时，一定得记得去掉 url 参数。如果忘了怎么办？

现在可以自动解决这个问题：

```text
@FeignClient(value = "product", url = "#{'${product.listOfServers:}'}")
public interface DeviceClient {
    @RequestMapping(
            value = {"queryDevices"},
            method = {RequestMethod.POST}
    )
    List<DeviceDto> queryDevices(@RequestBody QueryDeviceRequest var1);
}
```

然后在application-test.yaml中指定配置：

```yaml
# 指定服务的 IP 地址和端口
product:
  listOfServers: http://127.0.0.1:9999
```

生产环境application-prod.yaml无需指定配置。  

这样，生产环境，url 的值是空字符，然后feign会自动从注册中心获取实例。  

测试环境，url 的值是<http://127.0.0.1:9999>     使用我们指定的地址。
