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

  <div class="filters card">
    <div class="filter-row">
      <label class="filter-label" for="sort-select">排序方式</label>
      <select id="sort-select" class="filter-select">
        <option value="new">最新发布</option>
        <option value="old">最早发布</option>
        <option value="title">按标题</option>
      </select>
    </div>
    <div class="filter-row">
      <div class="filter-label">按标签筛选</div>
      <div class="tag-cloud" id="tag-cloud"></div>
    </div>
  </div>

  <ul class="post-list" id="post-list">
    {% for post in posts %}
    <li class="post-item"
        data-date="{{ post.date | date_to_xmlschema }}"
        data-title="{{ post.title | escape }}"
        data-tags="{% for tag in post.tags %}{{ tag }}{% unless forloop.last %},{% endunless %}{% endfor %}">
      <a class="post-item-title" href="{{ post.url | relative_url }}">{{ post.title }}</a>
      {% if post.description %}<p class="post-item-desc">{{ post.description }}</p>{% endif %}
      <div class="post-item-meta">
        <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%Y 年 %-m 月 %-d 日" }}</time>
        {% for tag in post.tags %}<a class="tag" href="?tag={{ tag | url_encode }}">{{ tag }}</a>{% endfor %}
      </div>
    </li>
    {% endfor %}
  </ul>

  <p class="filter-empty" id="filter-empty" hidden>没有匹配的文章。</p>
{% endif %}
