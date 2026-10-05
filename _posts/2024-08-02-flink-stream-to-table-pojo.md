---
layout: post
title: "flink stream转table POJO对象遇到的坑"
date: 2024-08-02 12:20:00 +0800
description: "schema中，只有f0一个field，类型是TrackLog，也就是说，在把POJO类的fields映射到表时，出现了问题。"
tags: [flink, flink sql]
original_url: https://www.cnblogs.com/xushengbin/p/18338491
---
## 核心代码

```java
public class TrackLog {
    private Integer entityId;
    // flink的时间类型，必须使用LocalDateTime
    private LocalDateTime statDateTime;
	public Integer getEntityId() {
        return entityId;
    }

    public void setEntityId(Integer entityId) {
        this.entityId = entityId;
    }
	public LocalDateTime getStatDateTime() {
        return statDateTime;
    }

    public void setStatDateTime(LocalDateTime statDateTime) {
        this.statDateTime = statDateTime;
    }
}

SideOutputDataStream<TrackLog> patrolStream = traceStream.getSideOutput(outputLogTag);
Table table = tableEnv.fromDataStream(patrolStream);
table.printSchema();
```

会输出：

```text
(
  `entityId` INT,
  `statDateTime` RAW('java.time.LocalDateTime', '...')
)
```

## 问题一： 往POJO类（TrackLog）中private 属性isDup，未定义getter方法

```java
public class TrackLog {
    private Integer entityId;
    // flink的时间类型，必须使用LocalDateTime
    private LocalDateTime statDateTime;

	private boolean isDup = false;

	public Integer getEntityId() {
        return entityId;
    }

    public void setEntityId(Integer entityId) {
        this.entityId = entityId;
    }
	public LocalDateTime getStatDateTime() {
        return statDateTime;
    }

    public void setStatDateTime(LocalDateTime statDateTime) {
        this.statDateTime = statDateTime;
    }
}
```

再运行：

```text
(
  `f0` RAW('com.tide.entity.TrackLog', '...')
)
```

schema中，只有f0一个field，类型是TrackLog，也就是说，在把POJO类的fields映射到表时，出现了问题。  

很奇怪，debug了好久才发现问题所在。

## 问题二：定义了schema，但是字段比POJO类中public field少了一个。程序抱错

代码：

```java
public class TrackLog {
    private Integer entityId;
    // flink的时间类型，必须使用LocalDateTime
    private LocalDateTime statDateTime;

	private boolean isDup = false;

	public Integer getEntityId() {
        return entityId;
    }

    public void setEntityId(Integer entityId) {
        this.entityId = entityId;
    }
	public LocalDateTime getStatDateTime() {
        return statDateTime;
    }

    public void setStatDateTime(LocalDateTime statDateTime) {
        this.statDateTime = statDateTime;
    }
	public boolean isDup() {
        return isDup;
    }

    public void setDup(boolean dup) {
        isDup = dup;
    }
}

SideOutputDataStream<TrackLog> patrolStream = traceStream.getSideOutput(outputLogTag);
        Schema schema = Schema.newBuilder()
                .column("entityId", DataTypes.INT())
                .column("statDateTime", DataTypes.TIMESTAMP())
                .build();
        Table table = tableEnv.fromDataStream(patrolStream, schema);
```

```text
Caused by: org.apache.flink.table.api.ValidationException: Unable to find a field named 'entityId' in the physical data type derived from the given type information for schema declaration. Make sure that the type information is not a generic raw type. Currently available fields are: [f0]
```

判断：问题不在于POJO类中多了一个field，而在于多了一个Boolean类型的field，不明白为啥Boolean类型会导致问题。

## 教训

### 1、当POJO类的fields和表的字段严格一致时，不需要指定Schema

### 2、POJO类中如果有Boolean类型，可能会导致问题。当我们的POJO类加入

```java
{
    private Boolean isDup = false;
    public Boolean isDup() {
        return isDup;
    }

    public void setDup(boolean dup) {
        isDup = dup;
    }
}
```

不指定schema情况下，输出：

```text
(
  `f0` RAW('com.tide.entity.TrackLog', '...')
)
```

去掉这个field，输出的table schema就正常了。

## 谜底揭晓

经过百般尝试，发现问题不在于Boolean类型，而在于IDEA为boolean类型生成的getter、setter方法不符合flink的标准。

```java
public Boolean isDup() {
        return isDup;
    }

    public void setDup(boolean dup) {
        isDup = dup;
    }
```

修改为：

```java
 public boolean getIsDup() {
        return isDup;
    }

    public void setIsDup(boolean dup) {
        isDup = dup;
    }
```

程序一切正常了。  

因此，POJO类的规范至关重要：

1. 每个private field必须定义标准的getter、setter方法
2. 注意一定是标准的getter、setter方法。

后面再抽时间看看，flink如何把POJO类映射成table schema的。（大概率是反射）
