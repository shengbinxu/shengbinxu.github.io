---
layout: post
title: "mybatis动态SQL"
date: 2024-10-30 18:19:00 +0800
description: "目前项目中写动态SQL，用的都是下面的语法："
tags: [mybatis, SQL]
original_url: https://www.cnblogs.com/xushengbin/p/18516335
---
目前项目中写动态SQL，用的都是下面的语法：

```text
@Select("<script>" +
            "SELECT wr.id,wr.customer_id,wr.type,wr.detail from xxx rel " +
            "LEFT JOIN xxx wr on rel.rule_id=wr.id where rel.entity_id=#{entityId} and wr.customer_id=#{customerId} " +
            "</script>")
    List<WarningRule> queryByEntityId(@Param("entityId") Integer entityId,@Param("customerId")Integer customerId);
```

有以下几种优化方式：  

1、大括号形式，免去字符串拼接SQL时忘记空格导致的语法错误问题。

```text
@Select({
    "<script>",
    "SELECT wr.id, wr.customer_id, wr.type, wr.detail",
    "FROM xxx rel",
    "LEFT JOIN xxx wr ON rel.rule_id = wr.id",
    "WHERE rel.entity_id = #{entityId}",
    "AND wr.customer_id = #{customerId}",
    "</script>"
})
List<WarningRule> queryByEntityId(@Param("entityId") Integer entityId, @Param("customerId") Integer customerId);
```

2、借助OGNL表达式，减少函数参数数量

> OGNL（Object-Graph Navigation Language）是一种用于访问和操作对象图的表达式语言。它被广泛用于 Java 环境中，尤其是在 MyBatis 和其他框架中。OGNL 允许你以简洁的方式访问对象属性、调用方法以及进行逻辑运算。

```text
@Select("SELECT * FROM users WHERE id = #{user.id}")
User getUser(@Param("user") User user);
```
