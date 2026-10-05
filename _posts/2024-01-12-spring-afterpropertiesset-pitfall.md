---
layout: post
title: "spring boot遇到的坑：在afterPropertiesSet()中执行逻辑异常"
date: 2024-01-12 21:01:00 +0800
description: "结合@LoadBalanced和RestTemplate，实现服务发现。"
tags: [spring, 线上排查]
original_url: https://www.cnblogs.com/xushengbin/p/17961565
---
## 问题描述

```java
@Bean
@LoadBalanced
public RestTemplate restTemplate(SpringClientFactory clientFactory, LoadBalancerClient loadBalancer) {
    return new RestTemplate();
}

@Service
public class DeviceProtocolServiceImpl  implements InitializingBean {
	public void afterPropertiesSet() throws Exception {
		 String url = "http://iot-server/protocol/getAllDeviceProtocol";
		 JSONObject res = restTemplate.exchange(url, HttpMethod.GET, null, JSONObject.class).getBody();
	}
}
```

结合@LoadBalanced和RestTemplate，实现服务发现。  

但是请求时，url中的service-name无法被替换成真实的host。

## 原因

调试了很久，终于发现了原因：  

spring cloud netflix 是采用拦截器的方式自动替换url中的service name的，当通过afterPropertiesSet （DeviceProtocolServiceImpl 这个bean属性赋值之后）触发url请求时，其他bean还未注入到容器中。 这里的问题在于，往RestTemplate中设置拦截器的相关逻辑还未来得及执行，就调用restTemplate.exchange()方法。

## 解决方案

```java
@Service
public class DeviceProtocolServiceImpl implements DeviceProtocolService, ApplicationListener<ApplicationStartedEvent> {

    @Autowired
    RestTemplate restTemplate;

    Logger logger = LoggerFactory.getLogger(DeviceProtocolServiceImpl.class);

    //    @Override
    public void onApplicationEvent(ApplicationStartedEvent event) {
        logger.info(event.toString());
        String url = "http://iot-server/protocol/getAllDeviceProtocol";
        try {
            JSONObject res = restTemplate.exchange(url, HttpMethod.GET, null, JSONObject.class).getBody();
            logger.info(res.toString());
        } catch (Exception e) {
            logger.error(e.getMessage());
        }
        return;
    }
```

在spring项目启动完成之后，再去执行相关逻辑，就ok了。

## 源码分析

<https://blog.csdn.net/f641385712/article/details/100788040>

1、调用restTemplate.exchange过程中，首先会创建一个request对象。此时，如果restTemplate中有拦截器的话，就会使用InterceptingClientHttpRequestFactory来创建request，否则的话会使用默认工厂.

```java
@Override
	public ClientHttpRequestFactory getRequestFactory() {
		List<ClientHttpRequestInterceptor> interceptors = getInterceptors();
		if (!CollectionUtils.isEmpty(interceptors)) {
			ClientHttpRequestFactory factory = this.interceptingRequestFactory;
			if (factory == null) {
				factory = new InterceptingClientHttpRequestFactory(super.getRequestFactory(), interceptors);
				this.interceptingRequestFactory = factory;
			}
			return factory;
		}
		else {
			return super.getRequestFactory();
		}
	}
```

因此呢，restTemplate中interceptors属性赋值至关重要。

```java
	private final List<ClientHttpRequestInterceptor> interceptors = new ArrayList<>();
```

这个属性是如何赋值的呢？

```java
@Bean
public SmartInitializingSingleton loadBalancedRestTemplateInitializerDeprecated(
		final ObjectProvider<List<RestTemplateCustomizer>> restTemplateCustomizers) {
	return () -> restTemplateCustomizers.ifAvailable(customizers -> {
		for (RestTemplate restTemplate : LoadBalancerAutoConfiguration.this.restTemplates) {
			for (RestTemplateCustomizer customizer : customizers) {
				customizer.customize(restTemplate);
			}
		}
	});
}
```

**知识点1:**

> SmartInitializingSingleton中只有一个接口afterSingletonsInstantiated()，其作用是是 在spring容器管理的所有单例对象（非懒加载对象）初始化完成之后调用的回调接口。

上面定义了一个SmartInitializingSingleton bean，在所有单例bean初始化完成之后才会执行。

> bean生命周期：  
>
> 实例化  
>
> 设置bean的Aware  
>
> BeanPostProcessor.postProcessBeforeInitialization(Object bean, String beanName)  
>
> InitializingBean.afterPorpertiesSet  
>
> BeanPostProcessor.postProcessAfterInitialization(Object bean, String beanName)  
>
> SmartInitializingSingleton.afterSingletonsInstantiated  
>
> SmartLifecycle.start  
>
> bean已经在spring容器的管理下，可以做我们想做的事  
>
> SmartLifecycle.stop(Runnable callback)  
>
> DisposableBean.destroy()

关键点：SmartInitializingSingleton  是在所有bean初始化完成之后调用，而我最开始的错误用法（InitializingBean）是在当前的bean属性 赋值之后调用的，其他bean这时候还没影呢。

所有bean初始化完成之后，调用SmartInitializingSingleton.afterSingletonsInstantiated()方法，会执行：

```text
for (RestTemplate restTemplate : LoadBalancerAutoConfiguration.this.restTemplates) {
			for (RestTemplateCustomizer customizer : customizers) {
				customizer.customize(restTemplate);
			}
		}
```

关键点在LoadBalancerAutoConfiguration.this.restTemplates：

```java
public class LoadBalancerAutoConfiguration {

	@LoadBalanced
	@Autowired(required = false)
	private List<RestTemplate> restTemplates = Collections.emptyList();
}
```

**知识点2:**

![image](/assets/images/posts/spring-afterpropertiesset-pitfall/img-01.webp)

第一次明白了这组注解的含义：

```java
@LoadBalanced
@Autowired(required = false)
```

最开始的代码中，我们也提到了，给restTemplate bean增加了@LoadBalanced注释：

```java
@Bean
@LoadBalanced
public RestTemplate restTemplate(SpringClientFactory clientFactory, LoadBalancerClient loadBalancer) {
    return new RestTemplate();
}
```

因此呢，这里LoadBalancerAutoConfiguration.restTemplates属性的值，就是带RestTemplate类型、并且带@LoadBalanced注解的bean的列表。

## 总结

1、我出错的原因，就是在SmartInitializingSingleton.afterSingletonsInstantiated()方法还未来得及调用的时候，就调用了restTemplate.exchange()  

2、当执行的代码逻辑依赖其他bean时，一定要在所有bean都注入完成之后再执行。
