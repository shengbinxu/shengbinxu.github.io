---
layout: post
title: "Kafka日志压实算法"
date: 2023-12-16 14:29:00 +0800
description: "也就是说，有过期删除和压实两种策略。可以为每一个topic单独设置清理策略，默认是过期删除。"
tags: [kafka, 存储]
original_url: https://www.cnblogs.com/xushengbin/p/17904792.html
---
## 概念介绍

### kakfa日志清理策略

> Kafka通过改变主题的保留策略来满足这些应用场景。如果保留策略是delete，那么早于保留时间的旧事件将被删除；如果保留策略是compact（压实），那么只为每个键保留最新的值。很显然，只有当应用程序生成的事件里包含了键–值对时，设置compact才有意义。如果主题中包含了null键，那么这个策略就会失效。  
>
> 主题的数据保留策略也可以被设置成delete.and.compact，也就是以上两种策略的组合。超过保留时间的消息将被删除，即使它们的键对应的值是最新的。组合策略可以防止压实主题变得太大，同时也可以满足业务需要在一段时间后删除数据的要求。

也就是说，有过期删除和压实两种策略。可以为每一个topic单独设置清理策略，默认是过期删除。

![](/assets/images/posts/kafka-log-compaction/img-01.png)

### 压实算法

我们有时候可以把Kafka当作key、value数据库用（当然kafka中的消息可以不指定key）。  

\_\_consumer\_offsets 这个topic的数据，就是典型的key、value数据。

```text
/usr/local/kafka2.8/bin/kafka-run-class.sh kafka.tools.DumpLogSegments --deep-iteration --print-data-log --files /mnt/kafka-disk/kafka-logs/__consumer_offsets-7/00000000000310221664.log --offsets-decoder
```

![](/assets/images/posts/kafka-log-compaction/img-02.png)

key中存储的是【消费者组、分区】信息，value中存储的是最新提交的offset。

显然，磁盘上只需要保留某一个key的最新值即可。即只需要知道某一个消费者组的最新提交的offset，并不关心昨天的offset。

针对这个场景，压实算法就派上用场了。

> 本文引用信息大多来自于《Kafka权威指南》一书  
>
> 一般情况下，Kafka会根据设置的时间来保留数据，把超过时效的旧数据删除。但是，请试想一种场景，假设你用Kafka来保存客户的收货地址，那么保存客户的最新地址比保存客户上周甚至去年的地址更有意义，这样你就不用保留客户的旧地址了。另外一种场景是应用程序使用Kafka来保存它的当前状态，每次状态发生变化，就将新状态写入Kafka。当应用程序从故障中恢复时，它会从Kafka读取之前保存的消息，以便恢复到最近的状态。应用程序只关心发生崩溃前的那个状态，并不关心在运行过程中发生的所有状态变化。  
>
> Kafka通过改变主题的保留策略来满足这些应用场景。如果保留策略是delete，那么早于保留时间的旧事件将被删除；如果保留策略是compact（压实），那么只为每个键保留最新的值。很显然，只有当应用程序生成的事件里包含了键–值对时，设置compact才有意义。如果主题中包含了null键，那么这个策略就会失效。

## 以生产环境一次压实过程为例，分析算法执行步骤

1、压实\_\_consumer\_offsets-7 相关日志如下：

![](/assets/images/posts/kafka-log-compaction/img-03.png)

```text
[2023-12-16 12:04:18,974] INFO [Log partition=__consumer_offsets-7, dir=/usr/local/kafka/kafka-logs] Rolled new log segment at offset 310221664 in 8 ms. (kafka.log.Log)
[2023-12-16 12:04:19,086] DEBUG Finding range of cleanable offsets for log=__consumer_offsets-7. Last clean offset=Some(309313806) now=1702699459085 => firstDirtyOffset=309313806 firstUncleanableOffset=310221664 activeSegment.baseOffset=310221664 (kafka.log.LogCleanerManager$)
```

