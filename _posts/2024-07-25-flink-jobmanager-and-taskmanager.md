---
layout: post
title: "flink jobmanager和taskmanager的关系"
date: 2024-07-25 07:32:00 +0800
description: "在flink中，我们使用druid datasource创建数据源："
tags: [flink, 架构]
original_url: https://www.cnblogs.com/xushengbin/p/18322152
---
## 需求背景

在flink中，我们使用druid datasource创建数据源：

```text
dataSource = DruidDataSourceFactory.createDataSource(prop);
```

现在我希望通过druid打印sql执行日志。  

参考<https://github.com/alibaba/druid/wiki/%E9%85%8D%E7%BD%AE_LogFilter>  

需要设置system properties。有两种选择：

1. 提交任务jar包时，指定
   -D
   选项
2. 在flink任务代码中，通过config.yaml文件，指定不同环境下的日志配置。

我选择通过代码来控制，config.yaml文件内容如下：

```properties
properties:
  #  打印druid sql日志。参考https://github.com/alibaba/druid/wiki/%E9%85%8D%E7%BD%AE_LogFilter
  druid:
    log:
      stmt:
        executableSql: true
    filters: log4j
```

接下来需要解析这个配置，然后set到system properties中。相关代码：

```java
private static Configuration getYamlConfig(String fileName) throws Exception {
        ClassLoader cl = ConfigHelper.class.getClassLoader();

        try (InputStream is = cl.getResourceAsStream(fileName)) {
            Yaml yaml = new Yaml(new Constructor(Configuration.class));
            Configuration config = yaml.load(is);
            return config;
        }
    }

public class SystemPropertiesHelper {
    private static final Logger log = LoggerFactory.getLogger(SystemPropertiesHelper.class);

    public static void setSystemProperties(Map<String, Object> yamlMap, String parentKey) {
        for (Map.Entry<String, Object> entry : yamlMap.entrySet()) {
            String key = parentKey.isEmpty() ? entry.getKey() : parentKey + "." + entry.getKey();
            Object value = entry.getValue();

            if (value instanceof Map) {
                setSystemProperties((Map<String, Object>) value, key);
            } else {
                log.info("Set system property: {}={}", key, value.toString());
                System.setProperty(key, value.toString());
            }
        }
    }
}
```

接下来，我在main方法入口的地方，调用`ystemPropertiesHelper.setSystemProperties(configuration.getProperties(), "");` 设置系统属性。

本地运行（flink local env）是可以的，能打印出flink运行日志。但是把jar发布到测试的flink集群之后就不行了，死活日志打不出来。

后来通过日志发现，在job manager的log中确实设置成功了系统属性

```text
2024-07-25 06:46:27,900 INFO  com.tide.util.SystemPropertiesHelper                         [] - Set system property: druid.log.stmt.executableSql=true
2024-07-25 06:46:27,901 INFO  com.tide.util.SystemPropertiesHelper                         [] - Set system property: druid.filters=log4j
```

但是，task manager的log中并没有进行相关设置。显然，任务jar包`主要`是由task manager运行的，druid datasource相关代码也是在算子中调用的，肯定也是在task manager中执行的。

分析到这里，关键点是理解在任务jar包运行过程中，job manager和task manager分别承担的职责是什么？  

参考<https://www.cnblogs.com/xing901022/p/14300093.html>

1、job manager 会通过反射调用jar包的main方法，然后解析，生成StreamGraph。 因此，我们把`setSystemProperties`操作放到main方法中执行，自然是在job manager jvm进程中执行  

2、job manager把算子调度到特定的task manager进行执行。

因此，要解决问题，必须在算子的逻辑代码中执行。修改代码：

```text
Configuration configuration = ConfigHelper.getConfig();
            if (configuration.getProperties() != null) {
                // 设置系统属性。控制druid sql log的行为
                SystemPropertiesHelper.setSystemProperties(configuration.getProperties(), "");
            }
            initDataSource();
```

就ok了。

## 扩展

使用druid 打印sql log，还需要在log4j添加配置:

```text
 <logger name="druid.sql.Statement" additivity="false">
        <level value="DEBUG"></level>
        <appender-ref ref="console"/>
        <appender-ref ref="file"/>
    </logger>
```
