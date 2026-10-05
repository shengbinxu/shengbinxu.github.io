---
layout: post
title: "flink 类加载剖析"
date: 2024-11-03 16:49:00 +0800
description: "mainClass是 ChildFirstClassLoader加载的，因此java.sql.DriverManager.getConnection也是ChildFirstClassLoader加载的。"
tags: [flink, JVM]
original_url: https://www.cnblogs.com/xushengbin/p/18319603
---
```text
Caused by: java.sql.SQLException: No suitable driver found for jdbc:mysql://25.79.1.13:90/tide_cloud?connectTimeout=60000&socketTimeout=60000
        at java.sql.DriverManager.getConnection(DriverManager.java:689) ~[?:1.8.0_332]
        at java.sql.DriverManager.getConnection(DriverManager.java:247) ~[?:1.8.0_332]
        at org.apache.flink.connector.jdbc.catalog.MySqlCatalog.getDriverVersion(MySqlCatalog.java:159) ~[?:?]
        at org.apache.flink.connector.jdbc.catalog.MySqlCatalog.<init>(MySqlCatalog.java:93) ~[?:?]
        at com.tide.util.TableAssembler.build(TableAssembler.java:63) ~[?:?]
        at com.tide.Insight.prepare(Insight.java:112) ~[?:?]
        at com.tide.Insight.execute(Insight.java:104) ~[?:?]
        at com.tide.Insight.main(Insight.java:48) ~[?:?]
        at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method) ~[?:1.8.0_332]
        at sun.reflect.NativeMethodAccessorImpl.invoke(NativeMethodAccessorImpl.java:62) ~[?:1.8.0_332]
        at sun.reflect.DelegatingMethodAccessorImpl.invoke(DelegatingMethodAccessorImpl.java:43) ~[?:1.8.0_332]
        at java.lang.reflect.Method.invoke(Method.java:498) ~[?:1.8.0_332]
        at org.apache.flink.client.program.PackagedProgram.callMainMethod(PackagedProgram.java:355) ~[flink-dist-1.17.1.jar:1.17.1]
        ... 7 more
```

```java
public void invokeInteractiveModeForExecution() throws ProgramInvocationException {
        FlinkSecurityManager.monitorUserSystemExitForCurrentThread();
        try {
            callMainMethod(mainClass, args);
        } finally {
            FlinkSecurityManager.unmonitorUserSystemExitForCurrentThread();
        }
    }
```

```text
 this.mainClass =
                loadMainClass(
                        // if no entryPointClassName name was given, we try and look one up through
                        // the manifest
                        entryPointClassName != null
                                ? entryPointClassName
                                : getEntryPointClassNameFromJar(this.jarFile),
                        userCodeClassLoader);
```

mainClass是 ChildFirstClassLoader加载的，因此java.sql.DriverManager.getConnection也是ChildFirstClassLoader加载的。

因此，

```text
//        log.info(java.sql.DriverManager.class.getClassLoader().toString());
 log.info(Insight.class.getClassLoader().toString());
 log.info(com.mysql.cj.jdbc.Driver.class.getClassLoader().toString());
```

输出：

```text
org.apache.flink.util.ChildFirstClassLoader@7d81f8b6
sun.misc.Launcher$AppClassLoader@12a3a380
```

ChildFirstClassLoader 是 Flink 自定义的类加载器，继承自 Java 的 ClassLoader 类，但它的工作机制和 AppClassLoader 不同。  

ChildFirstClassLoader 会将子类加载器的类优先加载，而 AppClassLoader 则是按照默认的父类优先加载机制工作。  

这两者之间并没有直接的继承关系或父子关系，而是独立存在的，用于不同的目的和场景。

去掉`classloader.parent-first-patterns.additional: com.mysql.; org.codehaus.`配置之后，  

打印：

```text
org.apache.flink.util.ChildFirstClassLoader@69cebb68
org.apache.flink.util.ChildFirstClassLoader@69cebb68
```

这时候抱错了，提示`No suitable driver found for jdbc`，猜测原因：

- java.sql.DriverManager是由Boostrap类加载器加载的
- com.mysql.cj.jdbc.Driver 是由ChildFirstClassLoader类加载器加载的。

<https://juejin.cn/post/7249934982114672695>

## 知识点

1、任意一个类，都需要由**加载它的类加载器和这个类本身一同确立其在Java虚拟机中的唯一性**，每一个类加载器，都拥有一个独立的类名称空间。这句话可以表达更通俗一些：比较两个类是否”相等”，只有再这两个类是有同一个类加载器加载的前提下才有意义，否则，即使这两个类来源于同一个Class 文件，被同一个虚拟机加载，只要加载它们的类加载器不同，那这两个类就必定不相等。

2、类加载器本身不存在继承关系。 即使有双亲委派关系的存在，一个类的加载器，指的也是实际加载这个类的classLoader

3、每个线程绑定一个classLoader
