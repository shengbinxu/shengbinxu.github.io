# shengbinxu.github.io

个人技术博客。用 Jekyll + GitHub Pages 原生构建，无需 CI。

## 写新文章

在 `_posts/` 下新建 `YYYY-MM-DD-slug.md`，开头加 front matter：

```yaml
---
layout: post
title: "标题"
date: 2026-10-05 10:00:00 +0800
description: "列表页显示的一句话摘要"
tags: [标签1, 标签2]
---
```

正文用 Markdown。提交推送到 `main` 后 GitHub 会自动构建发布。

## 本地预览

```bash
bundle exec jekyll serve
```
