---
layout: post
title: "kafka不丢数据秘籍之一：数据复制原理"
date: 2024-03-19 08:36:00 +0800
description: "强烈推荐这个视频，kafka 的联合创始人录制的视频。"
tags: [kafka, 架构]
original_url: https://www.cnblogs.com/xushengbin/p/18081951
---
<https://www.youtube.com/watch?v=PPDffzAy86I>  

强烈推荐这个视频，kafka 的联合创始人录制的视频。

下面写写我看完后几点理解：

![image](/assets/images/posts/kafka-replication/img-01.png)

## HW（高水位）用来标记哪些消息可以被消费。避免未持久化的消息被消费到。

之所以要“避免未持久化的消息被消费到”，是因为遇到节点故障（选择新的分区 leader），未持久化的消息在重新选举时可能被丢弃。可能被丢弃的消息，当然不能被业务消费到。

HW 是leader分区上才有的概念。当一个消息同步到所有的同步副本时，会更新 HW（指代的是一个offset），消费者只能消费到`offset <= HW` 的消息。

### 1、kafka 如何维护 HW 的？

（1）分区副本节点，向 leader 发送 fetch 请求，告知local log的 LEO（log end offset）。

以上图为例，broker-101是leader，此时LEO是 3，接下来broker-102、broker-103向broker-101发送 fetch 请求，告知说我当前的 LEO 都是 3，请给我复制最新的数据。 这时候leader就知道offset为 2 的消息已同步到所有的节点，就可以更新HW为3 (需要加 1)

（2）分区 leader 发生变化之后，新的 leader 中 HW 默认是 0

此时消费者消费数据时，会响应“可重拾异常”，消费者需要多次尝试，直到 leader 的 HW 追上真实的 HW。  

这个追赶的过程，就和第一步一样的。 副本向 leader 复制数据，告知当前的 LEO，然后 leader 来更新 HW

## leader epoch（任期编号）用来做副本间数据一致性校对（该丢弃的丢弃，副本数据要保证最终一致性）

![image](/assets/images/posts/kafka-replication/img-02.png)

图中的状态：

1. 在 101 是 leader 时（任期为 1），101、102 中写入了offset为 4 的消息。103 中只同步到offset为 2 的消息。
2. 此时 leader 发生故障，选举103 为 leader。

- 画重点
  ： 只要是同步副本都可以成为 leader。只有当某一个副本落后 leader 超过一定时间（举例最近 30s 一直没追上过），才会被标记为“不同步副本”。 新的 leader 上的数据存在不全的可能性。

1. 新leader（103）开始接受数据写入，新写入的数据任期为 2
2. 102开始向 leader 发起 fetch 请求，参数如下（任期为 1，offset为5），leader 回复如下图（任期 1 我的最大offset是 3），这时候 102 知道消息 4、5 在 leader 上没有，就truncate掉 4、5 两条数据
   ![image](/assets/images/posts/kafka-replication/img-03.png)
   ![image](/assets/images/posts/kafka-replication/img-04.png)

- 画重点
  ： 如何避免写入成功的数据被丢弃呢？答案是producer要配置
  ack:all
  ，只有当一条消息被写入所有同步副本，才给客户端回复成功。否则客户端都应该重试尝试重新写入。
- 画重点
  ：设置
  ack:all
  时，如果只有一个同步副本，当 leader 挂到时，消息还是可能会丢失。这时候就要结合
  min.insync.replicas
  ，设置必须至少有 n 个同步副本，才允许写入。这样就能容忍 n-1个节点同时故障并且不会丢数据。

1. 此时，102重新向 leader 发起 fetch 请求，参数如下（任期为 1，offset为3），leader 回复如下（回复任期为 2 的消息），然后 102 向 local log 写入任期为 2的消息。
   ![image](/assets/images/posts/kafka-replication/img-05.png)
   ![image](/assets/images/posts/kafka-replication/img-06.png)
2. 过一段时间，101 重新上线，重复第四步的过程，truncate掉 4、5 两条数据
