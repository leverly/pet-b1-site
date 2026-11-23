/* ==========================================================
   PET 领航 · 剑桥 B1 官方备考系统 · 运行时 v2
   主题 / 进度 / 间隔重复（SRS）/ 词表朗读 / 测验 / 闪卡
   备考倒计时 / XP等级 / 轻音效 / 学习档案备份
   纯前端，localStorage 持久化，向后兼容全部 v1 数据键
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

  /* ---------------- Toast 提示 ---------------- */
  var toastEl = null, toastTimer = null;
  P.toast = function (msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2400);
  };

  /* ---------------- Web Audio 轻提示音效 ---------------- */
  var sfxOn = load('pet-sfx-v1', true);
  var audioCtx = null;
  P.sfxEnabled = function () { return !!sfxOn; };
  P.setSfx = function (on) { sfxOn = !!on; store('pet-sfx-v1', sfxOn); };
  P.sfx = function (kind) {
    if (!sfxOn) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var now = audioCtx.currentTime;
      function tone(freq, start, dur, gainVal, type) {
        var o = audioCtx.createOscillator();
        var g = audioCtx.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(freq, start);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(gainVal, start + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(start); o.stop(start + dur + 0.02);
      }
      if (kind === 'ok') {
        tone(587.33, now, 0.11, 0.06, 'sine');
        tone(880, now + 0.07, 0.16, 0.06, 'sine');
      } else if (kind === 'bad') {
        tone(240, now, 0.18, 0.05, 'triangle');
      } else if (kind === 'win') {
        tone(523.25, now, 0.13, 0.06, 'sine');
        tone(659.25, now + 0.09, 0.13, 0.06, 'sine');
        tone(783.99, now + 0.18, 0.24, 0.07, 'sine');
      }
    } catch (e) {}
  };

  /* ---------------- 主题（按系统本地时间自动切换：6:00-19:00 浅色，19:00-6:00 深色，支持手动切换） ---------------- */
  var THEME_KEY = 'pet-theme-manual';
  function autoThemeByTime() {
    var h = new Date().getHours();
    return (h >= 19 || h < 6) ? 'dark' : 'light';
  }
  function resolveTheme() {
    var m = load(THEME_KEY, null);
    return (m === 'light' || m === 'dark') ? m : autoThemeByTime();
  }
  function applyTheme(t, persist) {
    document.documentElement.setAttribute('data-theme', t);
    if (persist) store(THEME_KEY, t);
    var isManual = !!load(THEME_KEY, null);
    var b = document.querySelector('.theme-btn');
    if (b) {
      b.textContent = t === 'light' ? '☾' : '☀';
      b.setAttribute('aria-label', t === 'light' ? '切换到深色模式' : '切换到浅色模式');
      b.title = (t === 'light' ? '切换到深色模式' : '切换到浅色模式') + (isManual ? '（当前手动设置）' : '（当前随系统时间自动切换）');
    }
  }
  P.theme = function () { return document.documentElement.getAttribute('data-theme') || resolveTheme(); };
  P.toggleTheme = function () { applyTheme(P.theme() === 'light' ? 'dark' : 'light', true); };
  P.resetThemeAuto = function () {
    try { localStorage.removeItem(THEME_KEY); } catch (e) {}
    applyTheme(autoThemeByTime(), false);
  };

  document.documentElement.setAttribute('data-theme', resolveTheme());

  /* ---------------- 考生档案 / 备考倒计时 ---------------- */
  var PROFILE_KEY = 'pet-profile-v1';
  var profile = load(PROFILE_KEY, null) || {
    childName: '',
    examDate: '',
    targetGrade: 'merit'
  };
  P.profile = function () { return Object.assign({}, profile); };
  P.saveProfile = function (patch) {
    profile = Object.assign({}, profile, patch || {});
    store(PROFILE_KEY, profile);
    document.dispatchEvent(new CustomEvent('pet:profile', { detail: profile }));
    return profile;
  };
  P.daysLeft = function () {
    if (!profile.examDate) return null;
    var t = new Date(profile.examDate + 'T00:00:00');
    if (isNaN(t.getTime())) return null;
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.ceil((t.getTime() - now.getTime()) / 86400000);
  };
  P.targetLabel = function (g) {
    var v = g || profile.targetGrade || 'merit';
    if (v === 'distinction') return 'Distinction 卓越 (160+)';
    if (v === 'pass') return 'Pass 稳过 (140+)';
    return 'Merit 优秀 (153+)';
  };

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
  // 背单词判分时调用：设成确定状态，不来回翻转，且状态没变就不广播事件
  P.setKnown = function (w, on) {
    var k = String(w).toLowerCase();
    var had = !!known[k];
    if (on === had) return had;
    if (on) known[k] = 1; else delete known[k];
    store(KNOWN_KEY, known);
    document.dispatchEvent(new CustomEvent('pet:known', { detail: { word: w, on: on } }));
    return on;
  };
  P.knownCount = function () { return Object.keys(known).length; };
  P.clearKnown = function () { known = {}; store(KNOWN_KEY, known); document.dispatchEvent(new CustomEvent('pet:known', { detail: { reset: true } })); };

  /* ---------------- 间隔重复（SM-2 简化版） ---------------- */
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

  /* ---------------- 每日学习量 + 连续天数 + 7日趋势 ---------------- */
  var DAYLOG_KEY = 'pet-daylog-v1';
  var daylog = load(DAYLOG_KEY, {}) || {};
  var GOAL_KEY = 'pet-goal-v1';
  var goal = load(GOAL_KEY, 20) || 20;

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
  P.streak = function () {
    var n = 0, d = new Date();
    for (var i = 0; i < 3660; i++) {
      var rec = daylog[dayKey(d)];
      var active = rec && ((rec.words || 0) + (rec.questions || 0) > 0);
      if (!active && i === 0) { d.setDate(d.getDate() - 1); continue; }
      if (!active) break;
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  };
  P.last7Days = function () {
    var out = [];
    var d = new Date();
    for (var i = 6; i >= 0; i--) {
      var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
      var k = dayKey(x);
      var rec = daylog[k] || {};
      var words = rec.words || 0;
      var questions = rec.questions || 0;
      out.push({
        key: k,
        label: (x.getMonth() + 1) + '/' + x.getDate(),
        words: words,
        questions: questions,
        total: words + questions
      });
    }
    return out;
  };
  P.resetDaily = function () { daylog = {}; store(DAYLOG_KEY, daylog); };

  /* ---------------- 8周计划打卡 ---------------- */
  var PLAN_KEY = 'pet-plan-v1';
  var planDoneMap = load(PLAN_KEY, {}) || {};
  P.planDone = function (w) { return !!planDoneMap[String(w)]; };
  P.togglePlanWeek = function (w) {
    var k = String(w);
    if (planDoneMap[k]) delete planDoneMap[k]; else planDoneMap[k] = Date.now();
    store(PLAN_KEY, planDoneMap);
    document.dispatchEvent(new CustomEvent('pet:plan', { detail: { week: w, done: !!planDoneMap[k] } }));
    return !!planDoneMap[k];
  };
  P.planCompletedCount = function () { return Object.keys(planDoneMap).length; };

  /* ---------------- 单词错题本 ---------------- */
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
  P.wordAttempt = function (w, ok) {
    var k = String(w).toLowerCase();
    if (!ok) {
      var r = wbook[k] || { wrong: 0, right: 0, at: 0 };
      r.wrong = (r.wrong || 0) + 1;
      r.right = 0;
      r.at = Date.now();
      r.last = r.at;
      wbook[k] = r;
      store(WBOOK_KEY, wbook);
      document.dispatchEvent(new CustomEvent('pet:wordbook', { detail: { word: w, ok: false } }));
      return false;
    }
    var e = wbook[k];
    if (!e) return false;
    e.right = (e.right || 0) + 1;
    e.last = Date.now();
    var mastered = e.right >= MASTER_STREAK;
    if (mastered) delete wbook[k];
    store(WBOOK_KEY, wbook);
    document.dispatchEvent(new CustomEvent('pet:wordbook', { detail: { word: w, ok: true, mastered: mastered } }));
    return mastered;
  };
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
    P.wordAttempt(w, grade >= 2);
    var k = String(w).toLowerCase();
    var r = srs[k] || { ease: 2.5, ivl: 0, due: 0, reps: 0, lapses: 0 };
    if (grade === 0) {
      r.ease = Math.max(1.3, r.ease - 0.2);
      r.ivl = 0;
      r.lapses = (r.lapses || 0) + 1;
      r.due = Date.now() + 10 * 60000;
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
    // 准确率计数：ans 累计作答，okc 累计答对；「有点模糊」(g=1) 是模糊自评，不计入分子分母
    if (grade !== 1) {
      r.ans = (r.ans || 0) + 1;
      if (grade >= 2) r.okc = (r.okc || 0) + 1;
    }
    srs[k] = r;
    store(SRS_KEY, srs);
    P.bumpDay('words', 1);
    document.dispatchEvent(new CustomEvent('pet:srs', { detail: { word: w } }));
    return r;
  };
  // 按给定词表统计背词准确率；不传则统计全部学过的词
  P.wordAccStats = function (list) {
    var ans = 0, okc = 0;
    var keys = list ? list.map(function (w) { return String(w.w || w).toLowerCase(); }) : Object.keys(srs);
    keys.forEach(function (k) {
      var r = srs[k];
      if (!r) return;
      ans += r.ans || 0;
      okc += r.okc || 0;
    });
    return { answered: ans, correct: okc, rate: ans ? okc / ans : null };
  };
  P.srsReset = function () { srs = {}; store(SRS_KEY, srs); document.dispatchEvent(new CustomEvent('pet:srs', { detail: { reset: true } })); };

  /* ---------------- 答题记录 ---------------- */
  var QLOG_KEY = 'pet-qlog-v2';
  var qlog = load(QLOG_KEY, null);
  if (!qlog || typeof qlog !== 'object' || !qlog.topicStats) {
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

  /* ---------------- 学习等级与 XP 激励 ---------------- */
  P.levelInfo = function () {
    var srsSt = P.srsStats();
    var qSt = P.qTopicStats();
    var qTotal = qSt.reduce(function (a, x) { return a + x.n; }, 0);
    var xp = srsSt.total * 5 + P.knownCount() * 2 + qTotal * 8 + P.streak() * 20;
    var tiers = [
      { lv: 1, name: '剑桥萌新', min: 0 },
      { lv: 2, name: '词海探索者', min: 150 },
      { lv: 3, name: '语法小达人', min: 500 },
      { lv: 4, name: 'PET 冲刺手', min: 1200 },
      { lv: 5, name: '卓越挑战者', min: 2800 },
      { lv: 6, name: '剑桥 B1 大师', min: 5500 }
    ];
    var cur = tiers[0];
    for (var i = 0; i < tiers.length; i++) {
      if (xp >= tiers[i].min) cur = tiers[i];
    }
    return { lv: cur.lv, name: cur.name, xp: xp };
  };

  /* ---------------- 学习档案备份 ---------------- */
  P.exportBackup = function () {
    var data = {
      version: 2,
      exportedAt: new Date().toISOString(),
      known: known,
      srs: srs,
      daylog: daylog,
      goal: goal,
      wbook: wbook,
      qlog: qlog,
      profile: profile,
      plan: planDoneMap
    };
    return JSON.stringify(data, null, 2);
  };

  P.importBackup = function (raw) {
    var d = JSON.parse(raw);
    if (!d || typeof d !== 'object') throw new Error('无效的备份文件');
    if (d.known) { known = d.known; store(KNOWN_KEY, known); }
    if (d.srs) { srs = d.srs; store(SRS_KEY, srs); }
    if (d.daylog) { daylog = d.daylog; store(DAYLOG_KEY, daylog); }
    if (d.goal) { goal = d.goal; store(GOAL_KEY, goal); }
    if (d.wbook) { wbook = d.wbook; store(WBOOK_KEY, wbook); }
    if (d.qlog) { qlog = d.qlog; store(QLOG_KEY, qlog); }
    if (d.profile) { profile = Object.assign(profile, d.profile); store(PROFILE_KEY, profile); }
    if (d.plan) { planDoneMap = d.plan; store(PLAN_KEY, planDoneMap); }
    P.toast('学习档案已恢复，正在刷新页面…');
    setTimeout(function () { location.reload(); }, 600);
  };

  /* ---------------- 全局弹窗（考试倒计时设置） ---------------- */
  function ensureModals() {
    if (document.getElementById('petExamModal')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="modal-backdrop" id="petExamModal" role="dialog" aria-modal="true" aria-labelledby="examModalTitle">' +
        '<div class="modal-box">' +
          '<button class="modal-close" data-close="petExamModal" aria-label="关闭">✕</button>' +
          '<span class="kicker">个性化备考档案</span>' +
          '<h3 id="examModalTitle">设置考试倒计时与目标档位</h3>' +
          '<p class="modal-sub">设定目标后，首页驾驶舱与 8 周计划将自动匹配冲刺节奏。</p>' +
          '<div class="form-row"><label for="exChildName">昵称（选填）</label><input class="field" id="exChildName" type="text" placeholder="例如：乐乐 / Alex" maxlength="20"></div>' +
          '<div class="form-row"><label for="exDate">预计 PET 考试日期</label><input class="field" id="exDate" type="date"></div>' +
          '<div class="form-row"><label for="exGrade">目标成绩档位</label>' +
            '<select class="field" id="exGrade">' +
              '<option value="pass">Pass 稳过线（140–152 分 · 拿下核心高频）</option>' +
              '<option value="merit">Merit 优秀（153–159 分 · 推荐多数中小学生）</option>' +
              '<option value="distinction">Distinction 卓越（160–170 分 · 冲刺 B2 水平）</option>' +
            '</select>' +
          '</div>' +
          '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">' +
            '<button class="btn ghost sm" data-close="petExamModal">取消</button>' +
            '<button class="btn primary sm" id="exSaveBtn">保存设置</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);

    wrap.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () {
        var m = document.getElementById(b.getAttribute('data-close'));
        if (m) m.classList.remove('open');
      });
    });
    wrap.querySelectorAll('.modal-backdrop').forEach(function (bd) {
      bd.addEventListener('click', function (e) {
        if (e.target === bd) bd.classList.remove('open');
      });
    });

    document.getElementById('exSaveBtn').addEventListener('click', function () {
      var name = (document.getElementById('exChildName').value || '').trim();
      var date = document.getElementById('exDate').value || '';
      var grade = document.getElementById('exGrade').value || 'merit';
      P.saveProfile({ childName: name, examDate: date, targetGrade: grade });
      P.toast('✓ 备考档案已更新');
      document.getElementById('petExamModal').classList.remove('open');
    });
  }

  P.openExamModal = function () {
    ensureModals();
    document.getElementById('exChildName').value = profile.childName || '';
    document.getElementById('exDate').value = profile.examDate || '';
    document.getElementById('exGrade').value = profile.targetGrade || 'merit';
    document.getElementById('petExamModal').classList.add('open');
  };

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
    applyTheme(resolveTheme(), false);

    function syncAutoTheme() {
      if (!load(THEME_KEY, null)) {
        var autoT = autoThemeByTime();
        if (P.theme() !== autoT) applyTheme(autoT, false);
      }
    }
    setInterval(syncAutoTheme, 60000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) syncAutoTheme();
    });

    document.querySelectorAll('[data-open-exam]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        P.openExamModal();
      });
    });

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
        if (reduceMotion) { el.textContent = target.toLocaleString('en-US'); return; }
        var t0 = performance.now(), dur = 850;
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
        }, { threshold: .3 });
        counters.forEach(function (c) { io.observe(c); });
        setTimeout(function () { counters.forEach(runCount); }, 1500);
      } else counters.forEach(runCount);
    }

    /* 滚动揭示 */
    if (!reduceMotion && 'IntersectionObserver' in window) {
      var revealNodes = document.querySelectorAll('.reveal');
      var io2 = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.remove('out'); io2.unobserve(e.target); }
        });
      }, { threshold: .06, rootMargin: '0px 0px -30px 0px' });
      revealNodes.forEach(function (n) {
        var r = n.getBoundingClientRect();
        if (r.top > window.innerHeight) { n.classList.add('out'); io2.observe(n); }
      });
    }
  });

  /* ==========================================================
     发音播放（预合成英音 MP3，自动适配子目录 data-base）
     ========================================================== */
  function audioMapGet() {
    return (window.PET_DATA && window.PET_DATA.PET_AUDIO) || window.PET_AUDIO || {};
  }
  var currentAudio = null;
  var playTimer = null;
  var playToken = 0;

  P.hasAudio = function (w) { return !!audioMapGet()[w]; };
  P.audioSrc = function (w) {
    var rel = audioMapGet()[w];
    if (!rel) return '';
    var base = (document.body && document.body.getAttribute('data-base')) || '';
    return base + rel;
  };
  P.playWord = function (w, opts) {
    var src = P.audioSrc(w);
    if (!src) return false;
    var o = opts || {};
    var times = o.times || 3;
    var gap = o.gap == null ? 260 : o.gap;
    try {
      var token = ++playToken;
      if (playTimer) { clearTimeout(playTimer); playTimer = null; }
      var a = currentAudio || (currentAudio = new Audio());
      a.onended = null;
      try { a.pause(); } catch (e) {}
      a.src = src;
      a.volume = o.volume == null ? 1 : o.volume;
      var played = 0;
      a.onended = function () {
        if (token !== playToken) return;
        played++;
        if (played < times) {
          playTimer = setTimeout(function () {
            if (token !== playToken) return;
            try { a.currentTime = 0; a.play().catch(function () {}); } catch (e) {}
          }, gap);
        } else if (o.onend) {
          o.onend();
        }
      };
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
      return true;
    } catch (e) {
      return false;
    }
  };
  P.stopAudio = function () {
    playToken++;
    if (playTimer) { clearTimeout(playTimer); playTimer = null; }
    if (currentAudio) {
      try { currentAudio.onended = null; currentAudio.pause(); } catch (e) {}
    }
  };

  /* ==========================================================
     单词列表渲染（词表页 / 话题页共用，支持一键英音朗读与掌握标记）
     ========================================================== */
  P.renderWordList = function (opts) {
    var host = document.querySelector(opts.mount);
    if (!host) return;
    var all = (opts.words || []).slice().sort(function (a, b) {
      var fa = a.frq || 999999, fb = b.frq || 999999;
      if (fa !== fb) return fa - fb;
      return a.w.toLowerCase() < b.w.toLowerCase() ? -1 : 1;
    });
    var pageSize = opts.pageSize || 40;
    var page = 0;
    var query = '';
    var filter = opts.initialFilter || 'all';

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
      var tagTxt = w.tag === 'b1' ? '核心高频' : w.tag === 'b2' ? '中频主力' : '拓展词';
      var isK = P.isKnown(w.w);
      var canPlay = P.hasAudio(w.w);
      var h = '<div class="wrow' + (isK ? ' known' : '') + '" data-w="' + esc(w.w) + '">';
      var al = (w.al && w.al.length) ? '<span class="ph">= ' + esc(w.al[0]) + '</span>' : '';
      h += '<span class="w-cell">' +
        (canPlay ? '<button class="w-say" data-say="' + esc(w.w) + '" title="听英音朗读" aria-label="朗读 ' + esc(w.w) + '">🔊</button>' : '') +
        '<span class="w">' + P.hl(w.w, query) + al + (w.ph ? '<span class="ph">/' + esc(w.ph) + '/</span>' : '') + '</span>' +
        '</span>';
      h += '<span class="pos">' + esc(w.posZh || '') + '</span>';
      h += '<span class="zh">' + P.hl(w.zh, query) + '</span>';
      h += '<span class="w-right">' +
        '<span class="flag ' + tagCls + '">' + tagTxt + '</span>' +
        '<button class="known-pill" data-kbtn="' + esc(w.w) + '">' + (isK ? '✓ 已掌握' : '标掌握') + '</button>' +
        '</span>';
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
        html = '<div class="empty"><b>没有找到匹配的词条</b>换个中英文关键词或筛选条件试试</div>';
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
        ' · 第 ' + (page + 1) + ' / ' + total + ' 页 · 点击 🔊 听纯正剑桥英音，点右侧按钮标记掌握</div>';
      host.innerHTML = html + pager + count;

      host.querySelectorAll('[data-say]').forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          P.playWord(b.getAttribute('data-say'), { times: 1 });
        });
      });
      host.querySelectorAll('[data-kbtn], .wrow .w').forEach(function (el) {
        el.addEventListener('click', function () {
          var row = el.closest('.wrow');
          var w = row.getAttribute('data-w');
          var on = P.toggleKnown(w);
          row.classList.toggle('known', on);
          var btn = row.querySelector('.known-pill');
          if (btn) btn.textContent = on ? '✓ 已掌握' : '标掌握';
          // 在「未掌握 / 已掌握」视图里，标记后该行已不属于当前筛选，稍后重绘把它移出
          if (filter === 'new' || filter === 'known') {
            row.style.transition = 'opacity .25s';
            row.style.opacity = '.35';
            setTimeout(draw, 320);
          }
        });
      });
      host.querySelectorAll('[data-pg]').forEach(function (b) {
        b.addEventListener('click', function () {
          var p = parseInt(b.getAttribute('data-pg'), 10);
          if (!isNaN(p)) { page = p; draw(); window.scrollTo({ top: 180, behavior: 'smooth' }); }
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
      c.classList.toggle('on', c.getAttribute('data-filter') === filter);
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
     测验引擎（练语法）
     ========================================================== */
  P.quiz = function (opts) {
    var host = document.querySelector(opts.mount);
    if (!host) return;
    var pool = (opts.questions || []).slice();
    if (opts.shuffle !== false) pool = shuffle(pool);
    if (opts.limit) pool = pool.slice(0, opts.limit);
    var i = 0, correct = 0, streak = 0, best = 0, answered = false;
    var total = pool.length;
    var autoNextTimer = null;              // 答对后自动翻页
    var AUTO_NEXT_MS = 780;

    host.innerHTML =
      '<div class="quiz-shell">' +
        '<div class="quiz-top">' +
          '<div class="quiz-progress"><i id="qp"></i></div>' +
          '<span class="quiz-count" id="qc">1 / ' + total + '</span>' +
          '<span class="combo-pill" id="qs">🔥 连击 0</span>' +
        '</div>' +
        '<div id="qbody"></div>' +
      '</div>';

    var body = host.querySelector('#qbody');

    function draw() {
      clearTimeout(autoNextTimer);
      autoNextTimer = null;
      answered = false;
      var q = pool[i];
      if (!q) return done();
      var typeName = q.type === 'correct' ? '写作改错 · 挑出正确句' : q.type === 'fill' ? 'PET Part 6 · 开放填空' : 'PET Part 5 · 单项选择';
      var stem = esc(q.stem).replace(/___/g, '<span class="blank">　</span>');
      var h = '<div class="qcard">';
      h += '<div class="qmeta"><span class="qtype">' + typeName + '</span>' +
           (q.level ? '<span class="lv ' + esc(q.level) + '">' + esc(q.level) + '</span>' : '') + '</div>';
      h += '<div class="qstem">' + stem + '</div>';

      if (q.type === 'fill') {
        h += '<div class="qfill"><input id="qin" type="text" autocomplete="off" spellcheck="false" placeholder="输入英文答案后按 Enter 提交…">' +
             '<button class="btn primary" id="qsub">提交检查</button></div>';
      } else {
        h += '<div class="qopts">';
        q.options.forEach(function (o, k) {
          h += '<button class="qopt" data-k="' + k + '"><span class="key">' + 'ABCD'[k] + '</span><span>' + esc(o) + '</span></button>';
        });
        h += '</div>';
      }
      h += '<div id="qfb"></div>';
      h += '<div class="quiz-actions"><span class="spacer"></span><button class="btn primary" id="qnext" disabled>下一题 →</button></div>';
      h += '</div>';
      body.innerHTML = h;

      host.querySelector('#qp').style.width = ((i) / total * 100) + '%';
      host.querySelector('#qc').textContent = (i + 1) + ' / ' + total;
      host.querySelector('#qs').textContent = '🔥 连击 ' + streak;

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
          // 答对后已经安排了自动翻页，此时 Enter 不应再触发一次，避免连跳两题
          if (autoNextTimer) { e.preventDefault(); return; }
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
      if (ok) { correct++; streak++; if (streak > best) best = streak; P.sfx('ok'); }
      else { streak = 0; P.sfx('bad'); }
      host.querySelector('#qs').textContent = '🔥 连击 ' + streak;
      var fb = host.querySelector('#qfb');
      var ref = refAnswer
        ? '<div style="margin-bottom:6px"><b style="display:inline">参考答案：</b><span style="color:var(--ok);font-family:var(--en);font-weight:700;font-size:1rem">' + esc(refAnswer) + '</span></div>'
        : '';
      if (ok) {
        // 答对：给一句确认，然后自动进下一题，不打断节奏
        fb.innerHTML = '<div class="feedback auto-next"><b>✓ 回答正确！' +
          (streak >= 3 ? ' 已连击 ' + streak + ' 题！' : '') +
          '</b><span class="auto-next-hint">即将进入下一题…</span></div>';
      } else {
        // 答错：停住，让用户看完正确答案与解析
        fb.innerHTML = '<div class="feedback bad"><b>✕ 这题进了错题本，看看解析：</b>' +
          ref + esc(q.why) + '</div>';
        var nx = host.querySelector('#qnext');
        nx.disabled = false;
        nx.focus();
      }
      if (P.qRecord) P.qRecord(q.topic, ok, q.id);
      if (opts.onAnswer) opts.onAnswer(q, ok);
      if (ok) {
        clearTimeout(autoNextTimer);
        autoNextTimer = setTimeout(function () {
          if (!document.body.contains(host)) return;
          i++;
          draw();
        }, AUTO_NEXT_MS);
      }
    }

    function done() {
      clearTimeout(autoNextTimer);
      autoNextTimer = null;
      P.sfx('win');
      var rate = total ? Math.round(correct / total * 100) : 0;
      var badge = rate >= 90 ? '🏆 卓越表现！' : rate >= 75 ? '🌟 稳步提升！' : '💪 发现薄弱点就是进步！';
      host.querySelector('#qp').style.width = '100%';
      body.innerHTML = '<div class="qcard" style="text-align:center;justify-content:center">' +
        '<div class="kicker">本轮精练完成</div>' +
        '<div style="font-size:1.15rem;font-weight:700;margin-bottom:6px">' + badge + '</div>' +
        '<div style="font-family:var(--display);font-size:3.2rem;font-weight:800;color:var(--accent);margin:6px 0">' + rate + '<span style="font-size:1.3rem">%</span></div>' +
        '<div style="color:var(--text-2)">答对 <b>' + correct + ' / ' + total + '</b> 题 · 最高连击 <b>' + best + '</b> · 获得 <b>+' + (total * 8) + ' XP</b></div>' +
        '<div style="margin-top:26px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
          '<button class="btn primary" id="qagain">再来一轮</button>' +
          '<a class="btn soft" href="wrong.html">去清错题本</a>' +
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
     背单词（SRS 驱动：四选一 + 闪卡回忆双模式）
     ========================================================== */
  P.wordStudy = function (opts) {
    var host = document.querySelector(opts.mount);
    if (!host) return;
    var pool = (opts.words || []).filter(function (w) { return w.w; });
    if (!pool.length) { host.innerHTML = '<div class="empty"><b>没有可学的词</b></div>'; return; }
    var mode = opts.mode || 'due';
    var card = opts.card || 'choice';
    var autoSayOn = opts.autoSay !== false;
    var queue = [], idx = 0, revealed = false;
    var sessionN = 0, sessionOk = 0, streak = 0, best = 0;
    var answered = false, finished = false;
    var autoNextTimer = null;
    var pendingAdvance = false;
    var AUTO_NEXT_MS = 780;

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

      var limit = opts.limit || 20;
      var dueList = scored.filter(function (s) { return s.has && (s.due || 0) <= now; })
        .sort(function (a, b) { return (a.due || 0) - (b.due || 0); });
      var newList = scored.filter(function (s) { return !s.has; });
      var picked = [];

      if (mode === 'due') {
        picked = dueList.slice(0, limit);
      } else if (mode === 'new') {
        picked = sampleByFrequency(newList, limit);
      } else {
        picked = dueList.slice(0, limit);
        if (picked.length < limit) {
          var room = limit - picked.length;
          var takenKeys = {};
          picked.forEach(function (s) { takenKeys[s.w.w] = 1; });
          var extra = sampleByFrequency(newList.filter(function (s) { return !takenKeys[s.w.w]; }), room);
          picked = picked.concat(extra);
        }
      }

      queue = picked.map(function (s) { return s.w; });
      shuffle(queue);
      idx = 0; sessionN = 0; sessionOk = 0; streak = 0; best = 0; finished = false;
      draw();
    }

    function sampleByFrequency(list, n) {
      if (n <= 0 || !list.length) return [];
      var sorted = list.slice().sort(function (a, b) {
        var fa = a.w.frq == null ? 1e9 : a.w.frq;
        var fb = b.w.frq == null ? 1e9 : b.w.frq;
        return fa - fb;
      });
      var win = Math.max(n * 4, 80);
      var sub = sorted.slice(0, win);
      shuffle(sub);
      return sub.slice(0, n);
    }

    function header() {
      return '<div class="quiz-top">' +
        '<div class="quiz-progress"><i style="width:' + (queue.length ? idx / queue.length * 100 : 0) + '%"></i></div>' +
        '<span class="quiz-count">' + Math.min(idx + 1, queue.length) + ' / ' + queue.length + '</span>' +
        '<span class="combo-pill" id="qs">🔥 连击 ' + streak + '</span></div>';
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
        '<div style="font-size:1.35rem;font-weight:700;margin-bottom:10px">🎉 今天到期的词全部复习完啦！</div>' +
        '<div style="color:var(--text-2);font-size:.93rem;line-height:1.7">按艾宾浩斯遗忘曲线，今天已经达标。<br>如果想继续抢跑，可以切到「混合模式」学习一批新词。</div>' +
        '<div style="margin-top:24px"><button class="btn primary" id="wsMix">切到混合模式学新词</button></div></div>';
      var b = host.querySelector('#wsMix');
      if (b) b.addEventListener('click', function () { mode = 'mix'; build(); });
    }

    function recallView(w) {
      var canPlay = P.hasAudio(w.w);
      var h = '<div class="flash-shell">' + header();
      h += '<div class="fcard">';
      h += '<div class="fword">' + esc(w.w) +
           (canPlay ? '<button class="say-btn" id="sayBtn" title="朗读 3 遍" aria-label="朗读单词三遍">🔊</button>' : '') +
           '</div>';
      if (w.ph) h += '<div class="fph">/' + esc(w.ph) + '/</div>';
      if (w.posZh) h += '<div class="fpos">' + esc(w.posZh) + (w.t === 'phrase' ? ' · 短语' : '') + '</div>';
      h += '<div id="frev"></div>';
      h += '<div class="fhint">先在脑海里回想中文含义，再点击「查看释义」或按空格</div>';
      h += '</div>';
      h += '<div class="quiz-actions"><span class="spacer"></span><button class="btn primary" id="fshow">查看释义 (空格)</button></div>';
      h += '</div>';
      setTimeout(function () {
        var say = host.querySelector('#sayBtn');
        if (say) say.addEventListener('click', function (e) { e.stopPropagation(); P.playWord(w.w); });
        if (canPlay && autoSayOn) P.playWord(w.w);
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
        '<button class="rate again" data-g="0"><b>忘了</b><small>10 分钟后再来</small></button>' +
        '<button class="rate hard" data-g="1"><b>有点模糊</b><small>约 1 天后</small></button>' +
        '<button class="rate good" data-g="2"><b>记住了</b><small>按遗忘曲线</small></button>' +
        '<button class="rate easy" data-g="3"><b>秒杀很熟</b><small>拉长间隔</small></button></div>';
      act.querySelectorAll('[data-g]').forEach(function (b) {
        b.addEventListener('click', function () { rate(parseInt(b.getAttribute('data-g'), 10)); });
      });
    }

    function choiceView(w) {
      var ds = pickDistractors(pool, w, 3);
      if (ds.length < 3) return recallView(w);
      var choices = [w].concat(ds);
      shuffle(choices);
      var ans = choices.indexOf(w);
      var h = '<div class="flash-shell">' + header();
      var canPlay = P.hasAudio(w.w);
      h += '<div class="fcard" style="justify-content:flex-start;padding-top:32px;min-height:0">';
      h += '<div class="fword" style="font-size:clamp(1.6rem,5vw,2.2rem)">' + esc(w.w) +
           (canPlay ? '<button class="say-btn" id="sayBtn" title="朗读 3 遍" aria-label="朗读单词三遍">🔊</button>' : '') +
           '</div>';
      if (w.ph) h += '<div class="fph">/' + esc(w.ph) + '/</div>';
      if (w.posZh) h += '<div class="fpos">' + esc(w.posZh) + '</div>';
      h += '<div style="font-size:.84rem;color:var(--text-3);margin-top:14px">' +
           (canPlay ? '听纯正英音，选出最准确的中文释义' : '选出最准确的中文释义') + '</div></div>';
      h += '<div class="qopts" style="margin-top:16px">';
      choices.forEach(function (o, k) {
        h += '<button class="qopt" data-k="' + k + '"' + (k === ans ? ' data-ans="1"' : '') + '>' +
             '<span class="key">' + 'ABCD'[k] + '</span><span>' + esc(o.zh || '') + '</span></button>';
      });
      h += '</div><div id="wfb"></div></div>';
      setTimeout(function () {
        var say = host.querySelector('#sayBtn');
        if (say) say.addEventListener('click', function (e) { e.stopPropagation(); P.playWord(w.w); });
        if (canPlay && autoSayOn) P.playWord(w.w);
        host.querySelectorAll('.qopt').forEach(function (b) {
          b.addEventListener('click', function () {
            judgeChoice(w, parseInt(b.getAttribute('data-k'), 10), ans);
          });
        });
      }, 0);
      return h;
    }

    function judgeChoice(w, k, ans) {
      if (answered) return;
      answered = true;
      var ok = k === ans;
      host.querySelectorAll('.qopt').forEach(function (b) {
        var bi = parseInt(b.getAttribute('data-k'), 10);
        b.classList.add('locked');
        if (bi === ans) b.classList.add('right');
        else if (bi === k) b.classList.add('wrong');
      });
      if (ok) { streak++; if (streak > best) best = streak; P.sfx('ok'); }
      else { streak = 0; P.sfx('bad'); }
      var fb = host.querySelector('#wfb');
      if (ok) {
        fb.innerHTML = '<div class="feedback auto-next"><b>✓ 答对了！' +
          (streak >= 3 ? ' 🔥 连击 ' + streak : '') + '</b>' +
          esc(w.zh) + (w.posZh ? ' · ' + esc(w.posZh) : '') +
          '<span class="auto-next-hint">自动进入下一词…</span></div>';
      } else {
        fb.innerHTML = '<div class="feedback bad"><b>✕ 正确释义：' + esc(w.zh) + '</b>' +
          esc(w.w) + (w.ph ? ' /' + esc(w.ph) + '/' : '') + (w.posZh ? ' · ' + esc(w.posZh) : '') +
          (w.ex && w.ex[0] ? '<div style="margin-top:6px;font-style:italic;font-size:.85rem">' + esc(w.ex[0]) + '</div>' : '') +
          '</div>' +
          '<div class="quiz-actions"><span class="spacer"></span><button class="btn primary" id="wnext">记住了，下一词 →</button></div>';
        var nx = fb.querySelector('#wnext');
        nx.addEventListener('click', function () { idx++; draw(); });
        nx.focus();
      }
      recordAndRate(w, ok ? 2 : 0, ok);
      if (ok) {
        pendingAdvance = true;
        clearTimeout(autoNextTimer);
        autoNextTimer = setTimeout(advance, AUTO_NEXT_MS);
      }
    }

    function recordAndRate(w, g, countedOk) {
      P.srsRate(w.w, g);
      // 背单词的结果同步到词库「已掌握」：四选一按对错，闪卡按自评
      // 闪卡的「有点模糊」(g=1) 不算掌握也不算答错，保持原状态
      if (countedOk) P.setKnown(w.w, true);
      else if (g === 0) P.setKnown(w.w, false);
      sessionN++;
      if (countedOk) sessionOk++;
      if (opts.onRate) opts.onRate(w, g);
      var st = host.querySelector('#qs');
      if (st) st.textContent = '🔥 连击 ' + streak;
    }

    function rate(g) {
      var w = queue[idx];
      if (g >= 2) { streak++; if (streak > best) best = streak; P.sfx('ok'); }
      else { streak = 0; P.sfx('bad'); }
      recordAndRate(w, g, g >= 2);
      if (g === 0) queue.push(w);
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
      P.sfx('win');
      var st = P.srsStats();
      var pct = sessionN ? Math.round(sessionOk / sessionN * 100) : 100;
      host.innerHTML = '<div class="qcard" style="text-align:center;justify-content:center">' +
        '<div class="kicker">本轮闯关完成</div>' +
        '<div style="font-size:1.2rem;font-weight:700;margin-bottom:4px">' + (pct >= 85 ? '🎉 太棒了，词感超稳！' : '💪 坚持复习，越背越牢！') + '</div>' +
        '<div style="font-family:var(--display);font-size:2.9rem;font-weight:800;color:var(--accent);margin:8px 0">' + sessionOk +
          '<span style="font-size:1.3rem;color:var(--text-3)"> / ' + sessionN + '</span></div>' +
        '<div style="color:var(--text-2)">个词已记住 · 最高连击 <b>' + best + '</b> · 获得 <b>+' + (sessionN * 5) + ' XP</b><br>' +
          '词库累计已学 ' + st.total + ' 词，今日还剩 ' + st.due + ' 个待复习</div>' +
        '<div style="margin-top:26px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
          '<button class="btn primary" id="wagain">再来一轮</button>' +
          '<a class="btn soft" href="review.html">顺手练一组语法</a>' +
          '<a class="btn ghost" href="' + (opts.backHref || 'index.html') + '">返回</a>' +
        '</div></div>';
      host.querySelector('#wagain').addEventListener('click', build);
      if (opts.onFinish) opts.onFinish({ ok: sessionOk, total: sessionN, best: best });
    }

    build();
    return { rebuild: build };
  };

  P.flashcards = function (opts) {
    return P.wordStudy(Object.assign({}, opts, { card: opts.card || 'recall' }));
  };
})();
