// 主题切换
(function () {
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;
  var root = document.documentElement;

  function sync() {
    btn.textContent = root.classList.contains('dark') ? '浅色' : '深色';
  }
  sync();

  btn.addEventListener('click', function () {
    root.classList.toggle('dark');
    try { localStorage.setItem('theme', root.classList.contains('dark') ? 'dark' : 'light'); } catch (e) {}
    sync();
    if (window.__syncGiscusTheme) window.__syncGiscusTheme();
  });
})();

// 文章页评论（giscus，基于 GitHub Discussions）
(function () {
  var host = document.querySelector('.giscus');
  if (!host) return;

  var REPO = 'shengbinxu/shengbinxu.github.io';
  var REPO_ID = 'R_kgDOU73Ouw';
  var CATEGORY = 'Announcements';               // 只允许维护者新建讨论，读者只能评论
  var CATEGORY_ID = 'DIC_kwDOU73Ou84DHD7f';

  function isDark() { return document.documentElement.classList.contains('dark'); }

  var loaded = false;
  function load() {
    if (loaded) return;
    loaded = true;
    var s = document.createElement('script');
    s.src = 'https://giscus.app/client.js';
    s.async = true;
    s.crossOrigin = 'anonymous';
    var attrs = {
      'data-repo': REPO,
      'data-repo-id': REPO_ID,
      'data-category': CATEGORY,
      'data-category-id': CATEGORY_ID,
      'data-mapping': 'pathname',
      'data-strict': '0',
      'data-reactions-enabled': '1',
      'data-emit-metadata': '0',
      'data-input-position': 'bottom',
      'data-theme': isDark() ? 'dark' : 'light',   // 首屏就取对，避免先闪一下白底
      'data-lang': 'zh-CN',
      'data-loading': 'lazy'
    };
    Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    host.appendChild(s);
  }

  // 滚到评论区附近才加载，不拖慢文章首屏
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) { load(); io.disconnect(); return; }
      }
    }, { rootMargin: '400px' });
    io.observe(host);
  } else {
    load();
  }

  // 站点切换深浅色时，通知已加载的 giscus 换主题
  window.__syncGiscusTheme = function () {
    var f = document.querySelector('iframe.giscus-frame');
    if (!f || !f.contentWindow) return;
    f.contentWindow.postMessage(
      { giscus: { setConfig: { theme: isDark() ? 'dark' : 'light' } } },
      'https://giscus.app'
    );
  };
})();

// 目录：扫描正文 h2/h3 生成，并随滚动高亮
(function () {
  var toc = document.getElementById('toc');
  var list = document.getElementById('toc-list');
  var body = document.getElementById('article-body');
  if (!toc || !list || !body) return;

  var heads = [].slice.call(body.querySelectorAll('h2'));
  if (heads.length < 2) return;

  var used = {};
  heads.forEach(function (h) {
    // 生成稳定锚点
    var id = h.id;
    if (!id) {
      id = h.textContent.trim()
        .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || 'section';
      var base = id, n = 2;
      while (used[id] || document.getElementById(id)) { id = base + '-' + n++; }
      h.id = id;
    }
    used[id] = true;

    var li = document.createElement('li');
    if (h.tagName === 'H3') li.className = 'toc-l3';
    var a = document.createElement('a');
    a.href = '#' + id;
    a.textContent = h.textContent.trim();
    li.appendChild(a);
    list.appendChild(li);
  });

  toc.hidden = false;

  var links = [].slice.call(list.querySelectorAll('a'));
  var targets = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });

  function highlight() {
    var y = window.scrollY + 120;
    var idx = 0;
    for (var i = 0; i < targets.length; i++) {
      if (targets[i] && targets[i].offsetTop <= y) idx = i;
    }
    links.forEach(function (a, i) { a.classList.toggle('active', i === idx); });
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { highlight(); ticking = false; });
  }, { passive: true });

  highlight();
})();

