---
layout: post
title: "maven依赖的优先级"
date: 2024-01-28 10:26:00 +0800
description: "在 Maven 中，依赖的解析顺序和优先级如下："
tags: [maven, 构建]
original_url: https://www.cnblogs.com/xushengbin/p/17992535
---
## 优先级

在 Maven 中，依赖的解析顺序和优先级如下：

直接依赖优先级高于传递性依赖： 如果你在项目的 pom.xml 中直接声明了某个依赖项，那么 Maven 会首先尝试使用这个直接声明的依赖项，而不考虑传递性依赖。直接依赖项的版本号会优先于传递性依赖。

最近者优先： 如果有多个传递性依赖解析到相同的依赖项，Maven 将选择距离项目最近的那个依赖项。这意味着，离项目更近的依赖项的版本会被选择。

先声明者优先： 如果有多个传递性依赖解析到相同的依赖项，并且它们距离项目的距离相同，则 Maven 将选择最先声明的那个依赖项。

## 实战

![image](/assets/images/posts/maven-dependency-precedence/img-01.webp)

micrometer-core 被两个库依赖：

- influxdb-spring，依赖micrometer-core的1.11.3版本
- spring-boot-starter-actuator，依赖micrometer-core的1.9.16版本

根据“最近着优先”原则，最终maven选择的是1.9.16版本。  

“omitted for conflict with:1.9.16” 意思是 “和版本1.9.16冲突，被省略”，也就是不加载1.11.3版本。

如果硬要使用1.11.3版本，方法就是提高1.11.3版本的依赖优先级。  

方案一：

```xml
 <dependency>
            <groupId>io.micrometer</groupId>
            <artifactId>micrometer-registry-influx</artifactId>
            <version>1.11.3</version>
        </dependency>
```

方案二：

```xml
<dependency>
            <groupId>io.micrometer</groupId>
            <artifactId>micrometer-core</artifactId>
            <version>1.11.2</version>
        </dependency>
```

都可以。

## 扩展学习

maven的optional参数：  
 <https://cloud.tencent.com/developer/article/1756145>
