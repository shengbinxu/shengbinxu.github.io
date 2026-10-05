---
layout: post
title: "利用influxdb实现空间索引"
date: 2024-03-22 14:01:00 +0800
description: "influxdb官方有一个库（实验版本），说的是可以支持空间索引（如查询某一个框内的轨迹点）。但是我经常测试，查询慢的不可思议。"
tags: [influxdb, 空间索引]
original_url: https://www.cnblogs.com/xushengbin/p/18089336
---
## 问题描述

influxdb官方有一个库（实验版本），说的是可以支持空间索引（如查询某一个框内的轨迹点）。但是我经常测试，查询慢的不可思议。

我在论坛曾经反馈过这个问题，目前没找到答案。

![image](/assets/images/posts/influxdb-spatial-index/img-01.png)

## 解决方案

1、在 influxdb 表中增加 s2\_cell\_id字段，通过telegraf 给该字段赋值。 （见上截图）

![image](/assets/images/posts/influxdb-spatial-index/img-02.png)

来验证下s2\_cell\_id的逻辑（level 设置为 12）

> <https://gojekfarm.github.io/s2-calc/>
>
> ![image](/assets/images/posts/influxdb-spatial-index/img-03.png)

然后转换成 16 进制字符串：

![image](/assets/images/posts/influxdb-spatial-index/img-04.png)

和截图中第一行的s2\_cell\_id字段值一致。

2、需求是，查询一天内经过某一个区域（正方形）的所有车辆。

（1） 正方形区域用 4 个点可以表示，先计算这 4 个点的s2\_cell\_id（同样使用 level 12 计算）

（2）然后使用s2\_cell\_id作为influxdb的 sql 查询条件

`select * from "iot_track" where customerId='2071' and s2_cell_id='3414b15';`

![image](/assets/images/posts/influxdb-spatial-index/img-05.png)

这个 sql 快的不可思议。

（3）拿到了对应 s2 cell中的所有轨迹点，这个数据比业务实际需要的数据要多，然后后端程序再使用空间索引算法，从中找出确实在正方形内的轨迹点。

## 注意事项

1、s2\_cell\_id的 level 设置至关重要。

> <https://s2geometry.io/resources/s2cell_statistics.html>

我用的是 12，即 5平方公里内的点，划分到一个格子中。  

如果格子太小，会导致influxdb表的基数过大，会导致严重的性能问题。  

在线上经过测试（64G、16 核、机械硬盘），基础为几万时，influxdb的内存、cpu 消耗都很正常。当基数为 60 万时，cpu 长期大于 300%。这时候查询、写入性能没发现明显的问题，但是感觉是个隐患。

2、我们的业务场景是，车辆的行驶范围一般都固定一个城市内部。如果同一辆车在全国各地跑，用这种方式，可能就会导致influxdb的基数显著膨胀。

## 扩展： influxdb的基数怎么计算的

举例，一辆车（deviceId，作为表的 tag）经过了 5 个s2 cell（每个 cell 5 平方公里，也就是一辆车的行驶范围在 25 平米公里内），这辆车上报了 5个指标（里程、经纬度、速度等），如果一共有 1 万辆车。那么基数的计算方式就是：  
 `（5 * 5）* 10000 = 25万`

另外，要考虑的是，不同种类的车上报的指标数量可能不同（如新能源车 32960 协议上报 30 个指标，而油车 808协议只上报了 5 个指标），计算基数时就不能简单地用`10000 * 30`
