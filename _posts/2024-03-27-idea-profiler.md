---
layout: post
title: "Java 程序性能分析利器：IDEA Profiler，相见恨晚"
date: 2024-03-27 21:34:00 +0800
description: "一个 java web api，耗时 2s，但是db 300ms 就返回了，时间到底耗费在哪里呢。"
tags: [java, 性能]
original_url: https://www.cnblogs.com/xushengbin/p/18100300
---
一个 java web api，耗时 2s，但是db 300ms 就返回了，时间到底耗费在哪里呢。

当我最终定位下来，是因为db 返回了5M数据跨局域网传输大概需要 1s，导致的。  

一行行跟踪源码，很耽误时间。

后来遇到了IDEA Profiler （IDEA IDE 自带的性能分析工具），简直太好用了。  
 <https://www.jetbrains.com/pages/intellij-idea-profiler/>

放几个截图：

![image](/assets/images/posts/idea-profiler/img-01.webp)

IDEA 直接展示了某一个函数的执行时间，进入这个函数，又可以看到函数内部哪里最耗时。通过这种方式，1 分钟就能定位到问题。

注意：右侧可以切换是显示 cpu 时间，还是总时间（包含网络 IO、磁盘 IO 、内存读取时间）。

![image](/assets/images/posts/idea-profiler/img-02.webp)

点击左侧的2284ms，可以看到`call.execute()`耗时 481ms，而`parserResponse` 花费 1800ms
