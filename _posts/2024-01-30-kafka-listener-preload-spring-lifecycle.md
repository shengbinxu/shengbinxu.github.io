---
layout: post
title: "在@KafkaListener启动之前需要做数据的预加载，该在Spring生命周期的哪个阶段做这个事情？"
date: 2024-01-30 21:52:00 +0800
description: "在Spring中消费Kafka数据时，最便捷的方法就是给方法加@KafkaListener注解。在数据消费逻辑中，需要先把一些配置信息预加载到内存中。…"
tags: [kafka, spring]
original_url: https://www.cnblogs.com/xushengbin/p/17998070
---
## 背景说明

1、在Spring中消费Kafka数据时，最便捷的方法就是给方法加@KafkaListener注解。在数据消费逻辑中，需要先把一些配置信息预加载到内存中。有同事就提了一个问题：如何保证在消费者执行前，预加载数据的代码一定能执行完？ 也就是说，要等待数据预加载完成之后，再执行消费逻辑。

大部分时候，我们在Bean属性赋值之后（afterPropertiesSet）进行数据预加载都是不会有问题的，但是也有特例。特例参考我前面的一篇文章： <https://www.cnblogs.com/xushengbin/p/17961565>

## 具体场景

我的数据预加载，是通过RestTemplate调用一个Http接口，请求到数据之后，存入内存中。  

RestTemplate结合ribbon实现负载均衡：

```java
	@Bean
    @LoadBalanced
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder.setConnectTimeout(Duration.ofMillis(1000))
                .setReadTimeout(Duration.ofMillis(30000)).build();
    }
```

如前述文章中所描述：  
 `@LoadBalanced` 的原理：在**所有bean都初始化完成之后**，再给RestTemplate添加一个拦截器。在拦截器中，把URL中的serviceName替换成真实的实例地址。

关键信息：所有bean都初始化完成之后，才会添加拦截器。  

也就是说，如果在afterPropertiesSet()中调用RestTemplate，就无法用到负载均衡的效果。因为这时候拦截器还没添加呢。

## 解决方案

因此，我的问题就变成了： 如何确保在Kafka消费者执行之前，“通过@LoadBalanced注解添加拦截器的操作”执行之后，进行数据预加载的工作？

本质就是Spring生命周期的问题。 （现在体会到：不吃透Spring生命周期，你就不能说你掌握了Spring框架）

1、Spring Kafka Consumer的启动时机，是在SmartLifecycle阶段完成的。<https://blog.csdn.net/huangdi1309/article/details/122097034>

2、“通过@LoadBalanced注解添加拦截器的操作” 是在SmartInitializingSingleton阶段（所有Bean实例化完成之后）完成的。

因此呢，我要在这两个阶段之间操作数据预加载操作才行。原因：  

1、需要保证在“通过@LoadBalanced注解添加拦截器的操作”之后，再去调用RestTemplate  

2、需要保证在Kafka消费者启动之前，完成数据预加载。

找寻了挺久，通过控制多个SmartLifecycle优先级的方式，可以满足该需求：

```java
@Component
public class ConfigPreLoad implements SmartLifecycle {
    @Autowired
    RestTemplate restTemplate;

    /**
     * 一定要保证该方法在loadBalancedRestTemplateInitializerDeprecated之后执行，并且在@KafkaListener之前执行(通过getPhase()定义优先级)。
     */
    @Override
    public void start() {
        // 调用RestTemplate进行数据预加载
    }

    @Override
    public void stop() {

    }

    @Override
    public boolean isRunning() {
        return false;
    }

    @Override
    public boolean isAutoStartup() {
        return SmartLifecycle.super.isAutoStartup();
    }

    @Override
    public void stop(Runnable callback) {
        SmartLifecycle.super.stop(callback);
    }

    @Override
    public int getPhase() {
        return Integer.MIN_VALUE;
    }
}
```

关键点是上面的`getPhase()` 方法，给它设定一个最小的值，就能保证它在Kafka消费者启动之前执行。 由于SmartLifecycle这个阶段是同步的，也就是说，只有等一个SmartLifecycle执行完，才会执行另外一个SmartLifecycle。

补充说明： `ApplicationRunner` 就是异步的。多个ApplicationRunner会同时执行，不会等待前一个结束。

## 如何核实上述三个环节的执行顺序呢？

1、在“通过@LoadBalanced注解添加拦截器的操作”加一个断点：  

org.springframework.cloud.client.loadbalancer.LoadBalancerAutoConfiguration

```java
	@Bean
	public SmartInitializingSingleton loadBalancedRestTemplateInitializerDeprecated(
			final ObjectProvider<List<RestTemplateCustomizer>> restTemplateCustomizers) {
		return () -> restTemplateCustomizers.ifAvailable(customizers -> {
			for (RestTemplate restTemplate : LoadBalancerAutoConfiguration.this.restTemplates) {
				for (RestTemplateCustomizer customizer : customizers) {
					customizer.customize(restTemplate);    // 这一行加断点
				}
			}
		});
	}
```

2、在ConfigPreLoad的start()方法的第一行、最后一行加断点

3、在org.springframework.kafka.config.KafkaListenerEndpointRegistry的start()方法加断点

```java
	@Override
	public void start() {
		for (MessageListenerContainer listenerContainer : getListenerContainers()) {
			startIfNecessary(listenerContainer);
		}
		this.running = true;
	}
```

很好地印证的前面生命周期的逻辑，这三步是按照顺序执行的。 第三步一定要等待第二步执行完成才会执行。
