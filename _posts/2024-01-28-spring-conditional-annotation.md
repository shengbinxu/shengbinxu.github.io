---
layout: post
title: "spring框架 - 通过 @Conditional注解来条件化地应用注解"
date: 2024-01-28 11:32:00 +0800
description: "什么意思呢？ 参考chatGPT的回答："
tags: [spring, 源码]
original_url: https://www.cnblogs.com/xushengbin/p/17992652
---
## 条件化地应用注解

什么意思呢？ 参考chatGPT的回答：  

Spring 框架允许您通过 @Conditional 注解来条件化地应用注解。@Conditional 注解用于在特定条件下决定是否应用某个注解或配置。这在很多情况下是非常有用的，特别是在需要根据应用的运行时环境或配置来动态地选择性地应用某些注解时。

下面是一个示例，展示了如何使用 @Conditional 注解：

```java
import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.context.annotation.Conditional;
import org.springframework.core.type.AnnotatedTypeMetadata;

import java.util.Map;

public class MyCondition implements Condition {
    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
        // 这里可以根据特定条件来确定是否应用注解
        Map<String, Object> attributes = metadata.getAnnotationAttributes(ConditionalAnnotation.class.getName());
        if (attributes != null) {
            // 在这里可以检查条件并返回相应的布尔值
            // 例如，可以从 Spring 的环境中获取属性，然后根据属性值决定是否匹配条件
            return true; // 或者根据条件返回 true 或 false
        }
        return false;
    }
}

@Conditional(MyCondition.class)
public @interface ConditionalAnnotation {
    // 这是一个标记注解，只有在 MyCondition 中的 matches 方法返回 true 时才会应用
}
```

在这个例子中，@ConditionalAnnotation 注解会根据 MyCondition 类中的条件来决定是否应用。MyCondition 类实现了 Condition 接口，其中的 matches() 方法用于定义特定的条件。根据实际需要，你可以在 matches() 方法中编写逻辑来确定是否应该应用该注解。

通过这种方式，你可以动态地根据应用的环境、配置或其他条件来控制哪些注解会生效。

即通过这种方式，我们可以通过配置文件来控制是否运用某一个注解。

## 实战

用过spring-boot-actuator的同学，可能知道，actuator可以把spring boot的指标数据发送到prometheus或者InfluxDB第三方存储服务。

可以通过配置文件来控制指标数据要发送到哪里。

```yaml
management:
    metrics:
		export:
		  defaults:
			enabled: false
		  influx:
			enabled: true
		  prometheus:
			enabled: true
```

这段配置，告诉actuator，指标数据要发往influxDB，不发往prometheus。

那么，代码层面是如何控制发与不发呢？这里就涉及到“条件化应用注解”。

下面进行源码分析（基于spring boot 2.7）：

```java
@AutoConfiguration(
		before = { CompositeMeterRegistryAutoConfiguration.class, SimpleMetricsExportAutoConfiguration.class },
		after = MetricsAutoConfiguration.class)
@ConditionalOnBean(Clock.class)
@ConditionalOnClass(InfluxMeterRegistry.class)
@ConditionalOnEnabledMetricsExport("influx")
@EnableConfigurationProperties(InfluxProperties.class)
public class InfluxMetricsExportAutoConfiguration {

}
```

这里的关键代码`@ConditionalOnEnabledMetricsExport("influx")`  

当它返回false时，就不对InfluxMetricsExportAutoConfiguration这个bean进行自动配置。返回true时，就进行自动配置。

@ConditionalOnEnabledMetricsExport 的源码如下：

```java
@Retention(RetentionPolicy.RUNTIME)
@Target({ ElementType.TYPE, ElementType.METHOD })
@Documented
@Conditional(OnMetricsExportEnabledCondition.class)
public @interface ConditionalOnEnabledMetricsExport {

	/**
	 * The name of the metrics exporter.
	 * @return the name of the metrics exporter
	 */
	String value();

}
```

`@Conditional(OnMetricsExportEnabledCondition.class) ` 注解的核心代码如下：

```java
@Override
	public ConditionOutcome getMatchOutcome(ConditionContext context, AnnotatedTypeMetadata metadata) {
		AnnotationAttributes annotationAttributes = AnnotationAttributes
			.fromMap(metadata.getAnnotationAttributes(this.annotationType.getName()));
		String endpointName = annotationAttributes.getString("value");
		ConditionOutcome outcome = getEndpointOutcome(context, endpointName);
		if (outcome != null) {
			return outcome;
		}
		return getDefaultOutcome(context, annotationAttributes);
	}
```

先说结论：  

先判断`management.metrics.export.influx.enabled` 是否是true。如果没有配置的话，就再去判断`management.metrics.export.defaults.enabled`是否为true

相关知识点：  

1、AnnotatedTypeMetadata类：对注解元素的封装适配。

什么叫注解元素(AnnotatedElement)？比如我们常见的Class、Method、Constructor、Parameter等等都属于它的子类都属于注解元素。简单理解：只要能在上面标注注解都属于这种元素。Spring4.0新增的这个接口提供了对注解统一的、便捷的访问，使用起来更加的方便高效了。

```text
// @since 4.0
public interface AnnotatedTypeMetadata {

	// 此元素是否标注有此注解~~~~
	// annotationName：注解全类名
	boolean isAnnotated(String annotationName);

	// 这个就厉害了：取得指定类型注解的所有的属性 - 值（k-v）
	// annotationName：注解全类名
	// classValuesAsString：若是true表示 Class用它的字符串的全类名来表示。这样可以避免Class被提前加载
	@Nullable
	Map<String, Object> getAnnotationAttributes(String annotationName);
	@Nullable
	Map<String, Object> getAnnotationAttributes(String annotationName, boolean classValuesAsString);

	// 参见这个方法的含义：AnnotatedElementUtils.getAllAnnotationAttributes
	@Nullable
	MultiValueMap<String, Object> getAllAnnotationAttributes(String annotationName);
	@Nullable
	MultiValueMap<String, Object> getAllAnnotationAttributes(String annotationName, boolean classValuesAsString);
}
```

（1）通过AnnotatedTypeMetadata，获取可以注解的属性值。@ConditionalOnEnabledMetricsExport的属性值就是"influx"
