---
layout: post
title: "eureka重启后py_eureka_client库心跳包往eureka slave节点复制失败问题排查"
date: 2024-07-17 21:43:00 +0800
description: "peer1节点（python程序往这个节点注册数据）日志："
tags: [eureka, 微服务]
original_url: https://www.cnblogs.com/xushengbin/p/18308356
---
## 问题描述

peer1节点（python程序往这个节点注册数据）日志：

```text
12763988:07-17 18:39:45.268 WARN  [] -- [TaskBatchingWorker-target_10.29.46.118-8] c.n.e.c.ReplicationTask:35: The replication of task LBS-PROXY/10.30.37.85:lbx-proxy:8089:StatusUpdate@10.29.46.118 failed with response code 404
```

peer2节点日志：

```text
07-17 18:39:51.131 WARN  [] -- [http-nio-12000-exec-8] c.n.e.r.InstanceResource:166: Instance not found: LBS-PROXY/10.30.37.85:lbs-proxy:8095
```

python程序注册到peer1，往peer2复制时出错了。  

此时，如果网关从peer2节点读取注册信息，就会出现读不到进而导致无可用实例的问题。

经过总结，发现每次重启eureka节点后，python客户端都会出现这样的问题。

另外，每次py\_eureka\_client客户端出现问题时，通过spring boot eureka客户端注册的app，都是正常的。

## 关键问题：为啥只有python程序会有这个问题呢？

因为python注册时，使用的api和java service不一样。

python程序心跳log：

```text
07-17 20:44:54.095 WARN  [] -- [http-nio-12000-exec-7] c.n.e.r.InstanceResource:166: Instance not found: AIMARKEDSPOI/10.30.37.85:aimarkedspoi:7000
07-17 20:45:24.155 WARN  [] -- [http-nio-12000-exec-3] c.n.e.r.InstanceResource:166: Instance not found: AIMARKEDSPOI/10.30.37.85:aimarkedspoi:7000
07-17 20:45:54.189 WARN  [] -- [http-nio-12000-exec-4] c.n.e.r.InstanceResource:166: Instance not found: AIMARKEDSPOI/10.30.37.85:aimarkedspoi:7000
07-17 20:46:24.234 WARN  [] -- [http-nio-12000-exec-1] c.n.e.r.InstanceResource:166: Instance not found: AIMARKEDSPOI/10.30.37.85:aimarkedspoi:7000
07-17 20:46:54.277 WARN  [] -- [http-nio-12000-exec-3] c.n.e.r.InstanceResource:166: Instance not found: AIMARKEDSPOI/10.30.37.85:aimarkedspoi:7000
07-17 20:47:24.320 WARN  [] -- [http-nio-12000-exec-7] c.n.e.r.InstanceResource:166: Instance not found: AIMARKEDSPOI/10.30.37.85:aimarkedspoi:7000
07-17 20:47:54.367 WARN  [] -- [http-nio-12000-exec-5] c.n.e.r.InstanceResource:166: Instance not found: AIMARKEDSPOI/10.30.37.85:aimarkedspoi:700
```

Java 心跳log:

```text
07-17 20:49:13.184 DEBUG [] -- [http-nio-12000-exec-10] o.s.c.n.e.s.InstanceRegistry:144: renew ACCOUNT serverId tidedb-ranger5:account:10007, isReplication {}false
07-17 20:49:43.187 DEBUG [] -- [http-nio-12000-exec-3] o.s.c.n.e.s.InstanceRegistry:144: renew ACCOUNT serverId tidedb-ranger5:account:10007, isReplication {}false
07-17 20:50:13.190 DEBUG [] -- [http-nio-12000-exec-4] o.s.c.n.e.s.InstanceRegistry:144: renew ACCOUNT serverId tidedb-ranger5:account:10007, isReplication {}false
07-17 20:50:43.193 DEBUG [] -- [http-nio-12000-exec-10] o.s.c.n.e.s.InstanceRegistry:144: renew ACCOUNT serverId tidedb-ranger5:account:10007, isReplication {}false
07-17 20:51:13.196 DEBUG [] -- [http-nio-12000-exec-8] o.s.c.n.e.s.InstanceRegistry:144: renew ACCOUNT serverId tidedb-ranger5:account:10007, isReplication {}false
07-17 20:51:43.200 DEBUG [] -- [http-nio-12000-exec-5] o.s.c.n.e.s.InstanceRegistry:144: renew ACCOUNT serverId tidedb-ranger5:account:10007, isReplication {}false
07-17 20:52:13.203 DEBUG [] -- [http-nio-12000-exec-6] o.s.c.n.e.s.InstanceRegistry:144: renew ACCOUNT serverId tidedb-ranger5:account:10007, isReplication {}false
```

## 分析master节点重启后，python程序注册过程

```text
07-17 18:41:21.089 WARN  [] -- [http-nio-12000-exec-1] c.n.e.r.InstanceResource:166: Instance not found: LBS-PROXY/10.30.37.85:lbs-proxy:8095
07-17 18:41:21.108 WARN  [] -- [http-nio-12000-exec-9] c.n.e.r.InstanceResource:166: Instance not found: LBS-PROXY/10.30.37.85:lbs-proxy:8095
07-17 18:41:21.118 DEBUG [] -- [http-nio-12000-exec-10] o.s.c.n.e.s.InstanceRegistry:144: register LBS-PROXY, vip lbs-proxy, leaseDuration 90, isReplication false
07-17 18:41:21.118 INFO  [] -- [http-nio-12000-exec-10] c.n.e.r.AbstractInstanceRegistry:267: Registered instance LBS-PROXY/10.30.37.85:lbs-proxy:8095 with status UP (replication=false)
```