```text
2023-12-16 12:04:19,086] INFO Cleaner 0: Beginning cleaning of log __consumer_offsets-7. (kafka.log.LogCleaner)
[2023-12-16 12:04:19,087] INFO Cleaner 0: Building offset map for __consumer_offsets-7... (kafka.log.LogCleaner)
[2023-12-16 12:04:19,108] INFO Cleaner 0: Building offset map for log __consumer_offsets-7 for 1 segments in offset range [309313806, 310221664). (kafka.log.LogCleaner)
[2023-12-16 12:04:19,697] INFO Cleaner 0: Offset map for log __consumer_offsets-7 complete. (kafka.log.LogCleaner)
[2023-12-16 12:04:19,697] INFO Cleaner 0: Cleaning log __consumer_offsets-7 (cleaning prior to Sat Dec 16 12:04:18 CST 2023, discarding tombstones prior to Fri Dec 15 07:50:41 CST 2023)... (kafka.log.LogCleaner)
[2023-12-16 12:04:19,697] INFO Cleaner 0: Cleaning LogSegment(baseOffset=0, size=739, lastModifiedTime=1702669040000, largestRecordTimestamp=Some(1702040094754)) in log __consumer_offsets-7 into 0 with deletion horizon 1702597841000, retaining deletes. (kafka.log.LogCleaner)
[2023-12-16 12:04:19,699] INFO Cleaner 0: Cleaning LogSegment(baseOffset=308405948, size=693, lastModifiedTime=1702684241000, largestRecordTimestamp=Some(1702684241337)) in log __consumer_offsets-7 into 0 with deletion horizon 1702597841000, retaining deletes. (kafka.log.LogCleaner)
[2023-12-16 12:04:19,709] INFO Cleaner 0: Swapping in cleaned segment LogSegment(baseOffset=0, size=739, lastModifiedTime=1702684241000, largestRecordTimestamp=Some(1702040094754)) for segment(s) List(LogSegment(baseOffset=0, size=739, lastModifiedTime=1702669040000, largestRecordTimestamp=Some(1702040094754)), LogSegment(baseOffset=308405948, size=693, lastModifiedTime=1702684241000, largestRecordTimestamp=Some(1702684241337))) in log Log(dir=/usr/local/kafka/kafka-logs/__consumer_offsets-7, topic=__consumer_offsets, partition=7, highWatermark=310221708, lastStableOffset=310221708, logStartOffset=0, logEndOffset=310221710) (kafka.log.LogCleaner)
[2023-12-16 12:04:19,709] INFO Cleaner 0: Cleaning LogSegment(baseOffset=309313806, size=104857599, lastModifiedTime=1702699458000, largestRecordTimestamp=Some(1702699458895)) in log __consumer_offsets-7 into 309313806 with deletion horizon 1702597841000, retaining deletes. (kafka.log.LogCleaner)
[2023-12-16 12:04:20,235] INFO Cleaner 0: Swapping in cleaned segment LogSegment(baseOffset=309313806, size=693, lastModifiedTime=1702699458000, largestRecordTimestamp=Some(1702699458895)) for segment(s) List(LogSegment(baseOffset=309313806, size=104857599, lastModifiedTime=1702699458000, largestRecordTimestamp=Some(1702699458895))) in log Log(dir=/usr/local/kafka/kafka-logs/__consumer_offsets-7, topic=__consumer_offsets, partition=7, highWatermark=310221742, lastStableOffset=310221742, logStartOffset=0, logEndOffset=310221742) (kafka.log.LogCleaner)
[2023-12-16 12:04:20,235] INFO [kafka-log-cleaner-thread-0]:
        Log cleaner thread 0 cleaned log __consumer_offsets-7 (dirty section = [309313806, 310221664])
        100.0 MB of log processed in 1.1 seconds (87.1 MB/sec).
        Indexed 100.0 MB in 0.6 seconds (163.9 Mb/sec, 53.1% of total time)
        Buffer utilization: 0.0%
        Cleaned 100.0 MB in 0.5 seconds (185.9 Mb/sec, 46.9% of total time)
        Start size: 100.0 MB (907,866 messages)
        End size: 0.0 MB (8 messages)
        100.0% size reduction (100.0% fewer messages)
 (kafka.log.LogCleaner)
```

**从日志中我们可以看到：**  

1、先是新创建一个段文件。offset从310221664开始。 这个段就是 \_\_consumer\_offsets-7的活跃段。活跃段不会进行压实，也不会清理。

2、之后，看到几个关键信息：

- firstDirtyOffset=309313806
- activeSegment.baseOffset=310221664

什么是DirtyOffset呢？

![](/assets/images/posts/kafka-log-compaction/img-04.png)

即未进行过压实操作的段的offset。

新段创建之后，就要对段文件00000000000309313806.log (offset范围【309313806, 310221664】) 进行压实操作。

经过压实操作之后，这个文件大小只有693b, 我们来看下这个文件的内容：

```text
/usr/local/kafka2.8/bin/kafka-run-class.sh kafka.tools.DumpLogSegments --deep-iteration --print-data-log --files /mnt/kafka-disk/kafka-logs/__consumer_offsets-7/00000000000309313806.log --offsets-decoder
```

![](/assets/images/posts/kafka-log-compaction/img-05.png)

段文件内容精简了很多，每个key只保留了一行数据。【309313806, 310221664】这么大的offset范围，只占不到1k空间。

## 被删除事件

前面讨论了，通过压实算法，磁盘上可以只保存一个key的最新值。那么如果要删除一个key该怎么操作呢？

![](/assets/images/posts/kafka-log-compaction/img-06.png)

正好在我们的服务中看到了一条墓碑消息；

![](/assets/images/posts/kafka-log-compaction/img-07.png)

这个消费者组已经一周没用了，kakfa集群应该是认为可以删除这个消费者组了，于是就发送了墓碑消息。

## 相关源码

kafka.log.LogCleaner.CleanerThread#tryCleanFilthiestLog

## 过期清理策略

上面着重介绍了压实策略，这里顺带提下过期清理策略。

相关源码：  

kafka.log.LogManager#cleanupLogs

```text
/**
   * Delete any eligible logs. Return the number of segments deleted.
   * Only consider logs that are not compacted.
   */
  def cleanupLogs(): Unit = {
  }
```

注释有说明，这里针对的是清理策略不是compacted（压实）的topic.

## 总结

1、.log文件中的offset，必须是单调递增的。可以不连续（本来是连续的，由于压实算法的原因变的不连续），但必须是单调递增。

我们线上的业务，因为未知的原因，就出现了同一个段文件中offset突然变小导致脏数据，分区数据无法写入的问题。

![](/assets/images/posts/kafka-log-compaction/img-08.png)

2、delete策略不会删除当前的活动片段一样，compact策略也不会压实当前的活动片段。
