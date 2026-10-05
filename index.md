---
layout: default
title: 首页
---
{% assign posts = site.posts %}
{% if posts.size == 0 %}
  <p class="page-intro">还没有文章。</p>
{% else %}
  <div class="list-page">
  <h1 class="page-title">博客文章</h1>
  <p class="page-intro">共 {{ posts.size }} 篇。可以按时间逐篇阅读，也可以按分类浏览。</p>

  <div class="tabs" role="tablist">
    <button type="button" class="tab is-active" data-view="time" role="tab">按时间浏览</button>
    <button type="button" class="tab" data-view="tag" role="tab">按分类浏览</button>
  </div>

  <div class="list-layout">
    <div class="list-main">

      <div class="post-list" id="view-time">
        {% for post in posts %}
        <article class="post-card"
             data-date="{{ post.date | date_to_xmlschema }}"
             data-title="{{ post.title | escape }}"
             data-tags="{% for tag in post.tags %}{{ tag }}{% unless forloop.last %},{% endunless %}{% endfor %}">
          <h2 class="post-card-title"><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h2>
          {% if post.description %}<p class="post-card-desc">{{ post.description }}</p>{% endif %}
          <div class="post-card-foot">
            <time class="post-card-date" datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%Y 年 %-m 月 %-d 日" }}</time>
            <span class="tag-row">
              {% for tag in post.tags %}<a class="tag" href="?tag={{ tag | url_encode }}">{{ tag }}</a>{% endfor %}
            </span>
          </div>
        </article>
        {% endfor %}
        <p class="filter-empty" id="filter-empty" hidden>没有匹配的文章。</p>
      </div>

      <div class="cat-grid" id="view-tag" hidden>
        {%- for cat in site.data.categories -%}
          {%- assign matched = "" | split: "," -%}
          {%- for post in posts -%}
            {%- assign hit = false -%}
            {%- for t in post.tags -%}
              {%- if cat.tags contains t -%}{%- assign hit = true -%}{%- break -%}{%- endif -%}
            {%- endfor -%}
            {%- if hit -%}{%- assign matched = matched | push: post -%}{%- endif -%}
          {%- endfor -%}
          {%- if matched.size > 0 -%}
          <article class="cat-card">
            <div class="cat-head">
              <span class="cat-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
                     stroke-linecap="round" stroke-linejoin="round"><path d="{{ cat.icon }}"/></svg>
              </span>
              <span class="cat-count">{{ matched.size }} 篇</span>
            </div>
            <h2 class="cat-name">{{ cat.name }}</h2>
            <p class="cat-desc">{{ cat.desc }}</p>
            <div class="cat-tags">
              {%- for t in cat.tags -%}
                {%- assign n = 0 -%}
                {%- for post in posts -%}
                  {%- if post.tags contains t -%}{%- assign n = n | plus: 1 -%}{%- endif -%}
                {%- endfor -%}
                {%- if n > 0 -%}
                  <a class="cat-tag" href="?tag={{ t | url_encode }}">{{ t }} · {{ n }}</a>
                {%- endif -%}
              {%- endfor -%}
            </div>
            {%- if matched.size > 0 -%}
            <div class="cat-recent">
              <div class="cat-recent-label">近期文章</div>
              {%- for post in matched limit: 3 %}
              <a class="cat-recent-item" href="{{ post.url | relative_url }}">
                <time>{{ post.date | date: "%Y.%m" }}</time><span>{{ post.title }}</span>
              </a>
              {%- endfor -%}
            </div>
            {%- endif -%}
          </article>
          {%- endif -%}
        {%- endfor -%}
      </div>

    </div>

    <aside class="list-side">
      <section class="side-card">
        <h3 class="side-title">排序方式</h3>
        <select id="sort-select" class="filter-select">
          <option value="new">最新发布</option>
          <option value="old">最早发布</option>
          <option value="title">按标题</option>
        </select>
      </section>
      <section class="side-card">
        <h3 class="side-title">按标签筛选</h3>
        <div class="tag-cloud" id="tag-cloud"></div>
      </section>
    </aside>
  </div>
  </div>
{% endif %}