此时，会把注册信息推送给 slave 节点。slave 节点 log 如下：

```text
07-17 18:41:21.149 DEBUG [] -- [http-nio-12000-exec-8] o.s.c.n.e.s.InstanceRegistry:144: register LBS-PROXY, vip lbs-proxy, leaseDuration 90, isReplication true
07-17 18:41:21.149 INFO  [] -- [http-nio-12000-exec-8] c.n.e.r.AbstractInstanceRegistry:267: Registered instance LBS-PROXY/10.30.37.85:lbs-proxy:8095 with status UP (replication=true)
```

作为对比，java程序心跳包：

```text
07-17 18:41:20.982 DEBUG [] -- [http-nio-12000-exec-7] o.s.c.n.e.s.InstanceRegistry:144: renew TIMER-REPORT-JOBS serverId iZuf65ifav846rhkdgpzthZ:timer-report-jobs:10012, isReplication {}false
07-17 18:41:20.983 WARN  [] -- [http-nio-12000-exec-7] c.n.e.r.AbstractInstanceRegistry:354: DS: Registry: lease doesn't exist, registering resource: TIMER-REPORT-JOBS - iZuf65ifav846rhkdgpzthZ:timer-report-jobs:10012
07-17 18:41:20.983 WARN  [] -- [http-nio-12000-exec-7] c.n.e.r.InstanceResource:116: Not Found (Renew): TIMER-REPORT-JOBS - iZuf65ifav846rhkdgpzthZ:timer-report-jobs:10012
07-17 18:41:20.987 DEBUG [] -- [http-nio-12000-exec-8] o.s.c.n.e.s.InstanceRegistry:144: register TIMER-REPORT-JOBS, vip timer-report-jobs, leaseDuration 90, isReplication false
07-17 18:41:20.988 INFO  [] -- [http-nio-12000-exec-8] c.n.e.r.AbstractInstanceRegistry:267: Registered instance TIMER-REPORT-JOBS/iZuf65ifav846rhkdgpzthZ:timer-report-jobs:10012 with status UP (replication=false)
```

## slave节点重启后，python程序注册过程

模拟slave节点杀死后启动过程，看日志：

```text
07-17 21:21:16.957 WARN  [] -- [http-nio-12000-exec-1] c.n.e.r.InstanceResource:166: Instance not found: LBS-PROXY/10.30.37.85:lbs-proxy:8095
```

有这条消息的前提是，python程序LBS-PROXY在往master发送心跳，然后master同步到slave。 master对应的日志:

```text
07-17 21:21:04.454 INFO  [] -- [http-nio-12000-exec-7] c.n.e.r.InstanceResource:174: Status updated: LBS-PROXY - 10.30.37.85:lbs-proxy:8095 - UP
07-17 21:21:17.353 WARN  [] -- [TaskBatchingWorker-target_10.29.46.118-5] c.n.e.c.ReplicationTask:35: The replication of task LBS-PROXY/10.30.37.85:lbs-proxy:8095:StatusUpdate@10.29.46.118 failed with response code 404
```

作为对比java程序的日志：

```text
07-17 21:21:16.956 DEBUG [] -- [http-nio-12000-exec-1] o.s.c.n.e.s.InstanceRegistry:144: renew DEVICE-DATA-WRITER-10CYCLE serverId tidedb-ranger5:device-data-tidedb-writer-10cycle:12022, isReplication {}true
07-17 21:21:16.957 WARN  [] -- [http-nio-12000-exec-1] c.n.e.r.AbstractInstanceRegistry:354: DS: Registry: lease doesn't exist, registering resource: DEVICE-DATA-WRITER-10CYCLE - tidedb-ranger5:device-data-tidedb-writer-10cycle:12022
07-17 21:21:16.957 WARN  [] -- [http-nio-12000-exec-1] c.n.e.r.InstanceResource:116: Not Found (Renew): DEVICE-DATA-WRITER-10CYCLE - tidedb-ranger5:device-data-tidedb-writer-10cycle:12022
```

它对应的“java程序device-data-tidedb-writer往master发送的心跳包”和上面是一样的。

区别看出来吧：

- python的心跳包（Status updated: LBS-PROXY - 10.30.37.85:lbs-proxy:8095 - UP） 复制到slave节点（首次启动）时发现没这个app到信息，然后就一直提示“Instance not found”，它不会自动去做insert的逻辑。
- 而java的心跳包（renew）复制到slave节点后，它会自动注册app（Registry: lease doesn't exist, registering resource）。

通过这里的分析我们就明白为啥python的eureka客户端（py\_eureka\_client）在slave节点重启后会有掉线的问题了。

## 如何避免python程序注册异常呢？

1、避免复制失败的问题。

- 从节点一定要在master节点之前重启，就不会有问题。
- 如果发现从节点出现问题，再重启一下从节点就可以了。

2、网关也从master节点（peer1）读取数据，尽量不让slave节点参与（除非master挂了）。

## eureka相关源码

renew（心跳包）代码：  

org.springframework.cloud.netflix.eureka.server.InstanceRegistry#renew

```java
public boolean renew(final String appName, final String serverId,
			boolean isReplication) {
		log("renew " + appName + " serverId " + serverId + ", isReplication {}"
				+ isReplication);
		List<Application> applications = getSortedApplications();
		for (Application input : applications) {
			if (input.getName().equals(appName)) {
				InstanceInfo instance = null;
				for (InstanceInfo info : input.getInstances()) {
					if (info.getId().equals(serverId)) {
						instance = info;
						break;
					}
				}
				publishEvent(new EurekaInstanceRenewedEvent(this, appName, serverId,
						instance, isReplication));
				break;
			}
		}
		return super.renew(appName, serverId, isReplication);
	}
```
