---
layout: post
title: "深入理解spring框架：剖析多线程模式下数据库连接"
date: 2024-01-13 20:23:00 +0800
description: "spring框架下，大多数bean都是单例模式。这些单例模式的bean，会在多线程环境下执行（每个http request，可能对应一个线程）。如果bean是有状态的（对象的属性会被修改），如何解决线程安全问题？"
tags: [spring, 数据库]
original_url: https://www.cnblogs.com/xushengbin/p/17962754
---
## 问题

1、spring框架下，大多数bean都是单例模式。这些单例模式的bean，会在多线程环境下执行（每个http request，可能对应一个线程）。如果bean是有状态的（对象的属性会被修改），如何解决线程安全问题？

2、多线程环境下，db连接如何共享的？ db连接复用的粒度，是请求级别还是线程级别？ JdbcTemplate 是单例的，它中的dataSource属性（每个dataSource会持有一个db连接）是有状态的，spring是如何处理事务的线程安全问题？

这个文章会解答这些问题。

## 概念

1、网上经常看到文章说：事务是有状态的。我是这么理解的：

- 事务有未提交、已提交、回滚等状态，每个事务中包含一个db连接。
- 如果创建了多个事务，这时候就要解决线程安全的问题。

```java
protected Object doGetTransaction() {
		DataSourceTransactionObject txObject = new DataSourceTransactionObject();
		txObject.setSavepointAllowed(isNestedTransactionAllowed());
		ConnectionHolder conHolder =
				(ConnectionHolder) TransactionSynchronizationManager.getResource(this.dataSource);
		txObject.setConnectionHolder(conHolder, false);
		return txObject;
	}
```

事务对象（txObject）持有 ConnectionHolder，ConnectionHolder持有Connection，所以说，每个事务中保护一个db连接。

## 源码分析

1、显示开启了事务情况下（手动提交），进行db操作前，首先要创建一个事务。 （代码就是前面的doGetTransaction方法）

2、把txObject存入threadLocal  

org.springframework.jdbc.datasource.DataSourceTransactionManager#doBegin

```text
// Bind the session holder to the thread.
			if (txObject.isNewConnectionHolder()) {
				TransactionSynchronizationManager.bindResource(getDataSource(), txObject.getConnectionHolder());
			}
```

接下来看bindResource()方法：

```java
public abstract class TransactionSynchronizationManager {

	private static final Log logger = LogFactory.getLog(TransactionSynchronizationManager.class);

	private static final ThreadLocal<Map<Object, Object>> resources =
			new NamedThreadLocal<Map<Object, Object>>("Transactional resources");

   public static void bindResource(Object key, Object value) throws IllegalStateException {
		Object actualKey = TransactionSynchronizationUtils.unwrapResourceIfNecessary(key);
    Assert.notNull(value, "Value must not be null");
    Map < Object, Object > map = resources.get();
    // set ThreadLocal Map if none found
    if (map == null) {
        map = new HashMap < Object, Object > ();
        resources.set(map);
    }
}

}
```

把txObject.getConnectionHolder()存入了threadLocal中，也就是每个线程会单独存放一份db connection信息。

**知识点1:** 每个线程会创建一个db连接。如果我们用子线程执行了数据库查询，会创建新的db连接。  

