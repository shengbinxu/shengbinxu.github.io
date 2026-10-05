---
layout: post
title: "java validation"
date: 2023-12-19 07:09:00 +0800
description: "spring boot项目中，使用hibernate validator作为java bean validation标准的一个实现。"
tags: [java, spring]
original_url: https://www.cnblogs.com/xushengbin/p/17911292.html
---
spring boot项目中，使用hibernate validator作为java bean validation标准的一个实现。

<https://docs.jboss.org/hibernate/validator/6.1/reference/en-US/html_single/>

## # 问题一：hibernate validator是如何注入进框架的？

我猜想应该也是通过bean注入的，于是去找hibernate autoconfigure相关代码，没找到。

网上也没搜到相关答案（估计是我关键字的问题）

在启动spring boot项目时，最开始显示的就是“background-preinit hibernate validator” 相关log。于是就顺着这个线索找了下去。

进入 org.springframework.boot.autoconfigure.BackgroundPreinitializer 这个类：

```java
@Override
public void run() {
    runSafely(new ConversionServiceInitializer());
    runSafely(new ValidationInitializer());
    runSafely(new MessageConverterInitializer());
    runSafely(new JacksonInitializer());
    runSafely(new CharsetInitializer());
    preinitializationComplete.countDown();
}
```

继续追踪 `new ValidationInitializer()` ：

```java
private List<ValidationProvider<?>> loadProviders(ClassLoader classloader) {
    ServiceLoader<ValidationProvider> loader = ServiceLoader.load( ValidationProvider.class, classloader );
    Iterator<ValidationProvider> providerIterator = loader.iterator();
    List<ValidationProvider<?>> validationProviderList = new ArrayList<>();
    while ( providerIterator.hasNext() ) {
       try {
          validationProviderList.add( providerIterator.next() );
       }
       catch ( ServiceConfigurationError e ) {
          // ignore, because it can happen when multiple
          // providers are present and some of them are not class loader
          // compatible with our API.
       }
    }
    return validationProviderList;
}
```

这个函数返回的 `validationProviderList` 中的内容如下：

![](/assets/images/posts/java-bean-validation/img-01.png)

此时已经加载了HibernateValidator类。找到关键点了。那么HibernateValidator是如何加载进来的呢？

ServiceLoader&lt;ValidationProvider&gt; loader = ServiceLoader.load( ValidationProvider.class, classloader );

这里用到了Java SPI（Service Provider Interface）机制。

<https://zhuanlan.zhihu.com/p/67665359>

> SPI全称Service Provider Interface，是Java提供的一套用来被第三方实现或者扩展的API，它可以用来启用框架扩展和替换组件。
>
> Java SPI 实际上是“基于接口的编程＋策略模式＋配置文件”组合实现的动态加载机制，提供了通过interface寻找implement的方法。类似于IOC的思想，将装配的控制权移到程序之外，从而实现解耦。
>
> 适应场景：调用者根据需要，使用、扩展或替换实现策略。
>
> 使用Java SPI需要符合的约定：
>
> 1. Service provider提供Interface的具体实现后，在目录META-INF/services下的文件(以Interface全路径命名)中添加具体实现类的全路径名；
> 2. 接口实现类的jar包存放在使用程序的classpath中；
> 3. 使用程序使用ServiceLoader动态加载实现类(根据目录META-INF/services下的配置文件找到实现类的全限定名并调用classloader来加载实现类到JVM);
> 4. SPI的实现类必须具有无参数的构造方法。

几个关键点：

1. HibernateValidator 的 jar 包需要放在 classpath 中。spring boot 项目中，通过引入 spring-boot-starter-validation 依赖，就把 HibernateValidator jar 包放入 classpath 了。

2. HibernateValidator jar 包中，在目录 META-INF/services 下，需要创建文件，文件名以 Interface 全路径命名，文件内容中添加具体实现类的全路径名。

![](/assets/images/posts/java-bean-validation/img-02.png)

3、 使用ServiceLoader api加载ValidationProvider（Validation提供商，就是Hibernate）

## spring框架中使用

<https://docs.spring.io/spring-framework/reference/core/validation/beanvalidation.html#validation-beanvalidation-spring-inject>
