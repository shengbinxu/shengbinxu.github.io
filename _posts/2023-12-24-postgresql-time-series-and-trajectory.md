---
layout: post
title: "postgresql存储时序、轨迹数据"
date: 2023-12-24 02:19:00 +0800
description: "pg分区功能、最好每个设备数据存在一个分区 - pg array类型、或者中间表，来解决行数太多的问题。 - 表太大时，btree会有性能瓶颈。块级索引就适合这个场景 - 每天一个分区，每个分区有自己的索引文件。"
tags: [postgresql, 时序数据库]
original_url: https://www.cnblogs.com/xushengbin/p/17919856.html
---
## 需求

### 轨迹查询

查询车辆一天的指标（轨迹、速度）

业务：  

1、一天有1800万条指标数据

- pg分区功能、最好每个设备数据存在一个分区
- pg array类型、或者中间表，来解决行数太多的问题。
- 表太大时，btree会有性能瓶颈。块级索引就适合这个场景<https://zhmin.github.io/posts/postgresql-block-range-index/>
- 每天一个分区，每个分区有自己的索引文件。
  <https://stackoverflow.com/questions/71610180/postgresql-partition-table-unique-index-problem>

2、多个指标要存储、指标随时增加

- json类型

3、时序数据

技术要求：  

1、

### 空间索引

查询一个区域内经过的车辆  

技术要求：  

1、一辆车一天的轨迹，存一行数据。从原始表进行汇总。  

2、空间聚合函数。点可以以线串形式保存。划分时间间隔（如每15分钟创建一个线串），如果范围内没有点，就不生成线串。

- 考虑轨迹飘逸（断）的问题。如果线串的长度大于几公里，就认为是飘逸数据。

### dba群里问一下方案

## 参考资料

<https://github.com/digoal/blog>  
 <https://www.cnblogs.com/88223100/p/PostgreSQL_real-time_position_tracking-trajectory_analysis_system_practice.html>  
 <https://github.com/digoal/blog/blob/master/201604/20160414_01.md?spm=a2c6h.12873639.article-detail.16.a9fd5f37wN8Sfy&amp;file=20160414_01.md>

postgresql 提供了块级索引（简称 BRIN），主要适用于类似时序数据之类的，有着天然的顺序，而且都是添加写的场景。相比于 btree 索引，它的体积小得多，非常适用于大数据量的场景。

## 表结构设计

### 原始点表

| 字段 | 类型 |  |
| --- | --- | --- |
| device\_id | string |  |
| time | timestamp |  |
| metric | jsonb | {"speed": 1.0,"loc" : {1,2}}  <https://www.cnblogs.com/chenyablog/p/14647273.html> |

1、表根据timestamp字段进行分区，每天存储一个分区  

2、字段device\_id创建bree索引  

3、字段time创建块索引

<http://www.postgres.cn/docs/14/ddl-partitioning.html>

- 分区之后，索引是创建在分区表上的

### 轨迹表

| 字段 | 类型 |  |
| --- | --- | --- |
| device\_id |  |  |
| date | 天 |  |
| geo | geometry | LINESTRING(0 0, 1 1,2 1,2 2) |
| customer\_id | 客户id |  |

1、根据date进行分区存储  

2、date字段创建bree索引  

2、轨迹字段，创建空间索引

## brew install pg

<https://blog.csdn.net/kmust20093211/article/details/44359053>

## 优化

1、date、customer\_id进行分区  

2、主键索引可以没有。

## 测试情况

- 只insert
- 关闭同步写入

![image](/assets/images/posts/postgresql-time-series-and-trajectory/img-01.png)

![image](/assets/images/posts/postgresql-time-series-and-trajectory/img-02.png)

一秒写入6万。

![image](/assets/images/posts/postgresql-time-series-and-trajectory/img-03.png)

设想：  

1、同时保留mongo和postgresql。 postgresql给用户使用，mongo给第三方，以及统计脚本使用。

```sql
select time, device_id,entity_id, st_astext(point) from device_metric where time >=  '2023-12-17 00:00:00'::timestamp and time < '2023-12-18'::timestamp and ST_Within(point,ST_GeomFromText('POLYGON((120.68212 36.966528, 120.683314 36.966528, 120.683314 36.965702, 120.68212 36.965702, 120.68212 36.966528))')) and customer_id = 2030;
```

Time: 1367.049 ms  

Time: 109.632 ms

3000多条轨迹，2s内。时间很稳定。

```sql
select * from device_metric where time >=  '2023-12-11 02:00:00'::timestamp and time < '2023-12-17'::timestamp and device_id = '01080803747' and customer_id = 2030;
```

738.466ms  

3397.579ms

查轨迹：  

1、5天，1.3万轨迹，4s多。  

2、

## 空间索引、B tree复合索引

<https://developer.aliyun.com/article/109832>
