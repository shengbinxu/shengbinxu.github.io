---
layout: post
title: "几个场景下用flink如何解决的思考"
date: 2024-08-20 23:27:00 +0800
description: "使用allowedLateness(5d)可以让窗户等待5天再关闭。"
tags: [flink, 流计算]
original_url: https://www.cnblogs.com/xushengbin/p/18370565
---
## 车辆GPS流和车辆过地磅重量流union，地磅数据最多晚到5天

使用allowedLateness(5d)可以让窗户等待5天再关闭。

### 1、第二天flink任务重启了，迟到数据还能处理吗？

![image](/assets/images/posts/flink-scenario-practices/img-01.png)

### 2、大部分车辆都没有称重数据，如何提前关闭这些窗口，避免过多浪费内存

![image](/assets/images/posts/flink-scenario-practices/img-02.png)

设置allowedLateness(5d)

对于没有称重数据的车辆，当水印 &gt; 窗口最大时间，就可以考虑清除窗口的状态。

## 1秒内气温升高超过1度，进行报警

利用KeyedProcessFunction中的定时器来实现。  

定时器通常用来清除某些key对应的窗口的状态。
