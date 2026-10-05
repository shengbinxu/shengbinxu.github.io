---
layout: post
title: "利用Grafana监控influxdb表中数据有效性"
date: 2024-03-27 14:15:00 +0800
description: "把时序数据（如车辆指标）写入influxdb之后，我们想知道指标值是否异常（如累计里程 大于 1 亿）、新增数据量是否合理（如半个小时表中没有新增数据，大概率服务故障了）"
tags: [grafana, influxdb]
original_url: https://www.cnblogs.com/xushengbin/p/18099056
---
## 目标

把时序数据（如车辆指标）写入influxdb之后，我们想知道指标值是否异常（如累计里程 大于 1 亿）、新增数据量是否合理（如半个小时表中没有新增数据，大概率服务故障了）

## 方案概述

influxdb本身提供了 alert 功能，但是比较简陋。如不支持把报警消息发送到飞书。  

因此我就尝试用Grafana Alert来实现此需求。  

不得不说，Grafana Alert功能很强大。Prometheus是基于promQL查询语言创建报警规则，而Grafana Alert是更通用的基于 SQL 创建报警规则的方案。

## 监控配置步骤

### 利用influxdb task 每 30 分钟统计一次“每个客户新增数据行数”。

```text
import "date"

option task = {name: "LocRowCountByCustomer", every: 30m}

from(bucket: "iot")
    |> range(start: date.truncate(t: -3h, unit: 30m), stop: date.truncate(t: now(), unit: 30m))
    |> filter(fn: (r) => r["_measurement"] == "device_metric")
    |> filter(fn: (r) => r["_field"] == "longitude")
    |> group(columns: ["customerId"])
    |> aggregateWindow(every: 30m, fn: count, createEmpty: false)
    |> set(key: "_measurement", value: "loc_row_count_by_customer")
    |> set(key: "_field", value: "count")
    |> to(bucket: "iot-stat", org: "tide")
```

统计结果输出到另外一个表中：

![image](/assets/images/posts/grafana-monitor-influxdb-data-quality/img-01.webp)

这样就得到每个客户的新增数据行数。

此时，还可以利用 influxdb dashboard，对新增数据行数进行可视化展示：

![image](/assets/images/posts/grafana-monitor-influxdb-data-quality/img-02.webp)

### Grafana Alert配置

1、配置Grafana数据源

![image](/assets/images/posts/grafana-monitor-influxdb-data-quality/img-03.webp)

需要特别注意授权方式这里。添加influxdb的 token 即可。

2、配置报警规则

（1）最近 30 分钟新增行数低于 10万，进行报警。

![image](/assets/images/posts/grafana-monitor-influxdb-data-quality/img-04.webp)

（2）累计里程有值大于 1000 万，进行报警。

![image](/assets/images/posts/grafana-monitor-influxdb-data-quality/img-05.webp)

3、报警通知方式

![image](/assets/images/posts/grafana-monitor-influxdb-data-quality/img-06.webp)

可以配置把报警消息发送到alertmanager，这样在报警通知这块，就和prometheus监控使用一套体系了。

## 我对 Grafana Alert的理解

Grafana Alert支持很多种数据源，如 mysql、es 、时序数据库等。  

它很通用。那么，它背后的设计思想是什么？

### 通过 SQL 等查询语言，输出“监控指标”的时序值。

- 监控指标，也就是 SQL 输出的 value。
- 时序值，即输出 value 随着时间变化的所有值
- tag。即 value 的标签。等同于 sql 中的 group by

| customer5 |  |  |  |  |
| --- | --- | --- | --- | --- |
| customer4 |  |  |  |  |
| customer3 | 10000 | 10000 | 10050 | 30000 |
| customer2 | 1000 | 2000 | 1500 | 3000 |
|  | 10:00 | 10:30 | 11:00 | 12:00 |

如上图所示，我们得到了每个客户的新增数据行数时序数据。

### 对数据做reduce

![image](/assets/images/posts/grafana-monitor-influxdb-data-quality/img-07.webp)

如 max 函数，可以把时序数据（同一个客户有多个值），转换成单个值（如取时序数据的max值、mean值）。

这一步输出数据为：

| customer5 |  |
| --- | --- |
| customer4 |  |
| customer3 | 30000 |
| customer2 | 3000 |

对原始数据做了“降维”处理，少了时间维度。

### 通过数学表达式对 value 做转换

<https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/expression-queries/>  

如 value &gt; 10000时，转换为 1，否则为 0

| customer5 |  |
| --- | --- |
| customer4 |  |
| customer3 | 1 |
| customer2 | 0 |

对 value 转转换、计算。 这时也可以设置对这一步的结果进行报警。 值为 0 进行报警

### 阈值报警

![image](/assets/images/posts/grafana-monitor-influxdb-data-quality/img-08.webp)

新增数据行数低于 2 万进行报警。
