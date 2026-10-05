---
layout: post
title: "Java Mock 框架Mockito背后的原理"
date: 2024-09-25 10:57:00 +0800
description: "mock了类EnvUtil之后，setEnvironment方法的参数始终为null。明明传的是一个对象。"
tags: [java, 单元测试]
original_url: https://www.cnblogs.com/xushengbin/p/18430887
---
## 遇到的问题

```text
MockedStatic<EnvUtil> envUtilMockedStatic;
envUtilMockedStatic = Mockito.mockStatic(EnvUtil.class);
EnvUtil.setEnvironment(new StandardEnvironment());
```

mock了类EnvUtil之后，setEnvironment方法的参数始终为null。明明传的是一个对象。

## 答案

![image](/assets/images/posts/mockito-internals/img-01.png)

“这个操作会创建一个 EnvUtil 类的子类，并且所有对 EnvUtil 的静态方法的调用都会被转发到这个子类” 这个背后的原理：

![image](/assets/images/posts/mockito-internals/img-02.png)

## 继续深究

1、经过验证，EnvUtil的类加载器还是应用类加载器，并不是自定义加载器。  

2、还是不理解为啥参数是null，执行过程是怎样
