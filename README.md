# Pixyll 中文版
## 中文版说明
这是pixyll的汉化版，主要改动如下:

1. 语言汉化
2. 加入**多说**评论功能
3. 加入**百度统计**(可用google统计和百度统计)
4. fonts.googleapis.com更改为360字体cdn，大幅增加国内访问速度

原版:[pixyll.com](http://www.pixyll.com)

![Pixyll screenshot](https://cloud.githubusercontent.com/assets/1424573/3847467/134aa236-1e66-11e4-8421-4e8c122118dc.png)

## 使用说明 

要使用Pixyll，你需要先安装ruby和jekyll

### 安装 Jekyll

你可以使用gem安装Jekyll，若已安装Jeykll，请跳过此步

```
$ gem install jekyll
```

#### 确认 Jekyll 版本

确认你的Jekyll版本，因为Pixyll只支持 [Jekyll 2.0 以上版本](http://jekyllrb.com/news/2014/05/06/jekyll-turns-2-0-0/).

```
$ jekyll -v
# This should be jekyll 2.0.0 or later
```

### 下载源码

fork 和 clone本repo

### 修改配置文件: _config.yml

编辑配置文件 `_config.yml` :

```yml
# Site settings
title: 网站标题
email: 您的邮箱 
author: John Otander
description: "A simple, beautiful theme for Jekyll that emphasizes content rather than aesthetic fluff."
baseurl: ""
url: "网站url，如:http://pixyll.com"

# Build settings
markdown: kramdown
permalink: pretty
#每页文章数量
paginate: 3
```

### 多说评论和百度统计(可选)
配置多说，和百度统计，如果不需要评论和统计功能，你可以跳过此步
你需要先注册多说和百度统计账号，然后将相应id填入配置文件即可
特别注意，百度统计请使用异步js代码
![百度统计](https://raw.githubusercontent.com/ee0703/pixyll-zh-cn/master/images/bdtjcfg.jpg)

``` yml
#Duoshuo short Name / 多说的shortname
duoshuo: 在这里填入你的多说short name

#Baidu analytics / 百度统计(异步的js码，注意使用异步版本的)
baidu_analyze: 百度统计码，如：3908cbb144cf558ba6a823230d653fc22 
```


### 运行服务器 Jekyll Serve

运行Jekyll服务器
```
$ jekyll serve --watch
```

用浏览器打开 `localhost:4000`就可以看到网站了.

### 使用 Github Pages

关于如何使用Github pages来host你的网站,可以参考[这里](https://pages.github.com/)