// 首页：按时间 / 按分类 视图切换 + 标签筛选 + 排序
(function () {
  var list = document.getElementById('view-time');
  var catView = document.getElementById('view-tag');
  var layout = document.querySelector('.list-layout');
  var cloud = document.getElementById('tag-cloud');
  var sortSel = document.getElementById('sort-select');
  var empty = document.getElementById('filter-empty');
  if (!list || !layout) return;

  var cards = [].slice.call(list.querySelectorAll('.post-card'));
  cards.forEach(function (c) {
    var raw = (c.getAttribute('data-tags') || '').trim();
    c._tags = raw ? raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
    c._date = c.getAttribute('data-date') || '';
    c._title = c.getAttribute('data-title') || '';
  });

  var counts = {};
  cards.forEach(function (c) { c._tags.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; }); });
  var tags = Object.keys(counts).sort(function (a, b) {
    return counts[b] - counts[a] || a.localeCompare(b, 'zh-Hans-CN');
  });

  var current = null;   // 当前选中的标签
  var view = 'time';    // time | tag

  // ---------- 排序 ----------
  function applySort(mode) {
    var sorted = cards.slice();
    sorted.sort(function (a, b) {
      if (mode === 'title') return a._title.localeCompare(b._title, 'zh-Hans-CN');
      var da = Date.parse(a._date) || 0, db = Date.parse(b._date) || 0;
      return mode === 'old' ? da - db : db - da;
    });
    sorted.forEach(function (c) { list.appendChild(c); });
  }
  if (sortSel) sortSel.addEventListener('change', function () { applySort(sortSel.value); });

  // ---------- 标签筛选（只作用于时间视图）----------
  function matches(c) { return current === null || c._tags.indexOf(current) !== -1; }

  function renderCloud() {
    if (!cloud) return;
    cloud.innerHTML = '';
    var all = document.createElement('button');
    all.type = 'button';
    all.className = 'tag tag-btn' + (current === null ? ' active' : '');
    all.textContent = '全部 (' + cards.length + ')';
    all.addEventListener('click', function () { select(null, true); });
    cloud.appendChild(all);
    tags.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tag tag-btn' + (current === t ? ' active' : '');
      b.textContent = t + ' (' + counts[t] + ')';
      b.addEventListener('click', function () { select(t, true); });
      cloud.appendChild(b);
    });
  }

  function renderList() {
    var shown = 0;
    cards.forEach(function (c) {
      var hit = matches(c);
      c.hidden = !hit;
      if (hit) shown++;
    });
    if (empty) empty.hidden = shown !== 0;
    renderCloud();
  }

  function select(tag, pushUrl) {
    current = tag;
    if (view !== 'time') switchView('time');
    else renderList();
    if (pushUrl && window.history && window.history.replaceState) {
      window.history.replaceState(null, '',
        location.pathname + (tag === null ? '' : '?tag=' + encodeURIComponent(tag)));
    }
  }

  // ---------- 视图切换 ----------
  function switchView(next) {
    view = next;
    var isCat = next === 'tag';
    if (catView) catView.hidden = !isCat;
    list.hidden = isCat;
    layout.classList.toggle('is-cat-view', isCat);
    [].forEach.call(document.querySelectorAll('.tab'), function (x) {
      x.classList.toggle('is-active', x.getAttribute('data-view') === next);
    });
    if (!isCat) renderList();
  }

  [].forEach.call(document.querySelectorAll('.tab'), function (tab) {
    tab.addEventListener('click', function () { switchView(tab.getAttribute('data-view')); });
  });

  // ---------- 初始化 ----------
  var m = location.search.match(/[?&]tag=([^&]*)/);
  var initial = m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null;
  if (initial && tags.indexOf(initial) === -1) initial = null;
  current = initial;
  applySort(sortSel ? sortSel.value : 'new');
  renderList();
})();
