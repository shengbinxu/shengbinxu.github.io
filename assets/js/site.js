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

// 首页：标签页切换 + 标签筛选 + 排序
(function () {
  var list = document.getElementById('post-list');
  var cloud = document.getElementById('tag-cloud');
  var sortSel = document.getElementById('sort-select');
  var empty = document.getElementById('filter-empty');
  var main = document.querySelector('.list-main');
  if (!list) return;

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
  if (sortSel) sortSel.addEventListener('change', function () { applySort(sortSel.value); render(); });

  function matches(c) { return current === null || c._tags.indexOf(current) !== -1; }

  // ---------- 渲染 ----------
  function render() {
    // 标签云
    if (cloud) {
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

    // 旧的分组容器清掉
    var old = main && main.querySelector('.tag-groups');
    if (old) old.remove();

    var shown = cards.filter(matches);
    if (empty) empty.hidden = shown.length !== 0;

    if (view === 'tag') {
      list.hidden = true;
      var wrap = document.createElement('div');
      wrap.className = 'tag-groups';
      var byTag = {};
      shown.forEach(function (c) { c._tags.forEach(function (t) { (byTag[t] = byTag[t] || []).push(c); }); });
      Object.keys(byTag).sort(function (a, b) {
        return byTag[b].length - byTag[a].length || a.localeCompare(b, 'zh-Hans-CN');
      }).forEach(function (t) {
        var g = document.createElement('section');
        g.className = 'tag-group';
        var h = document.createElement('h3');
        h.className = 'tag-group-title';
        h.textContent = t + ' (' + byTag[t].length + ')';
        g.appendChild(h);
        byTag[t].forEach(function (c) {
          var clone = c.cloneNode(true);
          clone.classList.add('post-card');
          clone.removeAttribute('id');
          g.appendChild(clone);
        });
        wrap.appendChild(g);
      });
      main.insertBefore(wrap, list);
    } else {
      list.hidden = false;
      cards.forEach(function (c) { c.hidden = !matches(c); });
    }
  }

  function select(tag, pushUrl) {
    current = tag;
    render();
    if (pushUrl && window.history && window.history.replaceState) {
      window.history.replaceState(null, '',
        location.pathname + (tag === null ? '' : '?tag=' + encodeURIComponent(tag)));
    }
  }

  // ---------- 标签页切换 ----------
  var tabs = [].slice.call(document.querySelectorAll('.tab'));
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (x) { x.classList.toggle('is-active', x === tab); });
      view = tab.getAttribute('data-view');
      render();
    });
  });

  // ---------- 初始化 ----------
  var m = location.search.match(/[?&]tag=([^&]*)/);
  var initial = m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null;
  if (initial && tags.indexOf(initial) === -1) initial = null;
  current = initial;
  applySort(sortSel ? sortSel.value : 'new');
  render();
})();
