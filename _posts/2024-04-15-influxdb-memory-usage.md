---
layout: post
title: "influxdb内存占用剖析"
date: 2024-04-15 21:09:00 +0800
description: "本文将讲述influxdb内存中都存了哪些数据？"
tags: [influxdb, 性能]
original_url: https://www.cnblogs.com/xushengbin/p/18136680
---
## 目标

本文将讲述influxdb内存中都存了哪些数据？  

什么情况下会导致内存占用暴增？  

以及内存相关的配置。

## 我的influxdb配置

我的influxdb配置如下：  

/etc/influxdb/config.toml

```properties
bolt-path = "/var/lib/influxdb/influxd.bolt"
engine-path = "/var/lib/influxdb/engine"
storage-cache-max-memory-size = 20737418240
storage-cache-snapshot-memory-size = 524288000
log-level = "info"
storage-max-index-log-file-size =  50485760
storage-max-concurrent-compactions = 2
```

几个关键配置说明：

1. storage-cache-max-memory-size: db实例可以使用的最大内存。如果机器内存超大，可以设置为 0，无限制。

```properties
cache-max-memory-size = "1g"
The maximum size that a shard cache can reach before it starts rejecting writes.

Valid memory size suffixes are: k, m, or g (case-insensitive, 1024 = 1k). Values without a size suffix are in bytes.

Consider increasing this value if encountering cache maximum memory size exceeded errors.

Environment variable: INFLUXDB_DATA_CACHE_MAX_MEMORY_SIZE
```

1. storage-cache-snapshot-memory-size:

```text
The size at which the engine will snapshot the cache and write it to a TSM file, freeing up memory.

Valid memory size suffixes are: k, m, or g (case-insensitive, 1024 = 1k). Values without a size suffix are in bytes.

Environment variable: INFLUXDB_DATA_CACHE_SNAPSHOT_MEMORY_SIZE
```

往 DB 写数据时，数据先写入 WAL 文件，同时也会写入内存中。然后定期把内存中的数据写入 TSM 文件。  

这里定义的就是内存中数据的最大 size。当超过这个 size，会对内存中的数据产生一个快照，然后把快照写入 TSM 文件。

同时，还有另外一个配置`cache-snapshot-write-cold-duration`，它定义了当一个分区超过一定时间没有新数据写入，就会把内存中的数据刷新到磁盘。

```text
The time interval at which the engine will snapshot the cache and write it to a new TSM file if the shard hasn’t received writes or deletes.
```

三点：

- influxdb中每个分区的数据是单独存储的。因为每个分区会产生一个 WAL 文件。同时每个分区会单独占用一份内存空间。因此，当数据时间乱序写入时（写入的数据有 23年的、24 年。。。），就会占用更多的内存。
- 内存中的数据格式，具体来讲每个time series 对应一个数据结构，他们是有序的。 因此，基数越大占用内存也越多。
- 当机器内存不足时，可以降低storage-cache-snapshot-memory-size配置的大小，来降低总的内存占用。同理，当内存充足时，可以调大该配置，降低刷新磁盘的频率，降低 cpu 和磁盘开销。

1. storage-max-concurrent-compactions

```text
The maximum number of concurrent full and level compactions that can run at one time. The default value of 0 results in 50% of the CPU cores being used at runtime for compactions. If explicitly set, the number of cores used for compaction is limited to the specified value. This setting does not apply to cache snapshotting. For more information on GOMAXPROCS environment variable, see GOMAXPROCS environment variable on this page.
```

如果你的机器间歇性地 CPU 过高，可以降低这个参数的值。

## 通过influxdb监控数据，验证上述配置的效果

<https://docs.influxdata.com/influxdb/v2/reference/internals/metrics/#influxdb-storage-statistics>  

通过 DB 暴漏的metrics指标，可以监控 DB 的内存运行状态。

我使用的是prometheus监控。

**指标 1：**

storage\_cache\_inuse\_bytes: Gauge of current memory consumption of cache

![image](/assets/images/posts/influxdb-memory-usage/img-01.png)

该指标，显示的是每一块cache（一个分区对应一块 cache） 的内存大小。  

内存中一共有 10 份 cache，说明有 10 个活跃的分区最近有数据写入。  

每个分区占用内存最大400 多 M，这也吻合了我们前面的配置`storage-cache-snapshot-memory-size = 524288000`

下面看下`storage_cache_inuse_bytes`和的变化趋势：

![image](/assets/images/posts/influxdb-memory-usage/img-02.png)

我们看到，这个总的内存占用波动挺大。 内存占用高的时段，基本都是因为我在导入大量的历史数据（写活跃分区多了）。

这个和，应该是由配置`storage-cache-max-memory-size = 20737418240`控制的，不能大于 20G。

那么，总的内存占用会大于 20G 吗？如何避免呢？

- 降低配置
  storage-cache-snapshot-memory-size = 524288000
- 避免基数太大。 因为influxdb中会建立反向索引，索引的大小和基数大小密切相关。

**指标 2**  

storage\_cache\_disk\_bytes: Gauge of size of most recent snapshot

这脸指标，一个是 cache 大小，一个是快照大小。

它们的区别，参考<https://docs.influxdata.com/influxdb/v2/reference/internals/storage-engine/#cache>

![image](/assets/images/posts/influxdb-memory-usage/img-03.png)

**指标 3**  

go\_memstats\_alloc\_bytes: Number of bytes allocated and still in use.

![image](/assets/images/posts/influxdb-memory-usage/img-04.png)

从 go 语言角度，当前该程序占用了 6.9G 内存。明显高于前面cache的总和(cache 2G、快照 500M)。  

那么，剩下的内存是谁占用的呢？  

（1） 索引是个大头，但是好像没有工具可以查看索引到底占用的多少内存。 <https://community.influxdata.com/t/how-can-i-estimate-the-index-size-based-on-tags/2221>

（2）DB会把磁盘上的文件做mmap，加速对磁盘数据的访问。 这个 mmap，并不是硬性要求，而是内存有空余时会把文件映射到内存。  

参考<https://blog.51cto.com/u_11418075/2636715>  

可以统计 DB 中磁盘文件内存映射总共耗费的内存：  
 `cat /proc/92825/smaps |grep -a2 /mnt/data/influxdb/engine/|awk '/Rss:/ {sum += $2} END {print sum " kB"}'`

![image](/assets/images/posts/influxdb-memory-usage/img-05.png)

一共 8G

![image](/assets/images/posts/influxdb-memory-usage/img-06.png)

![image](/assets/images/posts/influxdb-memory-usage/img-07.png)

我们统计的是物理内存的值：对应Rss这一行。  

我们看到，tsm和tsi文件都有做内存映射。

疑问又来了： 虚拟内存和物理内存的区别？

![image](/assets/images/posts/influxdb-memory-usage/img-08.png)

![image](/assets/images/posts/influxdb-memory-usage/img-09.png)

这个文章解释的很好： <https://www.cnblogs.com/liangping/p/12601281.html>

![image](/assets/images/posts/influxdb-memory-usage/img-10.png)

回到我的influxdb进程：

![image](/assets/images/posts/influxdb-memory-usage/img-11.png)

它的实际占用内存是10.5G  

约等于 MMAP（8G） + cache（2G） + 快照（500M）
