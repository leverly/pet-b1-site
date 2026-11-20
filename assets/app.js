/* ==========================================================
   PET 备考小站 · 运行时
   主题 / 进度 / 间隔重复（SRS）/ 单词列表 / 测验 / 闪卡
   纯前端，localStorage 持久化
   ========================================================== */
(function () {
  'use strict';
  var P = window.PET = window.PET || {};

  /* ---------------- 工具 ---------------- */
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  P.esc = esc;
  var escRe = function (s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  P.hl = function (t, q) {
    if (!q) return esc(t);
    return esc(t).replace(new RegExp('(' + escRe(q) + ')', 'gi'), '<mark>$1</mark>');
  };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }

  /* ---------------- 主题 ---------------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    store('pet-theme', t);
    var b = document.querySelector('.theme-btn');
    if (b) { b.textContent = t === 'light' ? '☾' : '☀'; b.setAttribute('aria-label', t === 'light' ? '切换到暗色' : '切换到亮色'); }
  }
  P.theme = function () { return document.documentElement.getAttribute('data-theme') || 'light'; };
  P.toggleTheme = function () { applyTheme(P.theme() === 'light' ? 'dark' : 'light'); };

  var savedTheme = load('pet-theme', null);
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  else if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.setAttribute('data-theme', 'light');

  /* ---------------- 已掌握进度 ---------------- */
  var KNOWN_KEY = 'pet-known-v1';
  var known = load(KNOWN_KEY, {}) || {};
  P.isKnown = function (w) { return !!known[String(w).toLowerCase()]; };
  P.toggleKnown = function (w) {
    var k = String(w).toLowerCase();
    if (known[k]) delete known[k]; else known[k] = 1;
    store(KNOWN_KEY, known);
    document.dispatchEvent(new CustomEvent('pet:known', { detail: { word: w, on: !!known[k] } }));
    return !!known[k];
  };
  P.knownCount = function () { return Object.keys(known).length; };
  P.clearKnown = function () { known = {}; store(KNOWN_KEY, known); document.dispatchEvent(new CustomEvent('pet:known', { detail: { reset: true } })); };

  /* ---------------- 间隔重复（SM-2 简化版） ----------------
     每张卡记录：ease（难度因子）、ivl（间隔天数）、due（下次到期时间戳）、reps
     评级：again(0) hard(1) good(2) easy(3)
     -------------------------------------------------------- */
  var SRS_KEY = 'pet-srs-v1';
  var srs = load(SRS_KEY, {}) || {};
  var DAY = 86400000;

  P.srsGet = function (w) { return srs[String(w).toLowerCase()] || null; };
  P.srsAll = function () { return srs; };
  P.srsDueCount = function (list) {
    var now = Date.now();
    if (!list) return Object.keys(srs).filter(function (k) { return (srs[k].due || 0) <= now; }).length;
    return list.filter(function (w) {
      var r = srs[String(w).toLowerCase()];
      return !r || (r.due || 0) <= now;
    }).length;
  };
  P.srsStats = function () {
    var now = Date.now(), keys = Object.keys(srs);
    var due = 0, learning = 0, mature = 0, sum = 0;
    keys.forEach(function (k) {
      var r = srs[k];
      if (!r) return;
      if ((r.due || 0) <= now) due++;
      if ((r.ivl || 0) >= 21) mature++; else learning++;
      sum += (r.reps || 0);
    });
    return { total: keys.length, due: due, learning: learning, mature: mature, reviews: sum };
  };
  /* ---------------- 每日学习量 + 连续天数 ----------------
     备考产品必须有「今天做了多少 / 连续坚持几天」，
     否则用户不知道今天算不算完成、也看不到势头。
     -------------------------------------------------------- */
  var DAYLOG_KEY = 'pet-daylog-v1';
  var daylog = load(DAYLOG_KEY, {}) || {};
  var GOAL_KEY = 'pet-goal-v1';
  var goal = load(GOAL_KEY, 20) || 20;   // 每日单词目标

  function dayKey(d) {
    var x = d || new Date();
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  }
  P.todayKey = function () { return dayKey(); };
  P.todayWords = function () { return (daylog[dayKey()] || {}).words || 0; };
  P.todayQuestions = function () { return (daylog[dayKey()] || {}).questions || 0; };
  P.goal = function () { return goal; };
  P.setGoal = function (n) {
    goal = Math.max(5, Math.min(200, parseInt(n, 10) || 20));
    store(GOAL_KEY, goal);
    document.dispatchEvent(new CustomEvent('pet:daily', { detail: {} }));
    return goal;
  };
  P.todayPct = function () {
    return goal ? Math.min(100, Math.round(P.todayWords() / goal * 100)) : 0;
  };
  P.bumpDay = function (kind, n) {
    var k = dayKey();
    var d = daylog[k] || (daylog[k] = {});
    d[kind] = (d[kind] || 0) + (n || 1);
    store(DAYLOG_KEY, daylog);
    document.dispatchEvent(new CustomEvent('pet:daily', { detail: { kind: kind } }));
  };
  /** 连续学习天数：从今天往前数，只要某天有记录就继续 */
  P.streak = function () {
    var n = 0, d = new Date();
    for (var i = 0; i < 3660; i++) {
      var rec = daylog[dayKey(d)];
      var active = rec && ((rec.words || 0) + (rec.questions || 0) > 0);
      // 今天还没学习不算断签（避免早上打开就看到清零）
      if (!active && i === 0) { d.setDate(d.getDate() - 1); continue; }
      if (!active) break;
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  };
  P.resetDaily = function () { daylog = {}; store(DAYLOG_KEY, daylog); };

  /* ---------------- 单词错题本 ----------------
     语法题用 qlog.wrongIds；单词没有题号，单独存一份。
     记录：错几次 / 错的时间 / 之后答对几次。
     连续答对 MASTER_STREAK 次才判定「已掌握」，从错题本移除。
     ---------------------------------------- */
  var WBOOK_KEY = 'pet-wordbook-v1';
  var wbook = load(WBOOK_KEY, {}) || {};
  var MASTER_STREAK = 2;

  P.wordBook = function () { return wbook; };
  P.wordBookList = function () {
    return Object.keys(wbook).map(function (k) {
      var r = wbook[k];
      return { w: k, wrong: r.wrong || 1, right: r.right || 0, last: r.last || 0, at: r.at || 0 };
    }).sort(function (a, b) { return b.at - a.at; });
  };
  P.wordBookCount = function () { return Object.keys(wbook).length; };
  /** 记录一次单词结果：ok=false 进错题本；ok=true 累计对题，达标则移除 */
  P.wordAttempt = function (w, ok) {
    var k = String(w).toLowerCase();
    if (!ok) {
      var r = wbook[k] || { wrong: 0, right: 0, at: 0 };
      r.wrong = (r.wrong || 0) + 1;
      r.right = 0;             // 答错即清零连对
      r.at = Date.now();
      r.last = r.at;
      wbook[k] = r;
      store(WBOOK_KEY, wbook);
      document.dispatchEvent(new CustomEvent('pet:wordbook', { detail: { word: w, ok: false } }));
      return false;
    }
    var e = wbook[k];
    if (!e) return false;      // 不在错题本里，答对无需处理
    e.right = (e.right || 0) + 1;
    e.last = Date.now();
    var mastered = e.right >= MASTER_STREAK;
    if (mastered) delete wbook[k];
    store(WBOOK_KEY, wbook);
    document.dispatchEvent(new CustomEvent('pet:wordbook', { detail: { word: w, ok: true, mastered: mastered } }));
    return mastered;
  };
  /** 手动确认掌握，直接移出错题本 */
  P.wordMaster = function (w) {
    var k = String(w).toLowerCase();
    if (!wbook[k]) return false;
    delete wbook[k];
    store(WBOOK_KEY, wbook);
    document.dispatchEvent(new CustomEvent('pet:wordbook', { detail: { word: w, ok: true, mastered: true } }));
    return true;
  };
  P.wordBookReset = function () {
    wbook = {};
    store(WBOOK_KEY, wbook);
    document.dispatchEvent(new CustomEvent('pet:wordbook', { detail: { reset: true } }));
  };
  P.MASTER_STREAK = MASTER_STREAK;

  P.srsRate = function (w, grade) {
    // 同步更新错题本：忘了/困难记为错，会了/很熟记为对
    P.wordAttempt(w, grade >= 2);
    var k = String(w).toLowerCase();
    var r = srs[k] || { ease: 2.5, ivl: 0, due: 0, reps: 0, lapses: 0 };
    if (grade === 0) {
      r.ease = Math.max(1.3, r.ease - 0.2);
      r.ivl = 0;
      r.lapses = (r.lapses || 0) + 1;
      r.due = Date.now() + 10 * 60000;      // 10 分钟后再来
    } else {
      if (grade === 1) r.ease = Math.max(1.3, r.ease - 0.15);
      if (grade === 3) r.ease = Math.min(3.2, r.ease + 0.15);
      if (r.reps === 0) r.ivl = grade === 1 ? 0.5 : grade === 2 ? 1 : 2;
      else if (r.reps === 1) r.ivl = grade === 1 ? 1 : grade === 2 ? 3 : 5;
      else r.ivl = Math.max(1, Math.round(r.ivl * r.ease * (grade === 1 ? 0.8 : grade === 3 ? 1.25 : 1)));
      r.due = Date.now() + r.ivl * DAY;
    }
    r.reps = (r.reps || 0) + 1;
    r.last = Date.now();
    srs[k] = r;
    store(SRS_KEY, srs);
    P.bumpDay('words', 1);
    document.dispatchEvent(new CustomEvent('pet:srs', { detail: { word: w } }));
    return r;
  };
  P.srsReset = function () { srs = {}; store(SRS_KEY, srs); document.dispatchEvent(new CustomEvent('pet:srs', { detail: { reset: true } })); };

  /* ---------------- 答题记录 ----------------
     topicStats: 按考点累计正确率（驱动「最弱考点」推荐）
     wrongIds:   错题本，记录具体题号，答对一次即移出
     ---------------------------------------- */
  var QLOG_KEY = 'pet-qlog-v2';
  var qlog = load(QLOG_KEY, null);
  if (!qlog || typeof qlog !== 'object' || !qlog.topicStats) {
    // 兼容旧结构 {topic:{n,ok}} -> 新结构
    var legacy = qlog && qlog.topicStats === undefined ? qlog : {};
    qlog = { topicStats: {}, wrongIds: {} };
    Object.keys(legacy).forEach(function (t) {
      var r = legacy[t];
      if (r && typeof r.n === 'number') qlog.topicStats[t] = { n: r.n, ok: r.ok || 0 };
    });
  }
  P.qLog = function () { return qlog; };
  P.qRecord = function (topic, ok, id) {
    var r = qlog.topicStats[topic] = qlog.topicStats[topic] || { n: 0, ok: 0 };
    r.n++;
    if (ok) r.ok++;
    if (id) {
      if (ok) delete qlog.wrongIds[id];
      else qlog.wrongIds[id] = { t: topic, at: Date.now() };
    }
    store(QLOG_KEY, qlog);
    P.bumpDay('questions', 1);
    document.dispatchEvent(new CustomEvent('pet:qlog', { detail: { topic: topic, ok: ok } }));
  };
  P.qTopicStats = function () {
    var out = [];
    Object.keys(qlog.topicStats).forEach(function (t) {
      var r = qlog.topicStats[t];
      out.push({ topic: t, n: r.n, ok: r.ok, rate: r.n ? r.ok / r.n : 0 });
    });
    return out;
  };
  P.wrongIds = function () { return Object.keys(qlog.wrongIds || {}); };
  P.qClearWrong = function (id) {
    if (id) delete qlog.wrongIds[id]; else qlog.wrongIds = {};
    store(QLOG_KEY, qlog);
  };
  P.qReset = function () { qlog = { topicStats: {}, wrongIds: {} }; store(QLOG_KEY, qlog); };

  /* ---------------- DOM 就绪 ---------------- */
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  P.ready = ready;

  ready(function () {
    document.body.classList.add('js-ready');

    var tb = document.querySelector('.theme-btn');
    if (tb) tb.addEventListener('click', P.toggleTheme);
    applyTheme(document.documentElement.getAttribute('data-theme') || 'light');

    /* 移动菜单 */
    var mb = document.querySelector('.menu-btn');
    var nav = document.querySelector('.hdr-nav');
    if (mb && nav) {
      mb.addEventListener('click', function (e) {
        e.stopPropagation();
        nav.classList.toggle('open');
        mb.setAttribute('aria-expanded', nav.classList.contains('open'));
      });
      document.addEventListener('click', function (e) {
        if (!nav.contains(e.target) && e.target !== mb) nav.classList.remove('open');
      });
    }

    /* 当前页高亮 */
    var path = location.pathname.split('/').pop() || 'index.html';
    var dir = location.pathname.replace(/[^/]*$/, '').split('/').filter(Boolean).pop() || '';
    document.querySelectorAll('.hdr-nav a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      var parts = href.split('/');
      var file = parts.pop();
      var folder = parts.filter(function (p) { return p && p !== '..'; }).pop() || '';
      var match = file === 'index.html'
        ? (folder ? folder === dir : (path === 'index.html' || path === ''))
        : (file === path);
      if (match) {
        document.querySelectorAll('.hdr-nav a').forEach(function (x) { x.classList.remove('on'); });
        a.classList.add('on');
      }
    });

    /* 阅读进度 */
    var sp = document.querySelector('.scroll-progress');
    if (sp) {
      var onScroll = function () {
        var h = document.documentElement;
        var max = h.scrollHeight - h.clientHeight;
        sp.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
      };
      document.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    /* 数字滚动 */
    var counters = document.querySelectorAll('[data-count]');
    if (counters.length) {
      var runCount = function (el) {
        if (el.__done) return;
        el.__done = 1;
        var target = parseFloat(el.getAttribute('data-count')) || 0;
        var dec = (el.getAttribute('data-count') || '').indexOf('.') >= 0 ? 1 : 0;
        if (reduceMotion) { el.textContent = target.toFixed(dec); return; }
        var t0 = performance.now(), dur = 900;
        (function tick(now) {
          var p = Math.min(1, (now - t0) / dur);
          var v = target * (1 - Math.pow(1 - p, 3));
          el.textContent = dec ? v.toFixed(1) : Math.round(v).toLocaleString('en-US');
          if (p < 1) requestAnimationFrame(tick);
        })(t0);
      };
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (e) { if (e.isIntersecting) { runCount(e.target); io.unobserve(e.target); } });
        }, { threshold: .35 });
        counters.forEach(function (c) { io.observe(c); });
        setTimeout(function () { counters.forEach(runCount); }, 1600);
      } else counters.forEach(runCount);
    }

    /* 滚动揭示：默认可见，只有视口外的才先隐藏 */
    if (!reduceMotion && 'IntersectionObserver' in window) {
      var revealNodes = document.querySelectorAll('.reveal');
      var io2 = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.remove('out'); io2.unobserve(e.target); }
        });
      }, { threshold: .06, rootMargin: '0px 0px -40px 0px' });
      revealNodes.forEach(function (n) {
        var r = n.getBoundingClientRect();
        if (r.top > window.innerHeight) { n.classList.add('out'); io2.observe(n); }
      });
    }
  });

  /* ==========================================================
     单词列表渲染（词表页 / 话题页共用）
     ========================================================== */
  P.renderWordList = function (opts) {
    var host = document.querySelector(opts.mount);
    if (!host) return;
    // 默认按词频升序 = 最常出现的词排前面，这才是备考该有的顺序
    var all = (opts.words || []).slice().sort(function (a, b) {
      var fa = a.frq || 999999, fb = b.frq || 999999;
      if (fa !== fb) return fa - fb;
      return a.w.toLowerCase() < b.w.toLowerCase() ? -1 : 1;
    });
    var pageSize = opts.pageSize || 40;
    var page = 0;
    var query = '';
    var filter = 'all';

    function match(w) {
      if (filter === 'b1' && w.tag !== 'b1') return false;
      if (filter === 'b2' && w.tag !== 'b2') return false;
      if (filter === 'b3' && w.tag !== 'b3') return false;
      if (filter === 'phrase' && w.t !== 'phrase') return false;
      if (filter === 'known' && !P.isKnown(w.w)) return false;
      if (filter === 'new' && P.isKnown(w.w)) return false;
      if (!query) return true;
      var q = query.toLowerCase();
      if (w.w.toLowerCase().indexOf(q) >= 0) return true;
      if ((w.zh || '').indexOf(query) >= 0) return true;
      return (w.al || []).some(function (a) { return a.toLowerCase().indexOf(q) >= 0; });
    }

    function rowHtml(w) {
      var tagCls = w.tag === 'b1' ? 'tag-b1' : w.tag === 'b2' ? 'tag-b2' : 'tag-b3';
      var tagTxt = w.tag === 'b1' ? '高频' : w.tag === 'b2' ? '中频' : '低频';
      var known = P.isKnown(w.w) ? ' known' : '';
      var h = '<div class="wrow' + known + '" data-w="' + esc(w.w) + '">';
      var al = (w.al && w.al.length) ? '<span class="ph" style="margin-left:2px">= ' + esc(w.al[0]) + '</span>' : '';
      h += '<span class="w">' + P.hl(w.w, query) + al + (w.ph ? '<span class="ph">/' + esc(w.ph) + '/</span>' : '') + '</span>';
      h += '<span class="pos">' + esc(w.posZh) + '</span>';
      h += '<span class="zh">' + P.hl(w.zh, query) + '</span>';
      h += '<span class="flag ' + tagCls + '">' + tagTxt + '</span>';
      if (w.ex && w.ex.length) h += '<span class="ex">' + esc(w.ex[0]) + '</span>';
      h += '</div>';
      return h;
    }

    function draw() {
      var list = all.filter(match);
      var total = Math.ceil(list.length / pageSize) || 1;
      if (page >= total) page = total - 1;
      if (page < 0) page = 0;
      var slice = list.slice(page * pageSize, (page + 1) * pageSize);
      var html = '<div class="wordlist">' + slice.map(rowHtml).join('') + '</div>';
      if (!list.length) {
        html = '<div class="empty"><b>没有匹配的词</b>换个关键词或筛选项试试</div>';
      }
      var pager = '';
      if (list.length > pageSize) {
        pager = '<div class="pager">';
        pager += '<button data-pg="' + (page - 1) + '"' + (page === 0 ? ' disabled' : '') + '>‹</button>';
        var pages = [];
        if (total <= 9) { for (var i = 0; i < total; i++) pages.push(i); }
        else {
          pages = [0];
          if (page > 2) pages.push('…');
          for (var j = Math.max(1, page - 1); j <= Math.min(total - 2, page + 1); j++) pages.push(j);
          if (page < total - 3) pages.push('…');
          pages.push(total - 1);
        }
        pages.forEach(function (p) {
          if (p === '…') pager += '<span class="pager dots">…</span>';
          else pager += '<button data-pg="' + p + '"' + (p === page ? ' class="on"' : '') + '>' + (p + 1) + '</button>';
        });
        pager += '<button data-pg="' + (page + 1) + '"' + (page === total - 1 ? ' disabled' : '') + '>›</button>';
        pager += '</div>';
      }
      var count = '<div class="note" style="margin-top:14px">共 <b>' + list.length + '</b> 条' +
        (list.length !== all.length ? '（已筛选，总计 ' + all.length + '）' : '') +
        ' · 第 ' + (page + 1) + ' / ' + total + ' 页 · 点单词标记已掌握</div>';
      host.innerHTML = html + pager + count;

      host.querySelectorAll('.wrow .w').forEach(function (el) {
        el.addEventListener('click', function () {
          var row = el.closest('.wrow');
          var w = row.getAttribute('data-w');
          var on = P.toggleKnown(w);
          row.classList.toggle('known', on);
        });
      });
      host.querySelectorAll('[data-pg]').forEach(function (b) {
        b.addEventListener('click', function () {
          var p = parseInt(b.getAttribute('data-pg'), 10);
          if (!isNaN(p)) { page = p; draw(); }
        });
      });
    }

    var tb = document.querySelector(opts.search || '#wq');
    if (tb) {
      var t;
      tb.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { query = tb.value.trim(); page = 0; draw(); }, 140);
      });
    }
    document.querySelectorAll('[data-filter]').forEach(function (c) {
      c.addEventListener('click', function () {
        document.querySelectorAll('[data-filter]').forEach(function (x) { x.classList.remove('on'); });
        c.classList.add('on');
        filter = c.getAttribute('data-filter');
        page = 0; draw();
      });
    });
    if (opts.onKnown) document.addEventListener('pet:known', function () { draw(); });
    draw();
    return { redraw: draw };
  };

  /* ==========================================================
     测验引擎
     ========================================================== */
  P.quiz = function (opts) {
    var host = document.querySelector(opts.mount);
    if (!host) return;
    var pool = (opts.questions || []).slice();
    if (opts.shuffle !== false) pool = shuffle(pool);
    if (opts.limit) pool = pool.slice(0, opts.limit);
    var i = 0, correct = 0, streak = 0, best = 0, answered = false;
    var total = pool.length;

    host.innerHTML =
      '<div class="quiz-top">' +
        '<div class="quiz-progress"><i id="qp"></i></div>' +
        '<span class="quiz-count" id="qc">1 / ' + total + '</span>' +
        '<span class="quiz-count" id="qs">连击 0</span>' +
      '</div>' +
      '<div id="qbody"></div>';

    var body = host.querySelector('#qbody');

    function draw() {
      answered = false;
      var q = pool[i];
      if (!q) return done();
      var typeName = q.type === 'correct' ? '改错' : q.type === 'fill' ? '填空' : '选择';
      var stem = esc(q.stem).replace(/___/g, '<span class="blank">　</span>');
      var h = '<div class="qcard">';
      h += '<div class="qmeta"><span class="qtype">' + typeName + '</span>' +
           (q.level ? '<span class="lv ' + esc(q.level) + '">' + esc(q.level) + '</span>' : '') + '</div>';
      h += '<div class="qstem">' + stem + '</div>';

      if (q.type === 'fill') {
        h += '<div class="qfill"><input id="qin" type="text" autocomplete="off" spellcheck="false" placeholder="输入答案…">' +
             '<button class="btn primary" id="qsub">检查</button></div>';
      } else {
        h += '<div class="qopts">';
        q.options.forEach(function (o, k) {
          h += '<button class="qopt" data-k="' + k + '"><span class="key">' + 'ABCD'[k] + '</span><span>' + esc(o) + '</span></button>';
        });
        h += '</div>';
      }
      h += '<div id="qfb"></div>';
      h += '<div class="quiz-actions"><span class="spacer"></span><button class="btn primary" id="qnext" disabled style="opacity:.4">下一题 →</button></div>';
      h += '</div>';
      body.innerHTML = h;

      host.querySelector('#qp').style.width = ((i) / total * 100) + '%';
      host.querySelector('#qc').textContent = (i + 1) + ' / ' + total;
      host.querySelector('#qs').textContent = '连击 ' + streak;

      if (q.type === 'fill') {
        var inp = host.querySelector('#qin');
        inp.focus();
        var submit = function () { judgeFill(q, inp.value); };
        host.querySelector('#qsub').addEventListener('click', submit);
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
      } else {
        host.querySelectorAll('.qopt').forEach(function (b) {
          b.addEventListener('click', function () { judgeChoice(q, parseInt(b.getAttribute('data-k'), 10)); });
        });
      }
      host.querySelector('#qnext').addEventListener('click', function () { i++; draw(); });

      if (opts.onQuestion) opts.onQuestion(q);
    }

    // 键盘：1–4 选择、Enter 下一题
    if (!host.__keys) {
      host.__keys = 1;
      document.addEventListener('keydown', function (e) {
        if (!document.body.contains(host)) return;
        var tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        var q = pool[i];
        if (!q) return;
        if (/^[1-4]$/.test(e.key) && q.type !== 'fill' && !answered) {
          var btn = host.querySelector('.qopt[data-k="' + (parseInt(e.key, 10) - 1) + '"]');
          if (btn) { e.preventDefault(); btn.click(); }
        } else if (e.key === 'Enter' && answered) {
          var nx = host.querySelector('#qnext');
          if (nx && !nx.disabled) { e.preventDefault(); nx.click(); }
        }
      });
    }

    function judgeChoice(q, k) {
      if (answered) return;
      answered = true;
      var ok = k === q.answer;
      host.querySelectorAll('.qopt').forEach(function (b) {
        var bi = parseInt(b.getAttribute('data-k'), 10);
        b.classList.add('locked');
        if (bi === q.answer) b.classList.add('right');
        else if (bi === k) b.classList.add('wrong');
      });
      finish(ok, q);
    }

    function judgeFill(q, val) {
      if (answered) return;
      answered = true;
      var norm = function (s) {
        return String(s).toLowerCase().trim()
          .replace(/[’‘]/g, "'")
          .replace(/[.,!?;:]+$/, '')
          .replace(/\s+/g, ' ');
      };
      var ok = (q.accept || [q.answer]).some(function (a) { return norm(a) === norm(val); });
      var inp = host.querySelector('#qin');
      inp.classList.add(ok ? 'right' : 'wrong');
      inp.readOnly = true;
      host.querySelector('#qsub').disabled = true;
      finish(ok, q, ok ? '' : q.answer);
    }

    function finish(ok, q, refAnswer) {
      if (ok) { correct++; streak++; if (streak > best) best = streak; }
      else streak = 0;
      host.querySelector('#qs').textContent = '连击 ' + streak;
      var fb = host.querySelector('#qfb');
      var ref = refAnswer
        ? '<div style="margin-bottom:6px"><b style="display:inline">参考答案：</b><span style="color:var(--ok);font-family:var(--serif);font-size:1rem">' + esc(refAnswer) + '</span></div>'
        : '';
      fb.innerHTML = '<div class="feedback' + (ok ? '' : ' bad') + '"><b>' +
        (ok ? '✓ 正确' + (streak >= 3 ? ' · 连击 ' + streak + '！' : '') : '✗ 再想想') +
        '</b>' + ref + esc(q.why) + '</div>';
      var nx = host.querySelector('#qnext');
      nx.disabled = false;
      nx.style.opacity = '';
      nx.focus();
      if (P.qRecord) P.qRecord(q.topic, ok, q.id);
      if (opts.onAnswer) opts.onAnswer(q, ok);
    }

    function done() {
      var rate = total ? Math.round(correct / total * 100) : 0;
      host.querySelector('#qp').style.width = '100%';
      body.innerHTML = '<div class="qcard" style="text-align:center;justify-content:center">' +
        '<div style="font-family:var(--mono);font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3)">本轮结果</div>' +
        '<div style="font-family:var(--serif);font-size:3rem;font-weight:600;margin:10px 0">' + rate + '<span style="font-size:1.3rem">%</span></div>' +
        '<div style="color:var(--text-2)">答对 ' + correct + ' / ' + total + ' 题 · 最高连击 ' + best + '</div>' +
        '<div style="margin-top:26px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
          '<button class="btn primary" id="qagain">再来一轮</button>' +
          (opts.reviewHref ? '<a class="btn ghost" href="' + opts.reviewHref + '">' + (opts.reviewLabel || '返回') + '</a>' : '') +
        '</div></div>';
      var b = host.querySelector('#qagain');
      if (b) b.addEventListener('click', function () {
        if (opts.onRestart) { opts.onRestart(); return; }
        i = 0; correct = 0; streak = 0; best = 0;
        pool = shuffle(pool.slice());
        host.querySelector('#qbody').innerHTML = '';
        draw();
      });
      if (opts.onFinish) opts.onFinish({ correct: correct, total: total, rate: rate, best: best });
    }

    draw();
  };


  /* ----------------------------------------------------------
     发音播放：音频是构建期预合成的（单词连读 3 遍），
     所以这里只负责播放，不在运行时请求 TTS。
     ---------------------------------------------------------- */
  // 数据是页面内联注入的，且可能晚于本脚本执行 —— 每次访问时再取
  function audioMapGet() {
    return (window.PET_DATA && window.PET_DATA.PET_AUDIO) || window.PET_AUDIO || {};
  }
  var audioMap = audioMapGet();
  var currentAudio = null;
  var playTimer = null;

  P.hasAudio = function (w) { return !!audioMapGet()[w]; };
  P.audioSrc = function (w) {
    var rel = audioMapGet()[w];
    if (!rel) return '';
    // 站点可能部署在子路径下：以当前页面所在目录为基准解析
    return rel;
  };
  P.playWord = function (w, opts) {
    var src = P.audioSrc(w);
    if (!src) return false;
    var o = opts || {};
    var times = o.times || 3;     // 音频只存 1 遍，连着播 3 遍 = 朗读三次
    var gap = o.gap == null ? 260 : o.gap;
    try {
      if (currentAudio) { currentAudio.pause(); currentAudio = null; }
      if (playTimer) { clearTimeout(playTimer); playTimer = null; }
      var a = new Audio(src);
      a.volume = o.volume == null ? 1 : o.volume;
      currentAudio = a;
      var played = 0;
      a.addEventListener('ended', function () {
        played++;
        if (played < times) {
          playTimer = setTimeout(function () {
            try { a.currentTime = 0; a.play().catch(function () {}); } catch (e) {}
          }, gap);
        } else if (o.onend) {
          o.onend();
        }
      });
      var p = a.play();
      if (p && p.catch) p.catch(function () { /* 浏览器可能拦截自动播放 */ });
      return true;
    } catch (e) {
      return false;
    }
  };
  P.stopAudio = function () {
    if (playTimer) { clearTimeout(playTimer); playTimer = null; }
    if (currentAudio) { try { currentAudio.pause(); } catch (e) {} currentAudio = null; }
  };

  /* ----------------------------------------------------------
     干扰项挑选：优先同话题 + 同词性，并排除释义高度重叠的词
     ---------------------------------------------------------- */
  function glossSegments(t) {
    return String(t || '').split(/[；;,，、]/).map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function tooSimilar(a, b) {
    if (!a || !b) return false;
    var sa = glossSegments(a), sb = glossSegments(b);
    for (var i = 0; i < sa.length; i++) {
      for (var j = 0; j < sb.length; j++) {
        if (sa[i].length >= 2 && sa[i] === sb[j]) return true;
      }
    }
    return false;
  }
  function pickDistractors(pool, target, n) {
    var sameTopic = [], samePos = [], others = [];
    var taken = [target.zh];
    pool.forEach(function (w) {
      if (w.w === target.w || !w.zh) return;
      if (tooSimilar(w.zh, target.zh)) return;
      var share = (w.tp || []).some(function (t) { return (target.tp || []).indexOf(t) >= 0; });
      if (share && w.pos === target.pos) sameTopic.push(w);
      else if (w.pos === target.pos) samePos.push(w);
      else others.push(w);
    });
    var out = [];
    [sameTopic, samePos, others].forEach(function (arr) {
      var a = shuffle(arr.slice());
      for (var k = 0; k < a.length && out.length < n; k++) {
        if (taken.some(function (t) { return tooSimilar(t, a[k].zh); })) continue;
        taken.push(a[k].zh);
        out.push(a[k]);
      }
    });
    return out;
  }
  P.pickDistractors = pickDistractors;

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  P.shuffle = shuffle;

  /* ==========================================================
     背单词（SRS 驱动）
     两种模式：
       choice — 给英文选中文的四选一，系统自动判分（默认）
       recall — 看词回想，翻卡后自评「忘了/困难/会了/很熟」（仅 API 保留）
     评级统一写入记忆库，决定下次出现的间隔
     ========================================================== */
  P.wordStudy = function (opts) {
    var host = document.querySelector(opts.mount);
    if (!host) return;
    var pool = (opts.words || []).filter(function (w) { return w.w; });
    if (!pool.length) { host.innerHTML = '<div class="empty"><b>没有可学的词</b></div>'; return; }
    var mode = opts.mode || 'due';          // due | new | mix
    var card = opts.card || 'recall';       // recall | choice
    var queue = [], idx = 0, revealed = false;
    var sessionN = 0, sessionOk = 0, streak = 0, best = 0;
    var answered = false, finished = false;
    var autoNextTimer = null;
    var pendingAdvance = false;   // 本题已判对、等待前进；保证只前进一次
    var AUTO_NEXT_MS = 750;   // 答对后自动翻页的停顿，够看清反馈又不拖沓

    /* 前进到下一题：定时器与键盘/按钮都走这里，重复调用只生效一次 */
    function advance() {
      if (!pendingAdvance) return;
      pendingAdvance = false;
      clearTimeout(autoNextTimer);
      autoNextTimer = null;
      idx++;
      draw();
    }

    function build() {
      clearTimeout(autoNextTimer);
      var now = Date.now();
      var scored = pool.map(function (w) {
        var r = P.srsGet(w.w);
        return { w: w, due: r ? r.due : 0, has: !!r, ivl: r ? (r.ivl || 0) : 0 };
      });
      if (mode === 'due') scored = scored.filter(function (s) { return !s.has || (s.due || 0) <= now; });
      else if (mode === 'new') scored = scored.filter(function (s) { return !s.has; });
      scored.sort(function (a, b) {
        if (mode === 'mix') {
          var ad = (a.due || 0) <= now ? 0 : 1, bd = (b.due || 0) <= now ? 0 : 1;
          if (ad !== bd) return ad - bd;
          if (a.has !== b.has) return a.has ? 1 : -1;
        }
        return (a.due || 0) - (b.due || 0);
      });
      queue = scored.slice(0, opts.limit || 20).map(function (s) { return s.w; });
      shuffle(queue);
      idx = 0; sessionN = 0; sessionOk = 0; streak = 0; best = 0; finished = false;
      draw();
    }

    function header() {
      return '<div class="quiz-top">' +
        '<div class="quiz-progress"><i style="width:' + (queue.length ? idx / queue.length * 100 : 0) + '%"></i></div>' +
        '<span class="quiz-count">' + Math.min(idx + 1, queue.length) + ' / ' + queue.length + '</span>' +
        '<span class="quiz-count" id="qs">连击 ' + streak + '</span></div>';
    }

    function draw() {
      if (!queue.length) return emptyState();
      if (idx >= queue.length) return done();
      revealed = false; answered = false; pendingAdvance = false;
      var w = queue[idx];
      host.innerHTML = card === 'choice' ? choiceView(w) : recallView(w);
      bindKeys();
    }

    function emptyState() {
      host.innerHTML = '<div class="qcard" style="text-align:center;justify-content:center">' +
        '<div style="font-family:var(--serif);font-size:1.35rem;font-weight:600;margin-bottom:10px">今天没有到期的词</div>' +
        '<div style="color:var(--text-2);font-size:.92rem;line-height:1.7">按遗忘曲线的排期，暂时没有需要复习的词。<br>想多学的话，切到「只学新词」或「混合」模式。</div>' +
        '<div style="margin-top:24px"><button class="btn primary" id="wsMix">切到混合模式</button></div></div>';
      var b = host.querySelector('#wsMix');
      if (b) b.addEventListener('click', function () { mode = 'mix'; build(); });
    }

    /* ---- 回想模式 ---- */
    function recallView(w) {
      var h = '<div class="flash-shell">' + header();
      h += '<div class="fcard">';
      h += '<div class="fword">' + esc(w.w) + '</div>';
      if (w.ph) h += '<div class="fph">/' + esc(w.ph) + '/</div>';
      h += '<div class="fpos">' + esc(w.posZh) + (w.t === 'phrase' ? ' · 短语' : '') + '</div>';
      h += '<div id="frev"></div>';
      h += '<div class="fhint">先想意思，再点「看答案」或按空格</div>';
      h += '</div>';
      h += '<div class="quiz-actions"><span class="spacer"></span><button class="btn primary" id="fshow">看答案 (空格)</button></div>';
      h += '</div>';
      setTimeout(function () {
        var b = host.querySelector('#fshow');
        if (b) b.addEventListener('click', revealRecall);
      }, 0);
      return h;
    }

    function revealRecall() {
      if (revealed) return;
      revealed = true;
      var w = queue[idx];
      var h = '<div class="fzh">' + esc(w.zh || '（无释义）') + '</div>';
      if (w.ex && w.ex.length) h += '<div class="fex">' + esc(w.ex[0]) + '</div>';
      host.querySelector('#frev').innerHTML = h;
      var hint = host.querySelector('.fhint');
      if (hint) hint.style.display = 'none';
      var act = host.querySelector('.quiz-actions');
      act.innerHTML = '<div class="rate-row" style="width:100%">' +
        '<button class="rate again" data-g="0"><b>忘了</b><small>10 分钟</small></button>' +
        '<button class="rate hard" data-g="1"><b>困难</b><small>约 1 天</small></button>' +
        '<button class="rate good" data-g="2"><b>会了</b><small>按计划</small></button>' +
        '<button class="rate easy" data-g="3"><b>很熟</b><small>更久</small></button></div>';
      act.querySelectorAll('[data-g]').forEach(function (b) {
        b.addEventListener('click', function () { rate(parseInt(b.getAttribute('data-g'), 10)); });
      });
    }

    /* ---- 四选一模式 ---- */
    function choiceView(w) {
      var ds = pickDistractors(pool, w, 3);
      if (ds.length < 3) return recallView(w);   // 词池太小退回回想
      var opts = [w].concat(ds);
      shuffle(opts);
      var ans = opts.indexOf(w);
      var h = '<div class="flash-shell">' + header();
      var canPlay = P.hasAudio(w.w);
      h += '<div class="fcard" style="justify-content:flex-start;padding-top:30px;text-align:center;min-height:0">';
      h += '<div class="fword" style="font-size:clamp(1.5rem,5vw,2.1rem)">' + esc(w.w) +
           (canPlay ? '<button class="say-btn" id="sayBtn" title="朗读 3 遍" aria-label="朗读单词三遍">🔊</button>' : '') +
           '</div>';
      if (w.ph) h += '<div class="fph">/' + esc(w.ph) + '/</div>';
      h += '<div class="fpos">' + esc(w.posZh) + '</div>';
      h += '<div style="font-size:.84rem;color:var(--text-3);margin-top:12px">' +
           (canPlay ? '听发音，选出正确的释义' : '选出正确的释义') + '</div></div>';
      h += '<div class="qopts" style="margin-top:16px">';
      opts.forEach(function (o, k) {
        h += '<button class="qopt" data-k="' + k + '"' + (k === ans ? ' data-ans="1"' : '') + '>' +
             '<span class="key">' + 'ABCD'[k] + '</span><span>' + esc(o.zh || '') + '</span></button>';
      });
      h += '</div><div id="wfb"></div></div>';
      setTimeout(function () {
        var say = host.querySelector('#sayBtn');
        if (say) say.addEventListener('click', function (e) { e.stopPropagation(); P.playWord(w.w); });
        // 自动朗读：默认开启，用户可在页面上关掉
        if (canPlay && opts.autoSay !== false) P.playWord(w.w);
        host.querySelectorAll('.qopt').forEach(function (b) {
          b.addEventListener('click', function () {
            judgeChoice(w, parseInt(b.getAttribute('data-k'), 10), Array.prototype.indexOf.call(host.querySelectorAll('.qopt'), b), ans);
          });
        });
      }, 0);
      return h;
    }

    function judgeChoice(w, k, clickedIdx, ans) {
      if (answered) return;
      answered = true;
      var ok = k === ans;
      host.querySelectorAll('.qopt').forEach(function (b) {
        var bi = parseInt(b.getAttribute('data-k'), 10);
        b.classList.add('locked');
        if (bi === ans) b.classList.add('right');
        else if (bi === k) b.classList.add('wrong');
      });
      if (ok) { streak++; if (streak > best) best = streak; } else streak = 0;
      var fb = host.querySelector('#wfb');
      if (ok) {
        // 答对：短暂给出确认反馈后自动进入下一词，不打断节奏
        fb.innerHTML = '<div class="feedback auto-next"><b>✓ 对了' +
          (streak >= 3 ? ' · 连击 ' + streak : '') + '</b>' +
          esc(w.zh) + (w.posZh ? ' · ' + esc(w.posZh) : '') +
          '<span class="auto-next-hint">即将进入下一词…</span></div>';
      } else {
        // 答错：停下来让用户看清正确答案，手动进入下一题
        fb.innerHTML = '<div class="feedback bad"><b>✗ 正确答案：' + esc(w.zh) + '</b>' +
          esc(w.w) + (w.ph ? ' /' + esc(w.ph) + '/' : '') + ' · ' + esc(w.posZh) +
          (w.ex && w.ex[0] ? '<div style="margin-top:6px;font-style:italic;font-size:.84rem">' + esc(w.ex[0]) + '</div>' : '') +
          '</div>' +
          '<div class="quiz-actions"><span class="spacer"></span><button class="btn primary" id="wnext">下一词 →</button></div>';
        var nx = fb.querySelector('#wnext');
        nx.addEventListener('click', function () { idx++; draw(); });
        nx.focus();
      }
      // 四选一自动评级：对了算「会了」，错了算「忘了」
      recordAndRate(w, ok ? 2 : 0, ok);
      if (ok) {
        // 标记得以前进，让 Enter 抢答也能立即跳，且与定时器互斥
        pendingAdvance = true;
        clearTimeout(autoNextTimer);
        autoNextTimer = setTimeout(advance, AUTO_NEXT_MS);
      }
    }

    function recordAndRate(w, g, countedOk) {
      P.srsRate(w.w, g);
      sessionN++;
      if (countedOk) sessionOk++;
      if (opts.onRate) opts.onRate(w, g);
      var st = host.querySelector('#qs');
      if (st) st.textContent = '连击 ' + streak;
    }

    /* ---- 回想模式自评 ---- */
    function rate(g) {
      var w = queue[idx];
      recordAndRate(w, g, g >= 2);
      if (g === 0) queue.push(w);   // 忘了的稍后再来一次
      idx++;
      draw();
    }

    function bindKeys() {
      if (host.__keys) return;
      host.__keys = 1;
      document.addEventListener('keydown', function (e) {
        if (!document.body.contains(host) || finished) return;
        var tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        if (card === 'choice') {
          if (/^[1-4]$/.test(e.key) && !answered) {
            var b = host.querySelector('.qopt[data-k="' + (parseInt(e.key, 10) - 1) + '"]');
            if (b) { e.preventDefault(); b.click(); }
          } else if (e.key === 'Enter' && answered) {
            // 答对后 Enter 立即前进；答错时 Enter 走「下一词」按钮
            if (pendingAdvance) { e.preventDefault(); advance(); }
            else {
              var nx = host.querySelector('#wnext');
              if (nx) { e.preventDefault(); nx.click(); }
            }
          }
          return;
        }
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          if (!revealed) revealRecall(); else rate(2);
        } else if (revealed && /^[1-4]$/.test(e.key)) {
          rate(parseInt(e.key, 10) - 1);
        }
      });
    }

    function done() {
      finished = true;
      pendingAdvance = false;
      clearTimeout(autoNextTimer);
      autoNextTimer = null;
      var st = P.srsStats();
      host.innerHTML = '<div class="qcard" style="text-align:center;justify-content:center">' +
        '<div style="font-family:var(--mono);font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3)">本轮完成</div>' +
        '<div style="font-family:var(--serif);font-size:2.6rem;font-weight:600;margin:10px 0">' + sessionOk +
          '<span style="font-size:1.2rem;color:var(--text-3)"> / ' + sessionN + '</span></div>' +
        '<div style="color:var(--text-2)">个词记住了 · 最高连击 ' + best + '<br>' +
          '记忆库共 ' + st.total + ' 个词，今天还有 ' + st.due + ' 个到期</div>' +
        '<div style="margin-top:26px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
          '<button class="btn primary" id="wagain">再来一轮</button>' +
          '<a class="btn ghost" href="' + (opts.backHref || 'index.html') + '">返回</a>' +
        '</div></div>';
      host.querySelector('#wagain').addEventListener('click', build);
      if (opts.onFinish) opts.onFinish({ ok: sessionOk, total: sessionN, best: best });
    }

    build();
    return { rebuild: build };
  };

  /* 兼容旧调用名 */
  P.flashcards = function (opts) {
    return P.wordStudy(Object.assign({}, opts, { card: opts.card || 'recall' }));
  };
})();
