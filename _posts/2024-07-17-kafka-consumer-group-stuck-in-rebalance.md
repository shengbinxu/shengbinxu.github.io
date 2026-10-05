---
layout: post
title: "kafka一个消费者组一直停留在rebalance状态导致无法消费问题"
date: 2024-07-17 20:31:00 +0800
description: "线上突然出现，某一个消费者组下的部分分区无法消费。 kafka broker日志如下："
tags: [kafka, 线上排查]
original_url: https://www.cnblogs.com/xushengbin/p/18308233
---
## 问题描述

线上突然出现，某一个消费者组下的部分分区无法消费。 kafka broker日志如下：

```text
[2024-07-16 17:44:58,548] INFO [GroupCoordinator 0]: Dynamic Member with unknown member id joins group transfer-group in Stable state. Created a new member id consumer-22-0619b903-29b6-452a-851e-6f8d928e86bc for this member and add to the group. (kafka.coordinator.group.GroupCoordinator)
[2024-07-16 17:44:58,548] INFO [GroupCoordinator 0]: Preparing to rebalance group transfer-group in state PreparingRebalance with old generation 63 (__consumer_offsets-23) (reason: Adding new member consumer-22-0619b903-29b6-452a-851e-6f8d928e86bc with group instance id None) (kafka.coordinator.group.GroupCoordinator)
[2024-07-16 17:52:52,645] INFO [GroupCoordinator 0]: Member[group.instance.id None, member.id consumer-22-0619b903-29b6-452a-851e-6f8d928e86bc] in group transfer-group has left, removing it from the group (kafka.coordinator.group.GroupCoordinator)
```

从日志中可以看到，Kafka Group Coordinator 正在管理名为 "transfer-group" 的消费者组的动态成员。以下是日志中的一些重要信息：

1、动态成员加入消费者组：

```text
[2024-07-16 17:49:54,780] INFO [GroupCoordinator 0]: Dynamic Member with unknown member id joins group transfer-group in Stable state. Created a new member id consumer-22-36893988-abdb-46b6-a949-7b581d3bd8c3 for this member and add to the group. (kafka.coordinator.group.GroupCoordinator)
```

2、准备重新平衡消费者组：

```text
[2024-07-16 17:49:54,780] INFO [GroupCoordinator 0]: Preparing to rebalance group transfer-group in state PreparingRebalance with old generation 64 (__consumer_offsets-23) (reason: Adding new member consumer-22-36893988-abdb-46b6-a949-7b581d3bd8c3 with group instance id None) (kafka.coordinator.group.GroupCoordinator)
```

3、成员离开消费者组：

```text
[2024-07-16 17:52:52,645] INFO [GroupCoordinator 0]: Member[group.instance.id None, member.id consumer-22-0619b903-29b6-452a-851e-6f8d928e86bc] in group transfer-group has left, removing it from the group (kafka.coordinator.group.GroupCoordinator)
```

不断重复这个过程。  

从这些日志可以看出，该消费者组频繁地进行成员的加入和离开操作，每次有新成员加入时都会触发重新平衡操作。这种频繁的重平衡可能会影响消费者组的性能和稳定性。

那么，为什么频繁出现消费者加入、离开组呢？  

推断是，消费者程序那段时间，调用一个外部API（服务已经下线），不知何故，要么是消费者很慢（超过max.poll.interval.ms没有再次进行poll），要么是没有及时上报心跳（超过max.poll.interval.ms没有上报心跳）。

## 谈谈对分区再平衡的理解

### 消费者组协调器

<https://www.cnblogs.com/luedong/p/16023479.html>

### 相关配置

Difference between session.timeout.ms and max.poll.interval.ms?  
 <https://stackoverflow.com/questions/39730126/difference-between-session-timeout-ms-and-max-poll-interval-ms-for-kafka-0-10>

> The new timeout max.poll.interval.ms is mainly a client side concept: if poll() is not called within max.poll.interval.ms, the heartbeat thread will detect this case and send a leave-group request to the broker. -- max.poll.interval.ms is still relevant for consumer group rebalances: if a rebalance is triggered, consumers have max.poll.interval.ms time to re-join the group by calling poll() client side which triggers a join-group request.

## 总结

遇到一个消费者组频繁（或长期）处于rebalance状态，说明一定有消费者处于不健康的状态。要么消费太慢、要么因为网络或者GC原因没有及时上报心跳。
