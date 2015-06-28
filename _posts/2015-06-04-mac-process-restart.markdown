---
layout: post
category : server
tagline: "Supporting tagline"
tags : [php-fpm restart, nginx restart, mac]
---
### mac下，重启nginx、重启php-fpm、甚至扩展到所有程序（或者进程）的重启

 用了mac之后，经常会遇到一些问题，如fpm怎么重启，nginx怎么重启，网上搜索之后，一般都是ubuntu下的一些快捷命令的解决方案，mac下好像都没有。于是自己尝试写了个shell脚本。脚本完成的任务(以fpm为例)：

1、 如果fpm没有启动，就启动fpm

2、 如果已经启动，就重启fpm。

以下是代码

{% highlight bash %}
  #!/bin/sh
  #检测某个端口是够被占用。如fpm的9000端口如果被占用，所有fpm已经启动，此时，可以选择重启fpm。
  function check_port_if_has_opened()
  {
  	if [ -z $1 ] ; then
    	echo '请输入端口号';
    	exit;
  	fi
  	nc -z 127.0.0.1 $1;
  	a=$?;
  	if [ $a -eq 0 ] ;
  	then
    	return 1;
  	else
    	return 0;
  	fi
  }

  #检测nginx是否已经启动
  check_port_if_has_opened 80
  nginx_status=$?; #变量$?获取上一个函数的返回结果
  #没有启动的情况下，启动nginx
  if [ $nginx_status -ne 1 ];then
  	sudo nginx
  else
  	#已经已经启动，重启nginx
  	sudo nginx -s reload
  fi
  #监控前面的重启操作是够成功
  check_port_if_has_opened 80

  #检测fpm是否已经启动
  check_port_if_has_opened 9000
  fpm_status=$?;
  #没有启动的情况下，启动fpm
  if [ $fpm_status -ne 1 ];
  then
  	/usr/local/sbin/php-fpm
  else
  	#fpm已经启动，重启fpm
  	kill -USR2 `pstree|grep '/usr/local/sbin/php-fpm'|grep -v grep|head -1|	grep -o '[0-9]\+'`
  fi

  #监控前面的重启操作是够成功
  check_port_if_has_opened 9000
{% endhighlight %}
