---
layout: post
category : php
tagline: "Supporting tagline"
tags : [php,error reporting,display errors]
---
### 最近老是遇到一些问题，如：php error log打印不出报错信息，导致线上http 500时，很难定位问题；set_error_handle捕获不到某些错误，因此做了整理：

### set_error_handle

官方文档是这么说的：

  The following error types cannot be handled with a user defined function: E_ERROR, E_PARSE, E_CORE_ERROR, E_CORE_WARNING, E_COMPILE_ERROR, E_COMPILE_WARNING, and most of E_STRICT raised in the file where set_error_handler() is called.

  因此，set_error_handler 捕获不了一些类似E_ERROR的错误。

### php打印error_log需要满足的条件

1、 error_reporting 不要设置-1。

2、php.ini中:

{% highlight php %}
log_error = On
error_log = /path/to/dir
{% endhighlight %}

3、php-fpm.conf 中不要设置php_admin_value[error_log],如果设置了，会覆盖php.ini中的对应设置

### 屏幕显示错误信息

1、error_reporting 不要设置-1。

2、display_errors = On
