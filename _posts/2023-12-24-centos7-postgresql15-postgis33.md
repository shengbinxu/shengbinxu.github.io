---
layout: post
title: "centos7安装postgresql15、postgis3.3"
date: 2023-12-24 02:18:00 +0800
description: "直接使用yum安装的时候，都会提示缺少某些包无法安装。我这里把缺少的包的安装方式列一下。"
tags: [postgresql, postgis]
original_url: https://www.cnblogs.com/xushengbin/p/17923936.html
---
直接使用yum安装的时候，都会提示缺少某些包无法安装。我这里把缺少的包的安装方式列一下。

```bash
yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-7-x86_64/pgdg-redhat-repo-latest.noarch.rpm
yum install -y https://dl.fedoraproject.org/pub/epel/7/x86_64/Packages/l/libzstd-1.5.5-1.el7.x86_64.rpm
yum -y install postgresql15-server

yum -y install https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm
yum install postgis33_15
```

就这几条命令，顺利安装好了postgresql15，以及postgis扩展。

安装之后初始化、修改密码：  
 <https://computingforgeeks.com/how-to-install-postgresql-on-centos-rhel-7/>

生产环境参数调优：  
 <https://blog.csdn.net/h952520296/article/details/124190566>

配置主从复制：  
 <https://www.cherryservers.com/blog/how-to-set-up-postgresql-database-replication>
