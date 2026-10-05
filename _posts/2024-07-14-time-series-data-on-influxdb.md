---
layout: post
title: "时序数据从通用数据库切换到influxdb后，在查询、分析方面能获取哪些便利？"
date: 2024-07-14 12:47:00 +0800
description: "如传感器5s上报一次数据，某些场景下，为了性能考虑，需要20s或者5min返回一个point"
tags: [influxdb, 时序数据库]
original_url: https://www.cnblogs.com/xushengbin/p/18301362
---
## 数据抽稀

如传感器5s上报一次数据，某些场景下，为了性能考虑，需要20s或者5min返回一个point

```sql
select last(mileage) from device_data_old where deviceId= '00130846142' and time> now() -60m group by time(5m);
```

![image](/assets/images/posts/time-series-data-on-influxdb/img-01.png)

注意： `03:40` 取的是`03:44:55`时间点的值。即time返回的是滚动窗口的开始时间。

<https://docs.influxdata.com/influxdb/v2/query-data/influxql/functions/selectors/>

## 滚动平均算法（Rolling Average）

```sql
select MOVING_AVERAGE(speed,10) from device_data_old where deviceId= '00130846142' and time> now() -60m;
```

![image](/assets/images/posts/time-series-data-on-influxdb/img-02.png)

<https://docs.influxdata.com/influxdb/v2/query-data/influxql/functions/transformations/#moving_average>

滚动平均的计算步骤如下：

1. 选择窗口大小：确定滚动窗口的大小（通常是一个固定的时间段或数据点的数量）。
2. 计算子集平均值：对于时间序列中的每一个数据点，计算以该点为中心的滚动窗口内所有数据点的平均值。
3. 移动窗口：将窗口从数据集的开始位置逐渐向右移动，每次移动一个数据点，重复步骤2，直到数据集的末尾。

滚动平均在许多领域都有广泛的应用：

1. 股票市场分析：用于平滑股价波动，识别股票价格的长期趋势，常用的窗口大小有20日、50日和200日等。
2. 信号处理：用于滤波和平滑信号，减少噪声影响，提高信号的稳定性。
3. 经济数据分析：用于分析经济指标（如GDP、失业率等）的变化趋势，帮助制定经济政策。
4. 工业生产：用于监控生产过程中的参数变化，及时发现并处理异常情况。
5. 气象学：用于平滑温度、降水量等气象数据，识别长期气候趋势。

## 计算点差值

案例一：计算两个点之间的里程值差值。

```sql
select * from (select DIFFERENCE(mileage) as diff from device_data_old where time > now() -1m group by deviceId) where diff>1;
```

案例二：计算车辆一天消耗的汽油有几升？

oil是油耗仪检测到的油箱当前油量。

![image](/assets/images/posts/time-series-data-on-influxdb/img-03.png)

```sql
select sum(diff) from (select DIFFERENCE(oil) as diff from device_data_old where time > now() -13h and deviceId='14145676230') where diff < 0;
```

实际情况中，由于汽车颠簸等因素油耗仪测量得到的值，有一定的波动，算法需要做调教。

## 计算点值变化率

Returns the non-negative rate of change between subsequent field values.  
 <https://docs.influxdata.com/influxdb/v2/query-data/influxql/functions/transformations/#non_negative_derivative>

## 计算累计里程

mileage是车辆仪表盘里程（有时候会清零），现在要计算车辆一天的累计行驶里程，方法：

```sql
select sum(mileageDiff) from (select NON_NEGATIVE_DIFFERENCE(mileage) as mileageDiff from device_data_old where deviceId= '14162727998' and time> now() - 13h);
```

## 由点diff值得到累计和

如根据两个点的经纬度计算行驶距离distance，然后想得到一天的累计里程。  

CUMULATIVE\_SUM  
 <https://docs.influxdata.com/influxdb/v2/query-data/influxql/functions/transformations/#cumulative_sum>
