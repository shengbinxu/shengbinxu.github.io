---
layout: post
title: "eureka注册中心知识点剖析"
date: 2024-01-17 22:35:00 +0800
description: "本文针对eureka的源码分析，基于的版本号："
tags: [eureka, 微服务]
original_url: https://www.cnblogs.com/xushengbin/p/17966538
---
## 背景说明

本文针对eureka的源码分析，基于的版本号：

```xml
<parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>2.7.14</version>
        <relativePath/> <!-- lookup parent from repository -->
    </parent>
 <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
            <version>3.1.7</version>
        </dependency>
```

## 知识点

### SmartLifecycle接口

在spring启动后，或者停止前，需要做一些操作，就可以实现该接口。  

在spring启动后，需要把应用注册到eureka server，服务停止前，需要从eureka server剔除该应用。实现方式就是实现了SmartLifecycle接口。

```java
public class EurekaAutoServiceRegistration
		implements AutoServiceRegistration, SmartLifecycle, Ordered, SmartApplicationListener {
	@Override
	public void start() {
		// only set the port if the nonSecurePort or securePort is 0 and this.port != 0
		if (this.port.get() != 0) {
			if (this.registration.getNonSecurePort() == 0) {
				this.registration.setNonSecurePort(this.port.get());
			}

			if (this.registration.getSecurePort() == 0 && this.registration.isSecure()) {
				this.registration.setSecurePort(this.port.get());
			}
		}

		// only initialize if nonSecurePort is greater than 0 and it isn't already running
		// because of containerPortInitializer below
		if (!this.running.get() && this.registration.getNonSecurePort() > 0) {

			this.serviceRegistry.register(this.registration);

			this.context.publishEvent(new InstanceRegisteredEvent<>(this, this.registration.getInstanceConfig()));
			this.running.set(true);
		}
	}

	@Override
	public void stop() {
		this.serviceRegistry.deregister(this.registration);
		this.running.set(false);
	}
}
```

