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

// 目录：共享 h2 锚点，桌面侧栏与窄屏折叠目录同步高亮
(function () {
  var toc = document.getElementById('toc');
  var list = document.getElementById('toc-list');
  var body = document.getElementById('article-body');
  var inline = document.getElementById('toc-inline');
  var inlineList = document.getElementById('toc-inline-list');
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
    var a = document.createElement('a');
    a.href = '#' + id;
    a.textContent = h.textContent.trim();
    li.appendChild(a);
    list.appendChild(li);
    if (inlineList) inlineList.appendChild(li.cloneNode(true));
  });

  toc.hidden = false;
  if (inline) inline.hidden = false;
  if (inlineList) inlineList.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a) return;
    var target = document.getElementById(a.getAttribute('href').slice(1));
    if (!target) return;
    e.preventDefault();
    inline.open = false;
    history.pushState(null, '', a.getAttribute('href'));
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start' });
  });

  var links = [].slice.call(list.querySelectorAll('a'));
  var targets = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });

  function highlight() {
    var y = window.scrollY + 120;
    var idx = 0;
    for (var i = 0; i < targets.length; i++) {
      if (targets[i] && targets[i].getBoundingClientRect().top + window.scrollY <= y) idx = i;
    }
    [list, inlineList].forEach(function (container) {
      if (!container) return;
      [].forEach.call(container.querySelectorAll('a'), function (a, i) {
        a.classList.toggle('active', i === idx);
        if (i === idx) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
    });
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { highlight(); ticking = false; });
  }, { passive: true });

  highlight();
})();

// 表格使用独立滚动区；提示只在实际溢出时出现。
(function () {
  var body = document.getElementById('article-body');
  if (!body) return;
  var entries = [];
  [].forEach.call(body.querySelectorAll('table'), function (table, index) {
    var region = document.createElement('div');
    region.className = 'table-scroll';
    region.setAttribute('role', 'region');
    region.setAttribute('aria-label', '文章表格 ' + (index + 1));
    var hint = document.createElement('p');
    hint.className = 'table-scroll-hint';
    hint.id = 'table-hint-' + index;
    hint.textContent = '左右滑动查看表格';
    hint.hidden = true;
    table.parentNode.insertBefore(region, table);
    region.appendChild(table);
    region.parentNode.insertBefore(hint, region);
    region.setAttribute('aria-describedby', hint.id);
    entries.push({ region: region, hint: hint });
  });
  function sync() {
    entries.forEach(function (entry) {
      var overflow = entry.region.scrollWidth > entry.region.clientWidth + 1;
      entry.hint.hidden = !overflow;
      if (overflow) entry.region.tabIndex = 0;
      else entry.region.removeAttribute('tabindex');
    });
  }
  if ('ResizeObserver' in window) {
    var observer = new ResizeObserver(sync);
    entries.forEach(function (entry) { observer.observe(entry.region); });
  } else window.addEventListener('resize', sync);
  sync();
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

  var current = null;
  var view = 'time';
  var compact = window.matchMedia('(max-width: 1000px)');
  var expanded = false;
  var filterToggle = document.getElementById('filter-toggle');
  var cloudToggle = document.getElementById('cloud-toggle');
  var status = document.getElementById('filter-status');
  var statusText = document.getElementById('filter-status-text');
  var clear = document.getElementById('filter-clear');
  var tabs = [].slice.call(document.querySelectorAll('.tab'));
  layout.classList.add('filters-ready');
  if (filterToggle) filterToggle.hidden = false;
  if (cloudToggle) cloudToggle.hidden = false;

  function syncCloud() {
    if (!cloud) return;
    cloud.hidden = compact.matches && !expanded;
    [].forEach.call(cloud.querySelectorAll('button'), function (b, i) {
      b.hidden = !compact.matches && !expanded && i > 10 && b.dataset.tag !== current;
      b.classList.toggle('active', b.dataset.tag === (current || ''));
      b.setAttribute('aria-pressed', b.dataset.tag === (current || '') ? 'true' : 'false');
    });
    if (filterToggle) filterToggle.setAttribute('aria-expanded', String(expanded));
    if (cloudToggle) {
      cloudToggle.setAttribute('aria-expanded', String(expanded));
      cloudToggle.textContent = expanded ? '收起标签' : '展开全部标签';
    }
  }
  [filterToggle, cloudToggle].forEach(function (b) {
    if (b) b.addEventListener('click', function () { expanded = !expanded; syncCloud(); });
  });
  if (compact.addEventListener) compact.addEventListener('change', function () { expanded = false; syncCloud(); });
  else compact.addListener(function () { expanded = false; syncCloud(); });
  if (clear) clear.addEventListener('click', function () {
    select(null, true);
    (compact.matches ? filterToggle : cloud.querySelector('button')).focus();
  });

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
    all.dataset.tag = '';
    all.textContent = '全部 (' + cards.length + ')';
    all.addEventListener('click', function () { select(null, true); });
    cloud.appendChild(all);
    tags.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tag tag-btn' + (current === t ? ' active' : '');
      b.dataset.tag = t;
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
    if (status) status.hidden = current === null;
    if (statusText) statusText.textContent = current ? '已选：' + current + ' · ' + shown + ' 篇' : '';
    syncCloud();
  }

  function select(tag, pushUrl) {
    var focusedInCloud = cloud && cloud.contains(document.activeElement);
    current = tag;
    if (compact.matches) expanded = false;
    if (view !== 'time') switchView('time');
    else renderList();
    if (focusedInCloud && compact.matches && filterToggle) filterToggle.focus();
    if (pushUrl && window.history && window.history.replaceState) {
      window.history.replaceState(null, '',
        location.pathname + (tag === null ? '' : '?tag=' + encodeURIComponent(tag)) + location.hash);
    }
  }

  // ---------- 视图切换 ----------
  function switchView(next) {
    view = next;
    var isCat = next === 'tag';
    if (catView) catView.hidden = !isCat;
    list.hidden = isCat;
    layout.classList.toggle('is-cat-view', isCat);
    tabs.forEach(function (x) {
      var active = x.getAttribute('data-view') === next;
      x.classList.toggle('is-active', active);
      x.setAttribute('aria-selected', String(active));
      x.tabIndex = active ? 0 : -1;
    });
    if (!isCat) renderList();
  }

  tabs.forEach(function (tab, index) {
    var panel = document.getElementById('view-' + tab.getAttribute('data-view'));
    tab.id = 'tab-' + tab.getAttribute('data-view');
    tab.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    tab.addEventListener('click', function () { switchView(tab.getAttribute('data-view')); });
    tab.addEventListener('keydown', function (e) {
      var next;
      if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (e.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      e.preventDefault();
      switchView(tabs[next].getAttribute('data-view'));
      tabs[next].focus();
    });
  });

  // ---------- 初始化 ----------
  var m = location.search.match(/[?&]tag=([^&]*)/);
  var initial = null;
  try { initial = m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null; } catch (e) { /* 非法编码按全部文章处理 */ }
  if (initial && tags.indexOf(initial) === -1) initial = null;
  current = initial;
  applySort(sortSel ? sortSel.value : 'new');
  renderCloud();
  switchView('time');
})();
