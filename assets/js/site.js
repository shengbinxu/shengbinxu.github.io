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
