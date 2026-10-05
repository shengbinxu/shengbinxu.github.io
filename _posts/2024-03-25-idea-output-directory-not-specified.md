---
layout: post
title: "解决IDEA Error:Output directory is not specified"
date: 2024-03-25 22:27:00 +0800
description: "遇到这个报错，是很烦的。折腾半天有时候都无法解决。"
tags: [IDEA, 线上排查]
original_url: https://www.cnblogs.com/xushengbin/p/18095568
---
遇到这个报错，是很烦的。折腾半天有时候都无法解决。

最佳解决办法：

删除本地的.idea目录

![image](/assets/images/posts/idea-output-directory-not-specified/img-01.webp)

然后 idea 中关闭该项目，然后重新导入，就会自动生成.idea目录，一切正常了。

![image](/assets/images/posts/idea-output-directory-not-specified/img-02.webp)
