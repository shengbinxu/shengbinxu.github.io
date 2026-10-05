---
layout: post
title: "spring cloud bus"
date: 2024-09-25 17:27:00 +0800
description: "微服务一般都采用集群方式部署，而且在高并发下经常需要对服务进行扩容、缩容、上线、下线的操作。比如我们需要更新配置，又或者需要同时失效所有服务器上的某个缓存，需要向所有相关的服务器发送命令…"
tags: [spring cloud, 微服务]
original_url: https://www.cnblogs.com/xushengbin/p/18431769
---
<https://cloud.tencent.com/developer/article/1669299>

微服务一般都采用集群方式部署，而且在高并发下经常需要对服务进行扩容、缩容、上线、下线的操作。比如我们需要更新配置，又或者需要同时失效所有服务器上的某个缓存，需要向所有相关的服务器发送命令，此时就可以选择使用 Spring Cloud Bus 了。

总的来说，就是在我们需要把一个操作散发到所有后端相关服务器的时候，就可以选择使用 Spring Cloud Bus 了。
