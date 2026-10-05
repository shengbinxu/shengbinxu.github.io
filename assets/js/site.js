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
  });
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

// 首页：标签筛选 + 排序
(function () {
  var list = document.getElementById('post-list');
  var cloud = document.getElementById('tag-cloud');
  var sortSel = document.getElementById('sort-select');
  var empty = document.getElementById('filter-empty');
  if (!list) return;

  var items = [].slice.call(list.querySelectorAll('.post-item'));

  // 每篇文章的标签
  items.forEach(function (li) {
    var raw = (li.getAttribute('data-tags') || '').trim();
    li._tags = raw ? raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
    li._date = li.getAttribute('data-date') || '';
    li._title = li.getAttribute('data-title') || '';
  });

  // ---------- 排序 ----------
  function applySort(mode) {
    var sorted = items.slice();
    sorted.sort(function (a, b) {
      if (mode === 'title') return a._title.localeCompare(b._title, 'zh-Hans-CN');
      var da = Date.parse(a._date) || 0, db = Date.parse(b._date) || 0;
      return mode === 'old' ? da - db : db - da;
    });
    sorted.forEach(function (li) { list.appendChild(li); });
  }

  if (sortSel) {
    sortSel.addEventListener('change', function () { applySort(sortSel.value); });
  }

  // ---------- 标签云（从文章列表统计，无需服务端插件）----------
  var counts = {};
  items.forEach(function (li) {
    li._tags.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
  });

  var tags = Object.keys(counts).sort(function (a, b) {
    return counts[b] - counts[a] || a.localeCompare(b, 'zh-Hans-CN');
  });

  var current = null;

  function renderCloud() {
    if (!cloud) return;
    cloud.innerHTML = '';
    var all = document.createElement('button');
    all.type = 'button';
    all.className = 'tag tag-btn' + (current === null ? ' active' : '');
    all.textContent = '全部 (' + items.length + ')';
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

  // ---------- 筛选 ----------
  function select(tag, pushUrl) {
    current = tag;
    var shown = 0;
    items.forEach(function (li) {
      var hit = tag === null || li._tags.indexOf(tag) !== -1;
      li.hidden = !hit;
      if (hit) shown++;
    });
    if (empty) empty.hidden = shown !== 0;
    renderCloud();
    if (pushUrl && window.history && window.history.replaceState) {
      var url = location.pathname + (tag === null ? '' : '?tag=' + encodeURIComponent(tag));
      window.history.replaceState(null, '', url);
    }
  }

  // ---------- 初始化：读 URL 上的 ?tag= ----------
  var m = location.search.match(/[?&]tag=([^&]*)/);
  var initial = m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null;
  if (initial && tags.indexOf(initial) === -1) initial = null;
  select(initial, false);
  applySort(sortSel ? sortSel.value : 'new');
})();
