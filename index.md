---
layout: default
title: 首页
---
{% assign posts = site.posts %}
{% if posts.size == 0 %}
  <p class="page-intro">还没有文章。</p>
{% else %}
  <h1 class="page-title">博客文章</h1>
  <p class="page-intro">共 {{ posts.size }} 篇，按时间倒序。</p>

  <ul class="post-list">
    {% for post in posts %}
    <li class="post-item">
      <a class="post-item-title" href="{{ post.url | relative_url }}">{{ post.title }}</a>
      {% if post.description %}<p class="post-item-desc">{{ post.description }}</p>{% endif %}
      <div class="post-item-meta">
        <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%Y 年 %-m 月 %-d 日" }}</time>
        {% for tag in post.tags %}<span class="tag">{{ tag }}</span>{% endfor %}
      </div>
    </li>
    {% endfor %}
  </ul>
{% endif %}
