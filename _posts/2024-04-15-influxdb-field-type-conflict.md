---
layout: post
title: "influxdb field type冲突问题"
date: 2024-04-15 16:56:00 +0800
description: "写入influxdb时，报错类型冲突：表中字段longitude的类型是string，要写入的值类型是float，不允许这样。"
tags: [influxdb, 线上排查]
original_url: https://www.cnblogs.com/xushengbin/p/18136462
---
## 问题描述

> 2024-04-14T14:59:51Z E! \[outputs.influxdb\_v2\] Failed to write metric to iot (will be dropped: 422 Unprocessable Entity): unprocessable entity: failure writing points to database: partial write: field type conflict: input field "longitude" on measurement "device\_metric" is type float, already exists as type string dropped=1224

写入influxdb时，报错类型冲突：表中字段longitude的类型是string，要写入的值类型是float，不允许这样。

## 问题分析

<https://docs.influxdata.com/influxdb/v2/reference/faq/#how-does-influxdb-handle-field-type-discrepancies-across-shards>

> Field values can be floats, integers, strings, or Booleans. Field value types cannot differ within a shard, but they can differ across shards.

在同一个分片（shard）内同一个字段只能有一个类型。不同分片同一个字段可以使用不同的类型。

因此，上面的报错，只能说明部分分区中有类型冲突的问题。 **并不是所有数据都无法写入，只是特定分区的数据会因为类型冲突无法写入。**

下面看看到底是哪个分区存在类型冲突的问题

```text
cd /mnt/data/influxdb/engine/data
influxd inspect check-schema
```

输出：

```text
Processing 62ea4f9dbf724d07/autogen/401/fields.idx
{"level":"info","ts":1713171034.145333,"caller":"logger/fields.go:131","msg":"loading changes (start)","op_name":"field indices","op_event":"start"}
{"level":"info","ts":1713171034.1453714,"caller":"logger/fields.go:133","msg":"loading changes (end)","op_name":"field indices","op_event":"end","op_elapsed":0.000035632}
Processing 62ea4f9dbf724d07/autogen/41/fields.idx
{"level":"info","ts":1713171034.1477647,"caller":"logger/fields.go:131","msg":"loading changes (start)","op_name":"field indices","op_event":"start"}
{"level":"info","ts":1713171034.147799,"caller":"logger/fields.go:133","msg":"loading changes (end)","op_name":"field indices","op_event":"end","op_elapsed":0.000037203}
Processing 62ea4f9dbf724d07/autogen/42/fields.idx
{"level":"info","ts":1713171034.1485324,"caller":"logger/fields.go:131","msg":"loading changes (start)","op_name":"field indices","op_event":"start"}
{"level":"info","ts":1713171034.1485918,"caller":"logger/fields.go:133","msg":"loading changes (end)","op_name":"field indices","op_event":"end","op_elapsed":0.000071106}
Processing 62ea4f9dbf724d07/autogen/43/fields.idx
{"level":"info","ts":1713171034.149207,"caller":"logger/fields.go:131","msg":"loading changes (start)","op_name":"field indices","op_event":"start"}
{"level":"info","ts":1713171034.1492457,"caller":"logger/fields.go:133","msg":"loading changes (end)","op_name":"field indices","op_event":"end","op_elapsed":0.000041647}
Processing 62ea4f9dbf724d07/autogen/65/fields.idx
{"level":"error","ts":1713171034.182047,"caller":"tsdb/shard.go:2544","msg":"field creation","op_name":"field indices","error":"failed creating \"device_metric\".\"acc\": field type conflict","stacktrace":"github.com/influxdata/influxdb/v2/tsdb.(*MeasurementFieldSet).ApplyChanges\n\t/root/project/tsdb/shard.go:2544\ngithub.com/influxdata/influxdb/v2/tsdb.(*MeasurementFieldSet).load\n\t/root/project/tsdb/shard.go:2417\ngithub.com/influxdata/influxdb/v2/tsdb.NewMeasurementFieldSet\n\t/root/project/tsdb/shard.go:1968\ngithub.com/influxdata/influxdb/v2/cmd/influxd/inspect/type_conflicts.(*TypeConflictChecker).readFields.func1\n\t/root/project/cmd/influxd/inspect/type_conflicts/check_schema.go:135\nio/fs.walkDir\n\t/go/src/io/fs/walk.go:73\nio/fs.walkDir\n\t/go/src/io/fs/walk.go:95\nio/fs.walkDir\n\t/go/src/io/fs/walk.go:95\nio/fs.walkDir\n\t/go/src/io/fs/walk.go:95\nio/fs.walkDir\n\t/go/src/io/fs/walk.go:95\nio/fs.WalkDir\n\t/go/src/io/fs/walk.go:122\ngithub.com/influxdata/influxdb/v2/cmd/influxd/inspect/type_conflicts.(*TypeConflictChecker).readFields\n\t/root/project/cmd/influxd/inspect/type_conflicts/check_schema.go:113\ngithub.com/influxdata/influxdb/v2/cmd/influxd/inspect/type_conflicts.checkSchemaRunE\n\t/root/project/cmd/influxd/inspect/type_conflicts/check_schema.go:85\ngithub.com/influxdata/influxdb/v2/cmd/influxd/inspect/type_conflicts.NewCheckSchemaCommand.func1\n\t/root/project/cmd/influxd/inspect/type_conflicts/check_schema.go:38\ngithub.com/spf13/cobra.(*Command).execute\n\t/go/pkg/mod/github.com/spf13/cobra@v1.0.0/command.go:842\ngithub.com/spf13/cobra.(*Command).ExecuteC\n\t/go/pkg/mod/github.com/spf13/cobra@v1.0.0/command.go:950\ngithub.com/spf13/cobra.(*Command).Execute\n\t/go/pkg/mod/github.com/spf13/cobra@v1.0.0/command.go:887\nmain.main\n\t/root/project/cmd/influxd/main.go:61\nruntime.main\n\t/go/src/runtime/proc.go:250"}
Error: unable to open file "62ea4f9dbf724d07/autogen/65/fields.idx": failed creating "device_metric"."acc": field type conflict
```

说明分区 65 存在类型冲突。  

influxdb是根据时序数据的时间，进行分区的。如 2024.4月、2024.5月数据各一个分区。

## 类型冲突之后怎么办？

1、修改类型。  
 <https://docs.influxdata.com/influxdb/v2/reference/faq/#can-i-change-a-fields-data-type>

2、查询特定类型的 value  
 <https://docs.influxdata.com/influxdb/v2/reference/faq/#how-does-influxdb-handle-field-type-discrepancies-across-shards>

实际上可操作性不强，那么尽量从源头避免（数据写入时）保证类型不会冲突吧。
