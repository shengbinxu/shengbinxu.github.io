---
layout: post
title: "基于prometheus实现SQL监控方案"
date: 2024-06-07 11:38:00 +0800
description: "业务上经常会出现这样的问题：客户反馈某个业务今天查不到数据。怎么通过监控提前发现呢？"
tags: [prometheus, 监控]
original_url: https://www.cnblogs.com/xushengbin/p/18236956
---
## 需求描述

业务上经常会出现这样的问题：客户反馈某个业务今天查不到数据。怎么通过监控提前发现呢？  

我们的业务场景是这样：  

在mysql中，每小时、每天，会通过定时任务汇总统计车辆在道路上的作业情况（作业时间、里程、平均速度等）。  

经常出现，某一个客户某一类型数据没算（表中没有新增数据）。

## 技术方案

1、利用<https://github.com/justwatchcom/sql_exporter> 生成监控指标

```sql
- name: "ai_work_quality_loss_data"
    help: 'ai_work_quality表缺数据'
    labels:
      - customer_id
      - customer_name
      - work_type
    values:
      - count
    query: |
         select u.name as customer_name, u.id as customer_id,IFNULL(ai.count,0) as count, customer_work_type.work_type from user_group as u inner join (select customer_id,work_type from ai_work_quality where  `ts_start` > DATE_SUB(current_timestamp(), INTERVAL 10 day) group by customer_id,work_type) as customer_work_type on customer_work_type.customer_id = u.id left join (select  customer_id, work_type, count(*) as count from ai_work_quality as ai  where  `ts_start` > DATE_SUB(current_timestamp(), INTERVAL 2 hour) group by customer_id,work_type) as ai on ai.customer_id=u.id and ai.work_type=customer_work_type.work_type order by customer_name,ai.count desc
```

SQL的输出结果如下：

![image](/assets/images/posts/prometheus-sql-monitoring/img-01.webp)

我们得到了每个客户、每种作业类型最近2小时新增数据行数。

2、利用prometheus创建报警规则

```text
- alert: sql_ai_work_quality_row_count
    expr: sql_ai_work_quality_loss_data == 0 and (sql_ai_work_quality_loss_data offset 1w) != 0
    for: 3h
    annotations:
      summary: "ai_work_quality表可能缺数据"
      description: "{{$labels.customer_name}} 最近1小时xxx业务没新数据，上周同时段有数据"
```

和上周做比较， 某一个客户某一个作业类型上周有数据，今天同时段没数据了，会报警。

## 点评

为sql\_exporter这个项目点赞，很奇妙的设计。  

1、SQL输出每类数据（对应prometheus的label，对数据进行分组）的value（这里是行数）  

2、在sql\_exporter中配置哪些列是维度列、哪些是value列

这个模型很通用。

另外，要强调一点，由于这里的metric指标使用的是prometheus Gauge类型，即数据更新的逻辑。  
 <https://yunlzheng.gitbook.io/prometheus-book/parti-prometheus-ji-chu/promql/prometheus-metrics-types#gauge-ke-zeng-ke-jian-de-yi-biao-pan>

我们在写SQL时，一定要保证每个类型在每个时间点都有值，即使行数为0，也要在结果中反馈出来。否则sql\_exporter上报指标时，会认为这个指标的值没有变化。