SmartLifecycle 和[ApplicationListener](https://www.cnblogs.com/xushengbin/p/17961565)功能类似。

### @import注解

作用：可以用来动态加载一个Configuration文件，或者动态加载一个Bean  

使用场景：当项目启动后，还不确定要加载哪个bean时，就可以使用这种方式。  
 <https://zhuanlan.zhihu.com/p/147025312>

### spring.factories 文件

![image](/assets/images/posts/eureka-registry-internals/img-01.webp)

文件中，定义的是接口和接口的实现类。

在Spring启动过程中，不同时机会加载不同接口的实现类。

如当添加了@SpringBootApplication注解之后，就会自动加载EnableAutoConfiguration接口的实现类，spring boot的自动配置功能就是这么实现的。

### @EnableConfigurationProperties注解

<https://www.jianshu.com/p/7f54da1cb2eb>  

当我们定义一个类，这个类会映射到application.yaml中的配置，但是又不想把这个类声明成一个Bean，就可以通过@EnableConfigurationProperties把Properties类声明成一个bean

### 在spring boot2.7版本中，@EnableDiscoveryClient 注解已经没用了

![image](/assets/images/posts/eureka-registry-internals/img-02.webp)

即使不使用这个注解，classpath中有了eureka，也会进行服务注册。  

如果classpath中已经有了eureka，又想禁用服务注册，怎么办？

```properties
spring.cloud.service-registry.auto-registration.enabled = false
```

![image](/assets/images/posts/eureka-registry-internals/img-03.webp)

### spring框架自定义事件通知机制

场景：spring启动时，当应用程序注册到eureka server之后，需要通知DiscoveryClientHealthIndicator（健康指示器），告诉他已经注册完成。实现方式：  

（1）监听自定义事件

```java
public class DiscoveryClientHealthIndicator
		implements DiscoveryHealthIndicator, Ordered, ApplicationListener<InstanceRegisteredEvent<?>> {
	@Override
	public void onApplicationEvent(InstanceRegisteredEvent<?> event) {
		if (this.discoveryInitialized.compareAndSet(false, true)) {
			this.log.debug("Discovery Client has been initialized");
		}
	}
}
```

（2）发送事件：

```text
this.context.publishEvent(new InstanceRegisteredEvent<>(this, this.registration.getInstanceConfig()));
```

疑问：事件监听程序，运行在哪个线程中？

## eureka client 服务注册源码解析

1、/spring-cloud-netflix-eureka-client/3.1.7/spring-cloud-netflix-eureka-client-3.1.7-sources.jar!/META-INF/spring.factories 中定义自动配置类

```properties
org.springframework.boot.autoconfigure.EnableAutoConfiguration=org.springframework.cloud.netflix.eureka.EurekaClientAutoConfiguration
```

2、接着就会注入EurekaClientAutoConfiguration中的bean

```java
	@Bean
	@ConditionalOnBean(AutoServiceRegistrationProperties.class)
	@ConditionalOnProperty(value = "spring.cloud.service-registry.auto-registration.enabled", matchIfMissing = true)
	public EurekaAutoServiceRegistration eurekaAutoServiceRegistration(ApplicationContext context,
			EurekaServiceRegistry registry, EurekaRegistration registration) {
		return new EurekaAutoServiceRegistration(context, registry, registration);
	}
```

3、在EurekaAutoServiceRegistration中，实现了SmartLifecycle的start、stop接口。因此，应用启动、停止过程中，就会自动进行服务的注册、注销。

```java
	@Override
	public void start() {
		// only initialize if nonSecurePort is greater than 0 and it isn't already running
		// because of containerPortInitializer below
		if (!this.running.get() && this.registration.getNonSecurePort() > 0) {

			this.serviceRegistry.register(this.registration);

			this.context.publishEvent(new InstanceRegisteredEvent<>(this, this.registration.getInstanceConfig()));
			this.running.set(true);
		}
	}
```

4、关键代码this.serviceRegistry.register，继续追踪，会执行com.netflix.appinfo.ApplicationInfoManager中的setInstanceStatus()方法：

![image](/assets/images/posts/eureka-registry-internals/img-04.webp)

5、通过线程池，调用InstanceInfoReplicator.run()方法：

![image](/assets/images/posts/eureka-registry-internals/img-05.webp)

6、查找可用的eureka server，发送请求，进行实例注册

![image](/assets/images/posts/eureka-registry-internals/img-06.webp)

## 自问自答

### eureka client注册到server时，负载均衡机制是怎样的？如果一个eureka server挂了，会发生什么？

1、选择server instance的逻辑：

```java
	@Override
    public List<AwsEndpoint> getClusterEndpoints() {
        List<AwsEndpoint>[] parts = ResolverUtils.splitByZone(delegate.getClusterEndpoints(), myZone);
        List<AwsEndpoint> myZoneEndpoints = parts[0];
        List<AwsEndpoint> remainingEndpoints = parts[1];
        List<AwsEndpoint> randomizedList = randomizeAndMerge(myZoneEndpoints, remainingEndpoints);
        if (!zoneAffinity) {
            Collections.reverse(randomizedList);
        }

        logger.debug("Local zone={}; resolved to: {}", myZone, randomizedList);

        return randomizedList;
    }
```

会选择和client同区域的server

2、如果有多个待选instance，当需要向server发送请求时，如果遇到server响应错误（500），会重试，请求下一台server

```text
private final AtomicReference<EurekaHttpClient> delegate = new AtomicReference<>();

int endpointIdx = 0;
for (int retry = 0; retry < numberOfRetries; retry++) {
    // 记录当前使用的http client（代表当前正在使用的eureka server）
    EurekaHttpClient currentHttpClient = delegate.get();
    EurekaEndpoint currentEndpoint = null;
    // 如果没有可用的server，就进行查询。如果已经找到了，下次就直接使用
    if (currentHttpClient == null) {
        if (candidateHosts == null) {
            candidateHosts = getHostCandidates();
            if (candidateHosts.isEmpty()) {
                throw new TransportException("There is no known eureka server; cluster server list is empty");
            }
        }
        if (endpointIdx >= candidateHosts.size()) {
            throw new TransportException("Cannot execute request on any known server");
        }
        // 如果当前没有可用实例（或者当前实例请求失败了），就取下一个server，进行尝试
        currentEndpoint = candidateHosts.get(endpointIdx++);
        currentHttpClient = clientFactory.newClient(currentEndpoint);
    }

    try {
        EurekaHttpResponse<R> response = requestExecutor.execute(currentHttpClient);
        if (serverStatusEvaluator.accept(response.getStatusCode(), requestExecutor.getRequestType())) {
            delegate.set(currentHttpClient);
            if (retry > 0) {
                logger.info("Request execution succeeded on retry #{}", retry);
            }
            return response;
        }
        logger.warn("Request execution failure with status code {}; retrying on another server if available", response.getStatusCode());
    } catch (Exception e) {
        logger.warn("Request execution failed with message: {}", e.getMessage());  // just log message as the underlying client should log the stacktrace
    }

    // Connection error or 5xx from the server that must be retried on another server
    // 如果使用当前server请求失败了，就把currentHttpClient置为null，下次循环时，重新查找可用server
    delegate.compareAndSet(currentHttpClient, null);
    if (currentEndpoint != null) {
        quarantineSet.add(currentEndpoint);
    }
}
throw new TransportException("Retry limit reached; giving up on completing the request");
```

### eureka集群是点对点架构（没有master），会存在数据写入冲突的问题吗？

eureka架构，满足分布式原理cap中的ap，不满足一致性。理由：  

1、往eureka中写入的数据（注册一个服务），要过一段时间才能查询到。写入之后不能立即查询到，所以不是一致性。是最终一致性  

2、在多实例eureka集中中，当client注册到一个节点之后，它会异步地把数据发送到其他所有节点。由于是异步的，如果数据写入A节点，从B节点查询时肯定是有延迟的。

不会存在写入冲突。理由：  

1、同一个key（client实例信息），正常情况下只会写入第一个instance （eureka.client.serviceUrl.defaultZone中第一个server）。  

2、如果遇到第一个server挂了，会尝试请求下一个server。此时，同一个key会写入不同的instance。由于服务注册的数据写入都是幂等的（多次insert效果一样、没有递增操作），因为不存在数据冲突的问题。

## 如何快速阅读java源码？

带着问题：“eureka server不同实例之间如何复制数据？”，来分享下如果快速找到相关的源码？

### 1、看源码最开始最懵逼的是，不知道相关逻辑的代码在哪里？

#### 途径一：把spring日志改为debug模式，通过关键日志，推测相关代码逻辑在哪个文件

#### 途径二：通过wireshark抓包，查看服务间都调用了哪些http接口，然后在代码中搜索相关接口。

比如客户端注册的是eureka 8761端口的实例，从结果看，很快8762、8763两个实例都有该app的信息了。

那么，我就通过wireshark监听和端口8762之间的通信：

![image](/assets/images/posts/eureka-registry-internals/img-07.webp)

看到在请求8762端口上的`POST /eureka/peerreplication/batch/ HTTP/1.1`接口，参数是：

![image](/assets/images/posts/eureka-registry-internals/img-08.webp)

看起来，8761实例通过调用上面的接口，发app信息同步到了8762

搜索接口名称，找到了相关代码之后，继续分析：

```java
private void replicateToPeers(Action action, String appName, String id,
                                  InstanceInfo info /* optional */,
                                  InstanceStatus newStatus /* optional */, boolean isReplication) {
        Stopwatch tracer = action.getTimer().start();
        try {
            if (isReplication) {
                numberOfReplicationsLastMin.increment();
            }
            // If it is a replication already, do not replicate again as this will create a poison replication
            if (peerEurekaNodes == Collections.EMPTY_LIST || isReplication) {
                return;
            }

            for (final PeerEurekaNode node : peerEurekaNodes.getPeerEurekaNodes()) {
                // If the url represents this host, do not replicate to yourself.
                if (peerEurekaNodes.isThisMyUrl(node.getServiceUrl())) {
                    continue;
                }
                replicateInstanceActionsToPeers(action, appName, id, info, newStatus, node);
            }
        } finally {
            tracer.stop();
        }
    }
```

另外，这里的复制是异步进行的。具体操作方式（记得不太清了）：  

1、建一个阻塞队列。当有新客户端注册时，把实例信息发往队列中。  

2、另外一个线程，尝试从阻塞队列中读取数据，并设置一个超时时间。如果超时未读到数据，就继续循环等到，直到有新数据。

详细代码就不再分析了。

## 参考

<https://www.cnblogs.com/rickiyang/p/11802413.html>

[<https://blog.wangqi.love/articles/Spring-Cloud/Eureka(>五)——高可用.html](https://blog.wangqi.love/articles/Spring-Cloud/Eureka(%E4%BA%94%29%E2%80%94%E2%80%94%E9%AB%98%E5%8F%AF%E7%94%A8.html)

<https://cloud.spring.io/spring-cloud-netflix/reference/html/#netflix-eureka-server-starter>

<https://github.com/cfregly/fluxcapacitor/wiki/NetflixOSS-FAQ#eureka-service-discovery-load-balancer>

<https://groups.google.com/g/eureka_netflix>

<https://github.com/doocs/advanced-java/blob/main/docs/micro-services/how-eureka-enable-service-discovery-and-service-registration.md>
