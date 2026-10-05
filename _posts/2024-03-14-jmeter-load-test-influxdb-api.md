---
layout: post
title: "利用jmeter命令行模式对influxdb查询api进行压力测试"
date: 2024-03-14 16:51:00 +0800
description: "物联网指标数据（车辆的轨迹、里程、速度等）存储在influxDB中。需要对指标查询服务的性能做压力测试。"
tags: [jmeter, 压测]
original_url: https://www.cnblogs.com/xushengbin/p/18073183
---
## 需求说明

物联网指标数据（车辆的轨迹、里程、速度等）存储在influxDB中。需要对指标查询服务的性能做压力测试。

## 背景

1、java service已经对influxDB查询 sql 做了封装，api 参数如下：

```json
{
    "deviceIds" : ["14146284645"],
    "startTime": 1710259200000,
    "endTime":  1710432000000,
    "fieldName": "loc"
}
```

api 支持查询“一个设备在一段时间内某一个指标的值”

2、压测时，尽可能每一次请求查询都不同。  

我们有 1 万多个在线设备，压测时，要依次查询每一个设备的指标数据（而不是只对一个设备进行压测），避免数据库可能会对同一个 SQL 的查询结果进行缓存。这就要求压测工具支持在 HTTP 请求中添加变量。

3、要求所有的环节都在同一个局域网进行，避免因为网络带宽影响压测结果。  

jmeter -&gt; java service -&gt; influxdb 需要在同一个局域网

## 方案

### 1、在MAC上利用 jmeter图形界面，做相关配置。

![image](/assets/images/posts/jmeter-load-test-influxdb-api/img-01.webp)

- 并发数 30
- 循环 500 次，即一共请求 15000 次

**变量配置方式：**

![image](/assets/images/posts/jmeter-load-test-influxdb-api/img-02.webp)

![image](/assets/images/posts/jmeter-load-test-influxdb-api/img-03.webp)

- 从 csv 文件中读取设备 id 列表，并定义第一列为变量"deviceId"
- 在http post body中，使用变量deviceId
- 结合前面的“并发数 30、循环 500 次”的定义，每一个请求会依次读取 csv 文件中下一行的内容，就达到了“依次查询每一个设备的指标”的效果。

**压测结果，采用“聚合报告”方式展示**

![image](/assets/images/posts/jmeter-load-test-influxdb-api/img-04.webp)

### 导出相关配置，然后在linux服务器上使用命令行模式执行压测

把配置文件 copy 到服务器上，然后执行命令：

`bash apache-jmeter-5.6.3/bin/jmeter -n -t 30_226.jmx -l result30-226-4.jtl -e -o report`

这样就在/report目录下生成了结果报告。由于是html格式，copy到 MAC 上查看效果：

![image](/assets/images/posts/jmeter-load-test-influxdb-api/img-05.webp)

## InfluxDB压测结果

版本: 2.7.4  

硬件：机械硬盘、cpu 16核  

数据量：存储了 2 个多月的指标数据，100亿行（【设备、时间】粒度）  

查询： 查询一个设备 2 天的轨迹数据

并发 30，查询 1万次，结果如下：

![image](/assets/images/posts/jmeter-load-test-influxdb-api/img-06.webp)

并发 100，查询 1 万次，结果如下：

![image](/assets/images/posts/jmeter-load-test-influxdb-api/img-07.webp)

性能还是相当优秀的。

同样的业务场景，之前尝试过用postgresql、mongodb存储，他们底层都是B+ Tree存储结构，单表上亿行的数据，查询性能相比InfluxDB要慢很多倍。
