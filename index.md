---
layout: default
title: 首页
---
{% assign posts = site.posts %}
{% if posts.size == 0 %}
  <p class="empty">还没有文章。</p>
{% else %}
  <ul class="post-list">
    {% for post in posts %}
    <li class="post-item">
      <a class="post-link" href="{{ post.url | relative_url }}">{{ post.title }}</a>
      {% if post.description %}<p class="post-excerpt">{{ post.description }}</p>{% endif %}
      <div class="post-meta">
        <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%Y-%m-%d" }}</time>
        {% if post.tags and post.tags.size > 0 %}
          <span class="sep">·</span>
          <span class="tags">{% for tag in post.tags %}<span class="tag">{{ tag }}</span>{% endfor %}</span>
        {% endif %}
      </div>
    </li>
    {% endfor %}
  </ul>
{% endif %}