demo可参考[multithread/UserService.java](https://github.com/sunolaf/spring4.x/blob/master/chapter12/src/main/java/com/smart/multithread/UserService.java)

## 扩展

就这这个话题，看源码的过程中，遇到一个新的知识点：  

在spring框架中，声明式事务如何进行配置？以及它的原理是什么？

### 什么是声明式事务？

spring框架中，如果一个操作db的函数，要显示开启事务，可以在方法上添加@Transactional注解。这种通过“声明”，而不是硬编码的方式声明事务，就叫“声明式事务”。  

除了注解的方式，还可以通过xml配置文件的方式声明：

```properties
<!-- 添加Spring事务增强 -->
	<aop:config proxy-target-class="true">
		<aop:pointcut id="serviceJdbcMethod" expression="within(com.smart.multithread.BaseService+)" />
		<aop:advisor pointcut-ref="serviceJdbcMethod" advice-ref="jdbcAdvice"
			order="0" />
	</aop:config>
	<tx:advice id="jdbcAdvice" transaction-manager="jdbcManager">
		<tx:attributes>
			<tx:method name="*" />
		</tx:attributes>
	</tx:advice>
```

这段配置的大致意思：  

定义一个aop，切入点是BaseService的方法，增强逻辑是jdbcAdvice 这个bean。  

这个bean具体是什么类型呢？

```java
/**
 * {@link org.springframework.beans.factory.xml.BeanDefinitionParser
 * BeanDefinitionParser} for the {@code <tx:advice/>} tag.
 */
class TxAdviceBeanDefinitionParser extends AbstractSingleBeanDefinitionParser {
	@Override
	protected Class<?> getBeanClass(Element element) {
		return TransactionInterceptor.class;
	}
}
```

从这段代码的注释，我们可以猜到这个bean的类型是TransactionInterceptor。  

也就是说，当调用BaseService中的方法时，会自动调用TransactionInterceptor这个拦截器，自动开启事务、提交事务等。

### aop原理

上面的配置涉及到aop相关知识。这里做一个剖析：

![image](/assets/images/posts/spring-multithread-db-connection/img-01.webp)

这个截图信息量很大：

（1）当调用BaseService.logon()方法时，实际调用的是UserService$$EnhancerBySpringCGLIB$$326dbb7a@4414 这个类中的logon()方法，这是咋回事呢？ 我们看一下CGLIB原理：

> CGLIB 原理：动态生成一个要代理类的子类，子类重写要代理的类的所有不是final的方法。在子类中采用方法拦截的技术拦截所有父类方法的调用，顺势织入横切逻辑。它比使用java反射的JDK动态代理要快。  
>
> CGLIB 底层：使用字节码处理框架ASM，来转换字节码并生成新的类。不鼓励直接使用ASM，因为它要求你必须对JVM内部结构包括class文件的格式和指令集都很熟悉。

CGLIB会自动修改虚拟机中的字节码，生成了被代理类的一个子类（UserService$$EnhancerBySpringCGLIB$$326dbb7a）。

（2）在invoke()方法中，会先执行invokeWithinTransaction()，完成之后继续调用UserService.logon()方法。

![image](/assets/images/posts/spring-multithread-db-connection/img-02.webp)

在invokeWithinTransaction()方法中，就开始获取事务。

(3) 在我进行debug时，调用了UserService()的多个方法，但是只有调用第一个方法时触发了aop代理，看起来我前面对within()的理解不对？。具体代码如下：

```java
public static void main(String[] args) {
   ApplicationContext ctx = new ClassPathXmlApplicationContext("com/smart/multithread/applicatonContext.xml");
   UserService service = (UserService) ctx.getBean("userService");
   service.logon("tom");
}

public void logon(String userName) {
       System.out.println("before userService.updateLastLogonTime method...");
   	// 下面这个方法也访问了数据库。调用这个方法并没有触发aop代理
       updateLastLogonTime(userName);
       System.out.println("after userService.updateLastLogonTime method...");

//      scoreService.addScore(userName, 20);
       Thread myThread = new MyThread(this.scoreService, userName, 20);//使用一个新线程运行
       myThread.start();
   }
```

答案就是只有在调用spring bean（注入到容器的对象）的方法时，才会触发aop。而updateLastLogonTime()方法，并不是通过bean直接调用的。

## db连接泄漏

概念：  

如果程序中的代码写法，导致建立了大量的db连接，并且没主动释放，进而把连接池连接占用完。就叫“连接泄漏”。

错误代码：

```java
 @Transactional
    public void logon(String userName) {
        try {
			// 直接从数据源获取链接，并且没有显示释放。
            Connection conn = jdbcTemplate.getDataSource().getConnection();
//            Connection conn = DataSourceUtils.getConnection(jdbcTemplate.getDataSource());

            String sql = "UPDATE t_user SET last_logon_time=? WHERE user_name =?";
            jdbcTemplate.update(sql, System.currentTimeMillis(), userName);
            Thread.sleep(1000);//②模拟程序代码的执行时间
        } catch (Exception e) {
            e.printStackTrace();
        }

    }
```

利用` jdbcTemplate.getDataSource().getConnection();` 直接从数据源获取链接，并且没有显示释放。 这里获取到的连接并不是线程绑定的db连接（我们前面提到过，每个线程会创建一个db连接）。

解决办法：  

利用`DataSourceUtils.getConnection(jdbcTemplate.getDataSource());` 获取线程绑定的db连接，就不会出现连接泄漏的问题。

`我自己项目中也写过这种错误代码，当时没去深究为啥改用DataSourceUtils问题就解决了，今天算理解了`  

JdbcTemplate源码也是采用这种方法获取db连接：  
 `org.springframework.jdbc.core.JdbcTemplate#execute(org.springframework.jdbc.core.ConnectionCallback<T>)`

```java
@Override
	public <T> T execute(ConnectionCallback<T> action) throws DataAccessException {
		Assert.notNull(action, "Callback object must not be null");

		Connection con = DataSourceUtils.getConnection(getDataSource());
		try {
			Connection conToUse = con;
			if (this.nativeJdbcExtractor != null) {
				// Extract native JDBC Connection, castable to OracleConnection or the like.
				conToUse = this.nativeJdbcExtractor.getNativeConnection(con);
			}
			else {
				// Create close-suppressing Connection proxy, also preparing returned Statements.
				conToUse = createConnectionProxy(con);
			}
			return action.doInConnection(conToUse);
		}
		catch (SQLException ex) {
			// Release Connection early, to avoid potential connection pool deadlock
			// in the case when the exception translator hasn't been initialized yet.
			DataSourceUtils.releaseConnection(con, getDataSource());
			con = null;
			throw getExceptionTranslator().translate("ConnectionCallback", getSql(action), ex);
		}
		finally {
			DataSourceUtils.releaseConnection(con, getDataSource());
		}
	}
```

## 参考

《精通Spring 4.x》非常好的一本书
