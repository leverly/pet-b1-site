/* ==========================================================
   PET 备考小站 · 静态站点生成器
   用法：node build-site.mjs
   输出：根目录 index.html + topics/ grammar/ 等
   ========================================================== */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WORDS, TOPICS, STATS } from './src/data-words.js';
import { GRAMMAR, GRAMMAR_STATS } from './src/data-grammar.js';
import { QUESTIONS } from './src/data-quiz.js';
import { QUESTIONS_2 } from './src/data-quiz2.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = __dir;

const ALL_Q = [...QUESTIONS, ...QUESTIONS_2];

/* ---------------- 派生数据 ---------------- */
const TOPIC_MAP = new Map(TOPICS.map((t) => [t.id, t]));
const WORD_BY_TOPIC = new Map();
TOPICS.forEach((t) => WORD_BY_TOPIC.set(t.id, []));
WORDS.forEach((w) => (w.tp || []).forEach((id) => {
  if (WORD_BY_TOPIC.has(id)) WORD_BY_TOPIC.get(id).push(w);
}));
const TOPIC_SORTED = TOPICS
  .map((t) => ({ ...t, n: (WORD_BY_TOPIC.get(t.id) || []).length }))
  .filter((t) => t.n > 0)
  .sort((a, b) => b.n - a.n);

const Q_BY_TOPIC = new Map();
ALL_Q.forEach((q) => {
  if (!Q_BY_TOPIC.has(q.topic)) Q_BY_TOPIC.set(q.topic, []);
  Q_BY_TOPIC.get(q.topic).push(q);
});
const GT_IDS = new Set(GRAMMAR.flatMap((g) => g.topics.map((t) => t.id)));
// 考点 -> 所属语法族（详情页与易错点页的返回链接都要用）
const TOPIC_GID = new Map();
GRAMMAR.forEach((g) => g.topics.forEach((t) => TOPIC_GID.set(t.id, g.id)));
const GNAME = new Map(GRAMMAR.map((g) => [g.id, g.name]));
const Q_TOPIC_MISS = [...GT_IDS].filter((id) => !Q_BY_TOPIC.has(id));

const TYPE_OF_Q = (q) => q.type || 'choice';
const Q_STATS = {
  total: ALL_Q.length,
  choice: ALL_Q.filter((q) => TYPE_OF_Q(q) === 'choice').length,
  correct: ALL_Q.filter((q) => TYPE_OF_Q(q) === 'correct').length,
  fill: ALL_Q.filter((q) => TYPE_OF_Q(q) === 'fill').length,
};


/* ---------------- 数据内联 ----------------
   file:// 下 ES module 会被 CORS 拦住，所以把数据模块
   转成 window.PET_DATA 上的普通脚本，保证双击就能用。
   ---------------------------------------- */
const DATA_KEYS = [
  ['WORDS', 'src/data-words.js'],
  ['TOPICS', 'src/data-words.js'],
  ['STATS', 'src/data-words.js'],
  ['GRAMMAR', 'src/data-grammar.js'],
  ['GRAMMAR_STATS', 'src/data-grammar.js'],
  ['QUESTIONS', 'src/data-quiz.js'],
  ['QUESTIONS_2', 'src/data-quiz2.js'],
];

/* 每个页面只内联自己用得到的数据，避免整站塞进 460KB 词表 */
const __inlineCache = new Map();

function inlineData(keys, extra) {
  const ALL = {
    WORDS: WORDS,
    TOPICS: TOPICS,
    STATS: STATS,
    GRAMMAR: GRAMMAR,
    GRAMMAR_STATS: GRAMMAR_STATS,
    QUESTIONS: QUESTIONS,
    QUESTIONS_2: QUESTIONS_2,
  };
  // 缓存键必须包含 extra 的内容摘要，否则不同话题页会复用第一个话题的数据
  const extraSig = extra ? '|' + JSON.stringify(extra).length + ':' + JSON.stringify(extra).slice(0, 64) : '';
  const id = keys.join(',') + extraSig;
  if (__inlineCache.has(id)) return __inlineCache.get(id);
  const body = keys.map((k) => {
    if (!(k in ALL)) throw new Error('inlineData: unknown key ' + k);
    return `window.PET_DATA.${k}=${JSON.stringify(ALL[k])};`;
  }).concat(Object.keys(extra || {}).map((k) => {
    return `window.PET_DATA.${k}=${JSON.stringify(extra[k])};`;
  })).join('\n');
  const out = `<script>window.PET_DATA=window.PET_DATA||{};\n${body}</scr` + `ipt>`;
  __inlineCache.set(id, out);
  return out;
}

/* ---------------- 工具 ---------------- */
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* 允许考点文本里用 **加粗** 与 `代码`，其余全部转义 */
function rich(s) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function write(rel, content) {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}

/* ---------------- 导航 ---------------- */
const NAV = [
  { href: 'index.html', label: '首页', key: 'home' },
  { href: 'words.html', label: '词汇', key: 'words' },
  { href: 'grammar.html', label: '语法', key: 'grammar' },
  { href: 'quiz.html', label: '背单词', key: 'words-study' },
  { href: 'review.html', label: '语法练习', key: 'grammar-drill' },
  { href: 'traps.html', label: '易错点', key: 'traps' },
  { href: 'plan.html', label: '计划', key: 'plan' },
  { href: 'stats.html', label: '数据', key: 'stats' },
];

const LOGO_HTML = (base) => `<a class="logo" href="${base}index.html">PET <em>备考小站</em></a>`;

const HEADER = (base, active) => `<div class="scroll-progress"></div>
<header class="hdr">
  <div class="hdr-in">
    ${LOGO_HTML(base)}
    <button class="menu-btn" aria-label="菜单" aria-expanded="false">☰</button>
    <nav class="hdr-nav">
      ${NAV.map((n) => `<a href="${base}${n.href}"${n.key === active ? ' class="on"' : ''}>${n.label}</a>`).join('')}
    </nav>
    <div class="hdr-tools">
      <button class="theme-btn" aria-label="切换主题">☀</button>
    </div>
  </div>
</header>`;

const FOOTER = (base) => `<footer class="foot">
  <div class="foot-in">
    <div class="col">
      <h4>PET 备考小站</h4>
      <span style="display:block;line-height:1.7">B1 Preliminary 官方词表 ${STATS.total} 条 + ${GRAMMAR_STATS.topics} 个语法考点 + ${Q_STATS.total} 道易错题</span>
    </div>
    <div class="col">
      <h4>词汇</h4>
      <a href="${base}words.html">全部词表</a>
      <a href="${base}topics/index.html">按话题</a>
      <a href="${base}quiz.html">背单词</a>
    </div>
    <div class="col">
      <h4>语法</h4>
      <a href="${base}grammar.html">语法体系</a>
      <a href="${base}review.html">语法练习</a>
    </div>
    <div class="col">
      <h4>关于</h4>
      <a href="${base}plan.html">8 周计划</a>
      <a href="${base}stats.html">数据总览</a>
      <a href="${base}traps.html">易错点</a>
    </div>
  </div>
</footer>`;

const SITE_NAME = 'PET 备考小站';

function page({ base = '', active = '', title, desc = '', body, script = '', rawScript = '', dataKeys = [], dataExtra = null }) {
  // 统一加站名后缀，标签页里始终能看到站点身份；已含站名的不重复加
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} · ${SITE_NAME}`;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%231b6b52'/%3E%3Ctext x='16' y='23' font-family='Georgia,serif' font-size='17' font-weight='600' fill='%23fff' text-anchor='middle'%3EP%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="${base}assets/style.css">
<script>try{var t=JSON.parse(localStorage.getItem('pet-theme')||'null');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
</head>
<body data-base="${base}">
${HEADER(base, active)}
<main class="main">
<div class="wrap">
${body}
</div>
</main>
${FOOTER(base)}
<script src="${base}assets/app.js"></script>
${script ? `${inlineData(dataKeys, dataExtra)}<script>${script}</script>` : ''}
${rawScript}
</body>
</html>`;
}

/* ==========================================================
   1. 首页
   ========================================================== */
function buildHome() {
  const topicCards = TOPIC_SORTED.slice(0, 6).map((t) => `<a class="card" href="topics/${t.id}.html">
    <div class="card-ico">${t.icon}</div>
    <h3>${esc(t.name)}</h3>
    <div class="meta">${t.n} 词</div>
  </a>`).join('');

  const grammarCards = GRAMMAR.map((g) => `<a class="card" href="grammar/${g.id}.html">
    <div class="card-ico">${g.icon}</div>
    <h3>${esc(g.name)}</h3>
    <div class="meta">${g.topics.length} 个考点 · ${g.topics.reduce((s, t) => s + t.traps.length, 0)} 条易错</div>
  </a>`).join('');

  const body = `
<section class="hero">
  <div class="hero-badge"><span class="dot-live"></span>B1 Preliminary · 官方词表 ${STATS.total} 条 · ${Q_STATS.total} 道易错题</div>
  <h1>背单词最怕<span class="accent-word">没有边界</span>，<br>学语法最怕<span class="accent-word">不知道错在哪</span></h1>
  <p class="lede">
    PET 的词汇是 3000 条量级、语法是 43 个考点量级 —— 靠"多背多看"没有边界感。<br>
    这个站点把两件事都变成可计数的工程：<b>官方词表全量入库</b>，按话题与频率分档；
    <b>语法拆成可勾选的考点</b>，每个考点配易错对比和真题式练习。
  </p>
  <div class="hero-cta">
    <a class="btn primary" href="quiz.html">开始背单词 <span aria-hidden="true">→</span></a>
    <a class="btn ghost" href="review.html">练一组语法</a>
  </div>
  <div class="stats reveal">
    <div class="stat"><b data-count="${STATS.words}">${STATS.words}</b><span>官方单词</span></div>
    <div class="stat"><b data-count="${STATS.phrases}">${STATS.phrases}</b><span>官方短语</span></div>
    <div class="stat"><b data-count="${GRAMMAR_STATS.topics}">${GRAMMAR_STATS.topics}</b><span>语法考点</span></div>
    <div class="stat"><b data-count="${GRAMMAR_STATS.traps}">${GRAMMAR_STATS.traps}</b><span>易错对比</span></div>
    <div class="stat"><b data-count="${Q_STATS.total}">${Q_STATS.total}</b><span>练习题</span></div>
  </div>
</section>

<section class="section">
  <div class="section-head">
    <h2>三条主线</h2>
    <span class="sub">词汇、语法、练习各自独立，又互相指路</span>
  </div>
  <div class="grid c3">
    <a class="card" href="words.html">
      <div class="card-ico">Aa</div>
      <h3>全量词表 · ${STATS.total} 条</h3>
      <p class="desc">严格取自 Cambridge B1 Preliminary 2025 官方词汇表：${STATS.words} 个单词 + ${STATS.phrases} 个短语。每条带中文释义、音标、词性、官方例句，按核心/常考/拓展三档标注，可按话题与掌握状态筛选。</p>
      <div class="meta" style="margin-top:12px">${STATS.core} 核心 · ${STATS.pet} 常考 · ${STATS.ext} 拓展</div>
    </a>
    <a class="card" href="grammar.html">
      <div class="card-ico">§</div>
      <h3>语法体系 · ${GRAMMAR_STATS.sections} 族 ${GRAMMAR_STATS.topics} 考点</h3>
      <p class="desc">从时态、被动、非谓语到从句与语篇，每个考点给出规则、变化表、例句，以及最容易踩的错法（✕ 错句 vs ✓ 对句）。按 B1 考查权重排序，不是语法书目录。</p>
      <div class="meta" style="margin-top:12px">${GRAMMAR_STATS.traps} 条易错对比 · ${GRAMMAR_STATS.examples} 个例句</div>
    </a>
    <a class="card" href="review.html">
      <div class="card-ico">?</div>
      <h3>语法练习 · ${Q_STATS.total} 题</h3>
      <p class="desc">三种题型混编：单项选择（对齐 PET Part 5）、挑出正确句（写作自查）、开放式填空（对齐 PET Part 6）。答完记录各考点正确率，错的题自动进错题本。</p>
      <div class="meta" style="margin-top:12px">选择 ${Q_STATS.choice} · 改错 ${Q_STATS.correct} · 填空 ${Q_STATS.fill}</div>
    </a>
  </div>
</section>

<section class="section">
  <div class="section-head">
    <h2>按话题背：官方 23 个话题</h2>
    <span class="sub"><a href="topics/index.html">查看全部 →</a></span>
  </div>
  <div class="grid c3">${topicCards}</div>
</section>

<section class="section">
  <div class="section-head">
    <h2>按考点学：${GRAMMAR_STATS.sections} 个语法族</h2>
    <span class="sub"><a href="grammar.html">进入语法体系 →</a></span>
  </div>
  <div class="grid c3">${grammarCards}</div>
</section>

`;
  write('index.html', page({
    title: 'PET 备考小站 · 官方词表 + 语法体系 + 背单词与语法练习',
    desc: `Cambridge B1 Preliminary 官方词表 ${STATS.total} 条全量入库，${GRAMMAR_STATS.topics} 个语法考点逐条拆解，${Q_STATS.total} 道易错题带解析，按遗忘曲线背单词。`,
    active: 'home',
    body,
  }));
}

/* ==========================================================
   2. 词汇总览
   ========================================================== */
function buildWords() {
  const body = `
<div class="page-head">
  <div class="crumb"><a href="index.html">首页</a> / 词汇</div>
  <h1>官方词表 · ${STATS.total} 条</h1>
  <p class="lede">Cambridge B1 Preliminary 词汇表全量：${STATS.words} 个单词 + ${STATS.phrases} 个短语。
  三档频率标注帮你分配精力 —— <b>核心</b>是最该先拿下的高频词，<b>常考</b>是 B1 层级的典型词，<b>拓展</b>是出现频率较低但仍在大纲内的词。</p>
</div>

<section class="section" style="margin-top:28px">
  <div class="kv">
    <div class="k"><b>${STATS.core}</b><span>核心（中考/高考高频）</span><div class="bar"><i style="width:${Math.round(STATS.core / STATS.total * 100)}%"></i></div></div>
    <div class="k"><b>${STATS.pet}</b><span>常考（B1 典型）</span><div class="bar warn"><i style="width:${Math.round(STATS.pet / STATS.total * 100)}%"></i></div></div>
    <div class="k"><b>${STATS.ext}</b><span>拓展（低频大纲词）</span><div class="bar rose"><i style="width:${Math.round(STATS.ext / STATS.total * 100)}%"></i></div></div>
    <div class="k" id="kKnown"><b>—</b><span>你已掌握</span><div class="bar"><i style="width:0%"></i></div></div>
  </div>
</section>

<section class="section" style="margin-top:34px">
  <div class="toolbar">
    <input class="field" id="wq" type="search" placeholder="搜索单词或中文释义…" autocomplete="off">
  </div>
  <div class="chips" style="margin-bottom:20px">
    <button class="chip on" data-filter="all">全部</button>
    <button class="chip" data-filter="core">核心</button>
    <button class="chip" data-filter="pet">常考</button>
    <button class="chip" data-filter="ext">拓展</button>
    <button class="chip" data-filter="phrase">仅短语</button>
    <button class="chip" data-filter="new">未掌握</button>
    <button class="chip" data-filter="known">已掌握</button>
  </div>
  <div id="wlist"></div>
</section>
`;
  const script = `
const { WORDS, STATS } = window.PET_DATA;
const P = window.PET;
P.renderWordList({ mount: '#wlist', words: WORDS, pageSize: 40, search: '#wq' });
function drawKnown() {
  const n = P.knownCount();
  const el = document.querySelector('#kKnown');
  if (!el) return;
  el.querySelector('b').textContent = n.toLocaleString('en-US');
  el.querySelector('i').style.width = Math.min(100, n / STATS.total * 100) + '%';
}
drawKnown();
document.addEventListener('pet:known', drawKnown);
`;
  write('words.html', page({
    dataKeys: ['WORDS', 'STATS'],
    title: `官方词汇表 · ${STATS.total} 条`,
    desc: 'B1 Preliminary 官方词表全量，含中文释义、音标、词性、官方例句与频率分档。',
    active: 'words',
    body, script,
  }));
}

/* ==========================================================
   3. 话题索引 + 话题详情
   ========================================================== */
function buildTopics() {
  const cards = TOPIC_SORTED.map((t) => `<a class="card" href="${t.id}.html">
    <div class="card-ico">${t.icon}</div>
    <h3>${esc(t.name)}</h3>
    <div class="meta">${t.n} 词 · ${esc(t.official)}</div>
  </a>`).join('');

  write('topics/index.html', page({
    base: '../',
    title: '按话题背单词 · PET 23 个话题',
    desc: 'Cambridge B1 Preliminary 附录 2 的官方话题分类。',
    active: 'words',
    body: `
<div class="page-head">
  <div class="crumb"><a href="../index.html">首页</a> / <a href="../words.html">词汇</a> / 话题</div>
  <h1>按话题背 · ${TOPIC_SORTED.length} 个话题</h1>
  <p class="lede">话题是 Cambridge 官方给 B1 词表加的第一层结构。同一话题的词常常一起出现在阅读和写作里，成组记比按字母背有效。</p>
</div>
<section class="section">
  <div class="grid c3">${cards}</div>
  <div class="note">不是所有大纲词都有话题归属 —— 功能词（the / and / of）和跨话题通用词不在附录 2 内，它们在<a href="../words.html">全部词表</a>里。一个词可能同时属于多个话题，所以各话题词数相加大于总词数。</div>
</section>`,
  }));

  TOPIC_SORTED.forEach((t) => {
    const list = WORD_BY_TOPIC.get(t.id) || [];
    write(`topics/${t.id}.html`, page({
      base: '../',
      dataKeys: [],
      dataExtra: { TOPIC_WORDS: list.map((w) => ({ w: w.w, pos: w.pos, posZh: w.posZh, t: w.t, zh: w.zh, tag: w.tag, ph: w.ph, ex: w.ex, tp: w.tp, al: w.al })) },
      title: `${t.name} · ${list.length} 个单词`,
      desc: `${t.official} 话题下的 B1 Preliminary 词汇。`,
      active: 'words',
      body: `
<div class="page-head">
  <div class="crumb"><a href="../index.html">首页</a> / <a href="../words.html">词汇</a> / <a href="index.html">话题</a> / ${esc(t.name)}</div>
  <h1>${esc(t.name)}</h1>
  <p class="lede">${esc(t.official)} · ${list.length} 个词。点单词标记已掌握。</p>
</div>
<section class="section">
  <div class="toolbar">
    <input class="field" id="wq" type="search" placeholder="在本话题内搜索…" autocomplete="off">
  </div>
  <div class="chips" style="margin-bottom:20px">
    <button class="chip on" data-filter="all">全部</button>
    <button class="chip" data-filter="core">核心</button>
    <button class="chip" data-filter="pet">常考</button>
    <button class="chip" data-filter="ext">拓展</button>
    <button class="chip" data-filter="new">未掌握</button>
  </div>
  <div id="wlist"></div>
</section>`,
      script: `
const list = window.PET_DATA.TOPIC_WORDS;
window.PET.renderWordList({ mount: '#wlist', words: list, pageSize: 40, search: '#wq' });
`,
    }));
  });
}

/* ==========================================================
   4. 语法：族索引页 + 每个族一个详情页
   考点在详情页里用可折叠卡片，默认收起，避免长页面
   ========================================================== */
function topicCardHtml(t, index) {
  const qn = (Q_BY_TOPIC.get(t.id) || []).length;
  const trapN = t.traps.length;
  // 摘要要剥离 **加粗** 与 `代码` 标记，否则折叠标题里会露出原始星号
  const plainRule = t.rule.replace(/\*\*([^*]*)\*\*/g, '$1').replace(/`([^`]*)`/g, '$1');
  const quick = plainRule.length > 64 ? plainRule.slice(0, 62) + '…' : plainRule;

  const body = `
  ${t.form ? `<div class="gform" style="margin-top:16px">${esc(t.form)}</div>` : ''}
  ${t.table ? `<table class="gtable"><thead><tr>${t.table.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
    t.table.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')
  }</tbody></table>` : ''}
  <ul class="exlist">${t.examples.map((e) => `<li><span class="en">${esc(e.en)}</span><span class="zh">${esc(e.zh)}</span></li>`).join('')}</ul>
  <div class="traps">${t.traps.map((x) => `
    <div class="trap">
      <div class="tth">${esc(x.t)}</div>
      <span class="bad">${esc(x.bad)}</span>
      <span class="good">${esc(x.good)}</span>
      <div class="why">${rich(x.why)}</div>
    </div>`).join('')}
  </div>
  ${qn ? `<div style="margin-top:16px"><a class="btn sm" href="../review.html?topic=${t.id}">练这个考点（${qn} 题）→</a></div>` : ''}`;

  return `
<details class="tcard" id="${t.id}">
  <summary class="tcard-sum">
    <span class="tcard-num">${String(index + 1).padStart(2, '0')}</span>
    <span class="tcard-main">
      <span class="tcard-title">${esc(t.name)}<span class="lv ${esc(t.level)}">${esc(t.level)}</span></span>
      <span class="tcard-quick">${esc(quick)}</span>
    </span>
    <span class="tcard-meta">${trapN} 条易错${qn ? ` · ${qn} 题` : ''}</span>
    <span class="tcard-caret" aria-hidden="true"></span>
  </summary>
  <div class="tcard-body">${body}</div>
</details>`;
}

function buildGrammar() {
  /* ---------- 族索引页 ---------- */
  const cards = GRAMMAR.map((g) => {
    const trapN = g.topics.reduce((a, t) => a + t.traps.length, 0);
    const qN = g.topics.reduce((a, t) => a + (Q_BY_TOPIC.get(t.id) || []).length, 0);
    const names = g.topics.map((t) => esc(t.name)).join(' · ');
    return `<a class="card gfam" href="grammar/${g.id}.html">
      <div class="gfam-top"><span class="card-ico">${g.icon}</span><span class="gfam-count">${g.topics.length} 个考点</span></div>
      <h3>${esc(g.name)}</h3>
      <p class="gfam-list">${names}</p>
      <div class="meta">${trapN} 条易错对比 · ${qN} 道练习题</div>
    </a>`;
  }).join('');

  write('grammar.html', page({
    title: `语法体系 · ${GRAMMAR_STATS.sections} 族 ${GRAMMAR_STATS.topics} 个考点`,
    desc: `B1 Preliminary 语法 ${GRAMMAR_STATS.sections} 大族 ${GRAMMAR_STATS.topics} 考点，按族分页，每页考点可折叠展开。`,
    active: 'grammar',
    body: `
<div class="page-head">
  <div class="crumb"><a href="index.html">首页</a> / 语法</div>
  <h1>语法体系</h1>
  <p class="lede">${GRAMMAR_STATS.sections} 个语法族、${GRAMMAR_STATS.topics} 个考点。点进任一族看考点明细 ——
  每个考点一张可折叠的卡，先看标题和一句话规则，需要时再展开表格、例句与 <b>✕ 错句 / ✓ 对句</b>。</p>
</div>

<section class="section" style="margin-top:28px">
  <div class="kv">
    <div class="k"><b>${GRAMMAR_STATS.sections}</b><span>语法族</span></div>
    <div class="k"><b>${GRAMMAR_STATS.topics}</b><span>考点</span></div>
    <div class="k"><b>${GRAMMAR_STATS.traps}</b><span>易错对比</span></div>
    <div class="k"><b>${GRAMMAR_STATS.examples}</b><span>例句</span></div>
  </div>
</section>

<section class="section">
  <div class="grid c3">${cards}</div>
</section>

<div class="note">语法族的排序按考试中出现的密度排列，不代表难度。考点卡上带 <span class="lv A2">A2</span> 的是复习性考点（KET 已覆盖），带 <span class="lv B1">B1</span> 的是 PET 主力考点，带 <span class="lv B1+">B1+</span> 的是进阶考点（出现在阅读长难句里，写作不强制）。</div>
`,
  }));

  /* ---------- 每个族一个详情页 ---------- */
  GRAMMAR.forEach((g, gi) => {
    const prev = GRAMMAR[gi - 1];
    const next = GRAMMAR[gi + 1];
    const cardsHtml = g.topics.map((t, i) => topicCardHtml(t, i)).join('');
    const navBtns = `
  <div class="gfam-pager">
    ${prev ? `<a class="btn sm" href="${prev.id}.html">← ${esc(prev.name)}</a>` : '<span></span>'}
    <a class="btn sm" href="../grammar.html">全部语法族</a>
    ${next ? `<a class="btn sm" href="${next.id}.html">${esc(next.name)} →</a>` : '<span></span>'}
  </div>`;

    write(`grammar/${g.id}.html`, page({
      base: '../',
      title: `${g.name} · ${g.topics.length} 个语法考点`,
      desc: `${g.name}：${g.topics.map((t) => t.name).join('、')}。每个考点含规则、变化表、例句与易错对比。`,
      active: 'grammar',
      body: `
<div class="page-head">
  <div class="crumb"><a href="../index.html">首页</a> / <a href="../grammar.html">语法</a> / ${esc(g.name)}</div>
  <h1>${g.icon} ${esc(g.name)}</h1>
  <p class="lede">${esc(g.hook)}</p>
</div>

<section class="section" style="margin-top:24px">
  <div class="toolbar">
    <button class="chip" id="expandAll">全部展开</button>
    <button class="chip" id="collapseAll">全部收起</button>
    <span class="quiz-count" style="margin-left:auto">${g.topics.length} 个考点</span>
  </div>
  <div class="tcards">${cardsHtml}</div>
  ${navBtns}
</section>

<div class="note">点标题展开或收起。带 <span class="lv A2">A2</span> 的是复习性考点，<span class="lv B1">B1</span> 是 PET 主力考点，<span class="lv B1+">B1+</span> 是进阶考点。</div>
`,
      rawScript: `<script>
(function(){
  var expand = document.querySelector('#expandAll');
  var collapse = document.querySelector('#collapseAll');
  var all = function(){ return document.querySelectorAll('.tcard'); };
  if (expand) expand.addEventListener('click', function(){ all().forEach(function(d){ d.open = true; }); });
  if (collapse) collapse.addEventListener('click', function(){ all().forEach(function(d){ d.open = false; }); });
  // 从外部带 #考点id 进来时，自动展开并滚动到该卡
  var hash = location.hash.replace('#','');
  if (hash) {
    var target = document.getElementById(hash);
    if (target && target.tagName === 'DETAILS') {
      target.open = true;
      setTimeout(function(){ target.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60);
    }
  }
})();
</script>`,
    }));
  });
}

/* ==========================================================
   6. 背单词（SRS 驱动的记忆页）
   ========================================================== */
function buildStudy() {
  const dueToday = `document.querySelector('#kDue').textContent`;
  write('quiz.html', page({
    dataKeys: ['WORDS', 'STATS'],
    title: '背单词 · 间隔重复记忆',
    desc: `按遗忘曲线安排 ${STATS.total} 条 PET 词条的复习：看词回想或四选一识别，答完自动排下次时间。`,
    active: 'words-study',
    body: `
<div class="page-head">
  <div class="crumb"><a href="index.html">首页</a> / 背单词</div>
  <h1>背单词</h1>
  <p class="lede">不按字母顺序背，按<b>你忘得快的地方</b>背。每答一个词都会记进记忆库：
  忘了 10 分钟后再来，记得越牢间隔越长（1 天 → 3 天 → 7 天 → 21 天以上）。</p>
</div>

<section class="section" style="margin-top:26px">
  <div class="kv" id="srsKv">
    <div class="k"><b id="kDue">—</b><span>今天待复习</span></div>
    <div class="k"><b id="kTotal">—</b><span>记忆库总词数</span></div>
    <div class="k"><b id="kLeft">—</b><span>本范围内还没背过</span></div>
    <div class="k"><b id="kMature">—</b><span>已牢固（间隔 ≥ 21 天）</span></div>
  </div>
</section>

<section class="section" style="margin-top:30px" id="setup">
  <div class="card" style="max-width:660px">
    <h3 style="margin-bottom:18px">开始一轮</h3>

    <div class="kicker">怎么背</div>
    <div class="chips" id="cardChips">
      <button class="chip on" data-c="recall">看词回想（自己判断）</button>
      <button class="chip" data-c="choice">四选一（自动判分）</button>
    </div>

    <div class="kicker" style="margin-top:18px">背哪些</div>
    <div class="chips" id="modeChips">
      <button class="chip on" data-m="mix">混合（到期 + 新词）</button>
      <button class="chip" data-m="due">只复习到期的</button>
      <button class="chip" data-m="new">只学新词</button>
    </div>

    <div class="kicker" style="margin-top:18px">词源范围</div>
    <div class="chips" id="srcChips">
      <button class="chip on" data-s="core">核心词（${STATS.core}）</button>
      <button class="chip" data-s="all">全部（${STATS.total}）</button>
      <button class="chip" data-s="phrase">只背短语（${STATS.phrases}）</button>
    </div>

    <div class="kicker" style="margin-top:18px">每轮词数</div>
    <div class="chips" id="lenChips">
      <button class="chip" data-l="10">10 个</button>
      <button class="chip on" data-l="20">20 个</button>
      <button class="chip" data-l="30">30 个</button>
    </div>

    <div style="margin-top:24px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <button class="btn primary" id="startBtn">开始 →</button>
      <button class="btn ghost" id="resetBtn">重置记忆数据</button>
    </div>
    <div class="note" style="margin-bottom:0">
      回想模式：空格翻卡，翻卡后 <b>1</b> 忘了 · <b>2</b> 困难 · <b>3</b> 会了 · <b>4</b> 很熟。<br>
      四选一模式：<b>1–4</b> 选答案，<b>Enter</b> 下一词；答对自动记「会了」，答错自动记「忘了」。
    </div>
  </div>
</section>

<section class="section" id="zone" style="display:none"><div id="fc"></div></section>
`,
    script: `
const { WORDS, STATS } = window.PET_DATA;
const P = window.PET;
let card = 'recall', mode = 'mix', src = 'core', len = 20;

function refreshKv() {
  const s = P.srsStats();
  const pool = src === 'core' ? WORDS.filter(w => w.tag === 'core')
             : src === 'phrase' ? WORDS.filter(w => w.t === 'phrase')
             : WORDS;
  // 「没碰过」只统计当前范围里还没进记忆库的词，避免和其他两栏口径混淆
  const seen = new Set(Object.keys(P.srsAll ? P.srsAll() : {}));
  const left = pool.filter(w => !seen.has(w.w.toLowerCase())).length;
  const set = (id, v) => { const e = document.querySelector(id); if (e) e.textContent = v; };
  set('#kDue', s.due);
  set('#kTotal', s.total);
  set('#kLeft', left);
  set('#kMature', s.mature);
}
refreshKv();
document.addEventListener('pet:srs', refreshKv);

function pick(sel, attr, cb) {
  document.querySelectorAll(sel + ' .chip').forEach(c => c.addEventListener('click', () => {
    document.querySelectorAll(sel + ' .chip').forEach(x => x.classList.remove('on'));
    c.classList.add('on'); cb(c.getAttribute(attr));
  }));
}
pick('#cardChips', 'data-c', v => card = v);
pick('#modeChips', 'data-m', v => { mode = v; refreshKv(); });
pick('#srcChips', 'data-s', v => { src = v; refreshKv(); });
pick('#lenChips', 'data-l', v => len = parseInt(v, 10));

document.querySelector('#startBtn').addEventListener('click', () => {
  const pool = src === 'core' ? WORDS.filter(w => w.tag === 'core')
             : src === 'phrase' ? WORDS.filter(w => w.t === 'phrase')
             : WORDS;
  document.querySelector('#setup').style.display = 'none';
  document.querySelector('#zone').style.display = '';
  P.wordStudy({ mount: '#fc', words: pool, mode, card, limit: len, backHref: 'quiz.html' });
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.querySelector('#resetBtn').addEventListener('click', () => {
  if (confirm('确定清空所有记忆进度？此操作无法撤销。')) { P.srsReset(); P.clearKnown(); refreshKv(); }
});
`,
  }));
}

/* ==========================================================
   7. 语法练习（按考点练 + 正确率 + 错题本）
   ========================================================== */
function buildDrill() {
  const topicName = new Map();
  GRAMMAR.forEach((g) => g.topics.forEach((t) => topicName.set(t.id, { name: t.name, group: g.name, gid: g.id })));

  const groupOptions = GRAMMAR.map((g) => {
    const n = g.topics.reduce((a, t) => a + (Q_BY_TOPIC.get(t.id) || []).length, 0);
    return `<button class="chip" data-g="${g.id}">${esc(g.name)} · ${n}</button>`;
  }).join('');

  write('review.html', page({
    dataKeys: ['QUESTIONS', 'QUESTIONS_2', 'GRAMMAR'],
    title: '语法练习 · 按考点刷题',
    desc: `${Q_STATS.total} 道 PET 语法易错题，按考点或语法族练习，自动记录各考点正确率并收集错题。`,
    active: 'grammar-drill',
    body: `
<div class="page-head">
  <div class="crumb"><a href="index.html">首页</a> / 语法练习</div>
  <h1>语法练习</h1>
  <p class="lede">${Q_STATS.total} 道题按 <b>${GT_IDS.size} 个考点</b>分组。每次答完会记下考点与题号：
  正确率低的考点会浮到前面，答错过的题会进错题本 —— 下一次就专练这些。</p>
</div>

<section class="section" style="margin-top:26px">
  <div class="kv">
    <div class="k"><b id="kQn">0</b><span>累计已答</span></div>
    <div class="k"><b id="kRate">—</b><span>总正确率</span></div>
    <div class="k"><b id="kWrong">0</b><span>错题本</span></div>
    <div class="k"><b id="kWeak">—</b><span>最弱考点</span></div>
  </div>
</section>

<section class="section" style="margin-top:30px" id="setup">
  <div class="card" style="max-width:700px">
    <h3 style="margin-bottom:18px">开始一组</h3>

    <div class="kicker">练哪里</div>
    <div class="chips" id="scopeChips">
      <button class="chip on" data-scope="all">全部考点</button>
      <button class="chip" data-scope="wrong">只练错题本（<span id="wrongN">0</span>）</button>
      <button class="chip" data-scope="weak">专攻最弱考点</button>
    </div>

    <div class="kicker" style="margin-top:18px">语法族（选「全部考点」时生效）</div>
    <div class="chips" id="groupChips">
      <button class="chip on" data-g="all">不限</button>
      ${groupOptions}
    </div>

    <div class="kicker" style="margin-top:18px">题型</div>
    <div class="chips" id="typeChips">
      <button class="chip on" data-t="all">混合</button>
      <button class="chip" data-t="choice">单项选择</button>
      <button class="chip" data-t="correct">改错</button>
      <button class="chip" data-t="fill">填空</button>
    </div>

    <div class="kicker" style="margin-top:18px">题量</div>
    <div class="chips" id="lenChips">
      <button class="chip" data-l="10">10 题</button>
      <button class="chip on" data-l="20">20 题</button>
      <button class="chip" data-l="40">40 题</button>
    </div>

    <div style="margin-top:24px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <button class="btn primary" id="startBtn">开始 →</button>
      <button class="btn ghost" id="resetBtn">清空练习记录</button>
    </div>
    <div class="note" style="margin-bottom:0">键盘 <b>1–4</b> 选答案、<b>Enter</b> 下一题。填空题按 <b>Enter</b> 提交。</div>
  </div>
</section>

<section class="section" id="zone" style="display:none"><div id="qz"></div></section>

<section class="section" id="weakSection" style="display:none">
  <div class="section-head"><h2>各考点正确率</h2><span class="sub">答过 3 题以上的才计入，按正确率升序</span></div>
  <div id="weakList"></div>
</section>
`,
    script: `
const { QUESTIONS, QUESTIONS_2, GRAMMAR } = window.PET_DATA;
const P = window.PET;
const ALL = [...QUESTIONS, ...QUESTIONS_2];
const BY_TOPIC = new Map();
ALL.forEach(q => { if (!BY_TOPIC.has(q.topic)) BY_TOPIC.set(q.topic, []); BY_TOPIC.get(q.topic).push(q); });
const GT = new Map();
const TNAME = new Map();
GRAMMAR.forEach(g => g.topics.forEach(t => { GT.set(t.id, g.id); TNAME.set(t.id, t.name); }));

let scope = 'all', grp = 'all', type = 'all', len = 20, topic = null;

function pick(sel, attr, cb) {
  document.querySelectorAll(sel + ' .chip').forEach(c => c.addEventListener('click', () => {
    document.querySelectorAll(sel + ' .chip').forEach(x => x.classList.remove('on'));
    c.classList.add('on'); cb(c.getAttribute(attr));
  }));
}
pick('#scopeChips', 'data-scope', v => scope = v);
pick('#groupChips', 'data-g', v => grp = v);
pick('#typeChips', 'data-t', v => type = v);
pick('#lenChips', 'data-l', v => len = parseInt(v, 10));

function weakestTopic() {
  const st = P.qTopicStats().filter(x => x.n >= 3).sort((a, b) => a.rate - b.rate);
  return st.length ? st[0].topic : null;
}

function refreshStats() {
  const st = P.qTopicStats();
  const n = st.reduce((a, x) => a + x.n, 0);
  const ok = st.reduce((a, x) => a + x.ok, 0);
  const wrong = P.wrongIds().length;
  const set = (id, v) => { const e = document.querySelector(id); if (e) e.textContent = v; };
  set('#kQn', n);
  set('#kRate', n ? Math.round(ok / n * 100) + '%' : '—');
  set('#kWrong', wrong);
  const wn = document.querySelector('#wrongN'); if (wn) wn.textContent = wrong;
  const w = weakestTopic();
  set('#kWeak', w ? TNAME.get(w) || w : '—');

  // 正确率表
  const sec = document.querySelector('#weakSection');
  const list = document.querySelector('#weakList');
  const rows = st.filter(x => x.n >= 3).sort((a, b) => a.rate - b.rate);
  if (rows.length && list) {
    sec.style.display = '';
    list.innerHTML = '<div class="wordlist">' + rows.map(x => {
      const pct = Math.round(x.rate * 100);
      const cls = pct < 60 ? 'bar rose' : pct < 80 ? 'bar warn' : 'bar';
      return '<div class="wrow" style="grid-template-columns:1.4fr 120px 1fr auto;cursor:default">' +
        '<span class="w" style="cursor:default">' + (TNAME.get(x.topic) || x.topic) + '</span>' +
        '<span class="pos">' + x.ok + ' / ' + x.n + ' 题</span>' +
        '<span class="' + cls + '"><i style="width:' + pct + '%"></i></span>' +
        '<span class="flag">' + pct + '%</span></div>';
    }).join('') + '</div>';
  } else if (sec) {
    sec.style.display = 'none';
  }
}
refreshStats();
document.addEventListener('pet:qlog', refreshStats);

// 从语法页「练这个考点」跳过来：?topic=xxx
const tp = new URLSearchParams(location.search).get('topic');
if (tp && TNAME.has(tp)) {
  topic = tp;
  const scopeChips = document.querySelector('#scopeChips');
  if (scopeChips) scopeChips.style.display = 'none';
  const banner = document.createElement('div');
  banner.className = 'note';
  banner.style.cssText = 'margin-top:18px;border-left-color:var(--accent)';
  banner.innerHTML = '正在练单个考点：<b>' + TNAME.get(tp) + '</b> · 共 ' +
    (BY_TOPIC.get(tp) || []).length + ' 题 · <a href="review.html">改为自由练习 →</a>';
  const setup = document.querySelector('#setup');
  if (setup) setup.parentNode.insertBefore(banner, setup);
}

document.querySelector('#startBtn').addEventListener('click', () => {
  let pool = ALL.slice();
  if (topic) {
    pool = pool.filter(q => q.topic === topic);
  } else if (scope === 'wrong') {
    const ids = new Set(P.wrongIds());
    pool = pool.filter(q => ids.has(q.id));
    if (!pool.length) { alert('错题本是空的 —— 先随便练一组，答错的题会自动收进来。'); return; }
  } else if (scope === 'weak') {
    const w = weakestTopic();
    if (!w) { alert('还没积累足够数据 —— 先练几组，系统才能判断你最弱的考点。'); return; }
    pool = pool.filter(q => q.topic === w);
  } else {
    if (grp !== 'all') pool = pool.filter(q => GT.get(q.topic) === grp);
  }
  if (type !== 'all') pool = pool.filter(q => (q.type || 'choice') === type);
  if (!pool.length) { alert('这个组合下没有题，换一个筛选试试。'); return; }

  document.querySelector('#setup').style.display = 'none';
  document.querySelector('#zone').style.display = '';
  P.quiz({ mount: '#qz', questions: pool, limit: len, shuffle: true,
    reviewHref: 'grammar.html', reviewLabel: '看全部语法族',
    onRestart: () => location.reload(),
    onFinish: refreshStats });
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.querySelector('#resetBtn').addEventListener('click', () => {
  if (confirm('清空练习记录与错题本？')) { P.qReset(); refreshStats(); }
});
`,
  }));
}

/* ==========================================================
   8. 易错点：族索引 + 每族一页
   每个族的易错点按考点分组，页顶有小导航
   ========================================================== */
function trapItemHtml(x, opts) {
  const o = opts || {};
  const txt = esc((x.t + ' ' + x.bad + ' ' + x.good + ' ' + x.why).toLowerCase());
  const link = o.gid && o.tid
    ? `<div style="margin-top:8px"><a class="btn sm" href="${o.prefix || ''}grammar/${o.gid}.html#${o.tid}">看考点规则 →</a></div>`
    : '';
  const flag = o.label ? `<span class="flag" style="margin-left:auto">${esc(o.label)}</span>` : '';
  return `<div class="trap" data-txt="${txt}">
    <div class="tth">${esc(x.t)}${flag}</div>
    <span class="bad">${esc(x.bad)}</span>
    <span class="good">${esc(x.good)}</span>
    <div class="why">${rich(x.why)}</div>
    ${link}
  </div>`;
}

function buildTraps() {
  const TOTAL = GRAMMAR.reduce((a, g) => a + g.topics.reduce((b, t) => b + t.traps.length, 0), 0);

  /* ---------- 索引：12 张族卡 + 跨族搜索 ---------- */
  const cards = GRAMMAR.map((g) => {
    const n = g.topics.reduce((a, t) => a + t.traps.length, 0);
    const topicsWithTraps = g.topics.filter((t) => t.traps.length);
    const names = topicsWithTraps.map((t) => esc(t.name)).join(' · ');
    return `<a class="card gfam" href="traps/${g.id}.html" data-txt="${esc((g.name + ' ' + g.topics.map((t) => t.name).join(' ')).toLowerCase())}">
      <div class="gfam-top"><span class="card-ico">${g.icon}</span><span class="gfam-count">${n} 条</span></div>
      <h3>${esc(g.name)}</h3>
      <p class="gfam-list">${names}</p>
      <div class="meta">${topicsWithTraps.length} 个考点</div>
    </a>`;
  }).join('');

  // 跨族搜索索引：只带渲染需要的字段，避免把所有族页内容塞进索引页
  const searchIndex = [];
  GRAMMAR.forEach((g) => g.topics.forEach((t) => t.traps.forEach((x) => {
    searchIndex.push({
      k: x.t, b: x.bad, g: x.good, w: x.why,
      f: g.name, tp: t.name, gid: g.id, tid: t.id,
      txt: (x.t + ' ' + x.bad + ' ' + x.good + ' ' + x.why).toLowerCase(),
    });
  })));

  write('traps.html', page({
    title: `语法易错点 · ${TOTAL} 条按族查`,
    desc: `${TOTAL} 条易错对比按 ${GRAMMAR.length} 个语法族分页：错误写法、正确写法、错因一句话。`,
    active: 'traps',
    body: `
<div class="page-head">
  <div class="crumb"><a href="index.html">首页</a> / 易错点</div>
  <h1>易错点</h1>
  <p class="lede">全站 ${TOTAL} 条 <b>✕ 错句 / ✓ 对句</b> 按语法族分页收好。选一族进去逐条看，
  或者直接搜关键词 —— 搜的是错法和错因，不是族名。</p>
</div>

<section class="section" style="margin-top:24px">
  <div class="toolbar">
    <input class="field" id="tf" type="search" placeholder="筛选语法族，如 时态 / 冠词 / 从句…" autocomplete="off">
  </div>
  <div class="grid c3" id="famGrid">${cards}</div>
  <div class="empty" id="fempty" style="display:none"><b>没有匹配的族</b>换个词试试</div>
</section>

<section class="section">
  <div class="section-head"><h2>跨族搜索</h2><span class="sub">在全部 ${TOTAL} 条里找</span></div>
  <div class="toolbar">
    <input class="field" id="tq" type="search" placeholder="输入关键词，如 第三人称 / since / although / 冠词…" autocomplete="off">
  </div>
  <div id="tres" class="traps"></div>
  <div class="note" id="thint">输入关键词后显示匹配的易错点（最多 30 条）。平时按族浏览更快。</div>
  <div class="empty" id="tempty" style="display:none"><b>没找到</b>换个关键词</div>
</section>
`,
    dataKeys: [],
    dataExtra: { PET_TRAPS: searchIndex },
    script: `
(function(){
  // 族卡筛选
  var tf = document.querySelector('#tf');
  if (tf) tf.addEventListener('input', function(){
    var t = tf.value.trim().toLowerCase(), any = false;
    document.querySelectorAll('#famGrid .gfam').forEach(function(el){
      var ok = !t || (el.getAttribute('data-txt')||'').indexOf(t) >= 0;
      el.style.display = ok ? '' : 'none'; if (ok) any = true;
    });
    var em = document.querySelector('#fempty');
    if (em) em.style.display = any || !t ? 'none' : '';
  });

  // 跨族搜索：从内联索引里按需渲染，避免一上来就输出 119 条
  var DATA = (window.PET_DATA && window.PET_DATA.PET_TRAPS) || [];
  var q = document.querySelector('#tq');
  var res = document.querySelector('#tres');
  var hint = document.querySelector('#thint');
  var empty = document.querySelector('#tempty');
  if (!q || !res) return;
  function escHtml(s){ return String(s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  q.addEventListener('input', function(){
    var term = q.value.trim().toLowerCase();
    if (!term) { res.innerHTML = ''; hint.style.display = ''; empty.style.display = 'none'; return; }
    hint.style.display = 'none';
    var hit = DATA.filter(function(x){ return x.txt.indexOf(term) >= 0; }).slice(0, 30);
    if (!hit.length) { res.innerHTML = ''; empty.style.display = ''; return; }
    empty.style.display = 'none';
    res.innerHTML = hit.map(function(x){
      return '<div class="trap">' +
        '<div class="tth">' + escHtml(x.k) + '<span class="flag" style="margin-left:auto">' + escHtml(x.f) + ' · ' + escHtml(x.tp) + '</span></div>' +
        '<span class="bad">' + escHtml(x.b) + '</span>' +
        '<span class="good">' + escHtml(x.g) + '</span>' +
        '<div class="why">' + escHtml(x.w) + '</div>' +
        '<div style="margin-top:8px"><a class="btn sm" href="grammar/' + x.gid + '.html#' + x.tid + '">看考点规则 →</a></div>' +
        '</div>';
    }).join('');
  });
})();
`,
  }));

  /* ---------- 每个族一页 ---------- */
  GRAMMAR.forEach((g, gi) => {
    const prev = GRAMMAR[gi - 1];
    const next = GRAMMAR[gi + 1];
    const total = g.topics.reduce((a, t) => a + t.traps.length, 0);

    const groups = g.topics.filter((t) => t.traps.length).map((t) => `
<section class="tgroup" id="${t.id}">
  <div class="tgroup-head">
    <h3>${esc(t.name)}</h3>
    <span class="lv ${esc(t.level)}">${esc(t.level)}</span>
    <span class="tgroup-n">${t.traps.length} 条</span>
    <a class="btn sm" href="../grammar/${g.id}.html#${t.id}" style="margin-left:auto">考点规则 →</a>
  </div>
  <div class="traps">${t.traps.map((x) => trapItemHtml(x, null)).join('')}</div>
</section>`).join('');

    const jump = g.topics.filter((t) => t.traps.length)
      .map((t) => `<a class="chip" href="#${t.id}">${esc(t.name)} <span style="opacity:.6">${t.traps.length}</span></a>`).join('');

    const pager = `
  <div class="gfam-pager">
    ${prev ? `<a class="btn sm" href="${prev.id}.html">← ${esc(prev.name)}</a>` : '<span></span>'}
    <a class="btn sm" href="../traps.html">全部错点</a>
    ${next ? `<a class="btn sm" href="${next.id}.html">${esc(next.name)} →</a>` : '<span></span>'}
  </div>`;

    write(`traps/${g.id}.html`, page({
      base: '../',
      title: `${g.name} · ${total} 条易错点`,
      desc: `${g.name}的 ${total} 条易错对比：错误写法、正确写法、错因一句话。`,
      active: 'traps',
      body: `
<div class="page-head">
  <div class="crumb"><a href="../index.html">首页</a> / <a href="../traps.html">易错点</a> / ${esc(g.name)}</div>
  <h1>${g.icon} ${esc(g.name)}</h1>
  <p class="lede">${total} 条易错对比，按考点分组。每条都是「✕ 错法 → ✓ 对法 → 一句话原因」。</p>
</div>

<section class="section" style="margin-top:22px">
  <div class="chips" id="jump">${jump}</div>
  <div class="toolbar" style="margin-top:16px">
    <input class="field" id="tq" type="search" placeholder="在本族内搜索…" autocomplete="off">
    <span class="quiz-count" style="margin-left:auto">${total} 条</span>
  </div>
  <div id="tgroups">${groups}</div>
  <div class="empty" id="tempty" style="display:none"><b>没找到</b>换个关键词</div>
  ${pager}
</section>
`,
      rawScript: `<script>
(function(){
  var q = document.querySelector('#tq');
  if (!q) return;
  q.addEventListener('input', function(){
    var t = q.value.trim().toLowerCase(), any = false;
    document.querySelectorAll('#tgroups .trap').forEach(function(el){
      var ok = !t || (el.getAttribute('data-txt')||'').indexOf(t) >= 0;
      el.style.display = ok ? '' : 'none'; if (ok) any = true;
    });
    // 整组都不匹配就把组标题也藏起来
    document.querySelectorAll('#tgroups .tgroup').forEach(function(g){
      var shown = Array.prototype.some.call(g.querySelectorAll('.trap'), function(x){ return x.style.display !== 'none'; });
      g.style.display = (shown || !t) ? '' : 'none';
    });
    var em = document.querySelector('#tempty');
    if (em) em.style.display = (any || !t) ? 'none' : '';
  });
})();
</script>`,
    }));
  });
}

/* ==========================================================
   9. 数据总览
   ========================================================== */
function buildStats() {
  const tagRows = [
    ['核心（高频必背）', STATS.core],
    ['常考（B1 典型）', STATS.pet],
    ['拓展（低频大纲词）', STATS.ext],
  ];
  const topicRows = TOPIC_SORTED.map((t) => `<tr><td>${esc(t.name)}</td><td>${esc(t.official)}</td><td style="text-align:right">${t.n}</td></tr>`).join('');
  const gramRows = GRAMMAR.map((g) => {
    const n = g.topics.reduce((s, t) => s + t.traps.length, 0);
    const q = g.topics.reduce((s, t) => s + (Q_BY_TOPIC.get(t.id) || []).length, 0);
    return `<tr><td>${g.icon} ${esc(g.name)}</td><td style="text-align:right">${g.topics.length}</td><td style="text-align:right">${n}</td><td style="text-align:right">${q}</td></tr>`;
  }).join('');

  write('stats.html', page({
    title: 'PET 备考小站 · 数据总览',
    desc: '词表规模、频档分布、话题词量、语法考点与题量，全部实时计算。',
    active: 'stats',
    body: `
<div class="page-head">
  <div class="crumb"><a href="index.html">首页</a> / 数据</div>
  <h1>数据总览</h1>
  <p class="lede">本站所有数字都由构建脚本实时计算，不存在手写死数字。词表口径为 Cambridge 官方 B1 Preliminary 词汇表（2025 年 8 月版）。</p>
</div>

<section class="section">
  <div class="section-head"><h2>词汇</h2></div>
  <div class="kv">
    <div class="k"><b>${STATS.words}</b><span>单词</span></div>
    <div class="k"><b>${STATS.phrases}</b><span>短语</span></div>
    <div class="k"><b>${STATS.total}</b><span>词条合计</span></div>
    <div class="k"><b>${STATS.withExample}</b><span>带官方例句</span></div>
    <div class="k"><b>${STATS.topics}</b><span>官方话题</span></div>
  </div>
  <table class="gtable" style="margin-top:22px">
    <thead><tr><th>频档</th><th style="text-align:right">条数</th><th style="text-align:right">占比</th></tr></thead>
    <tbody>${tagRows.map(([n, v]) => `<tr><td>${n}</td><td style="text-align:right">${v}</td><td style="text-align:right">${(v / STATS.total * 100).toFixed(1)}%</td></tr>`).join('')}</tbody>
  </table>
</section>

<section class="section">
  <div class="section-head"><h2>各话题词量</h2><span class="sub">同一词可属多话题，故合计大于总词数</span></div>
  <table class="gtable">
    <thead><tr><th>中文</th><th>官方名</th><th style="text-align:right">词数</th></tr></thead>
    <tbody>${topicRows}</tbody>
  </table>
</section>

<section class="section">
  <div class="section-head"><h2>语法与题量</h2></div>
  <table class="gtable">
    <thead><tr><th>语法族</th><th style="text-align:right">考点</th><th style="text-align:right">易错对比</th><th style="text-align:right">练习题</th></tr></thead>
    <tbody>${gramRows}</tbody>
  </table>
  <div class="kv" style="margin-top:20px">
    <div class="k"><b>${GRAMMAR_STATS.traps}</b><span>易错对比合计</span></div>
    <div class="k"><b>${GRAMMAR_STATS.examples}</b><span>例句合计</span></div>
    <div class="k"><b>${Q_STATS.total}</b><span>练习题合计</span></div>
    <div class="k"><b>${GT_IDS.size}</b><span>覆盖考点</span></div>
  </div>
</section>

<section class="section">
  <div class="section-head"><h2>口径说明</h2></div>
  <div class="note" style="font-style:normal">
    <b>词表</b>：源自 Cambridge University Press 发布的 <i>B1 Preliminary and B1 Preliminary for Schools Vocabulary List</i>（August 2025），正文按字母序的词条 + 附录 2 的 23 个话题表。附录 1 的 word sets（数字、星期、月份、季节、国家/国籍、大洲）为封闭清单，未逐条计入词条总数。<br><br>
    <b>中文释义</b>：主数据来自 ECDICT 开源英汉词典，按官方词性优先选取义项，并对最高频的功能词与多义动词（go / take / get / make 等约 300 条）做了人工覆盖校正，避免词典里"打赌/保释金"这类非常用义项干扰。<br><br>
    <b>频档</b>：核心 = 中考或高考大纲词，或在 Oxford 3000 / Collins 3 星以上；常考 = 语料词频在前 25000；其余为拓展。这是启发式分档，不是官方 CEFR 标注。<br><br>
    <b>语法与题目</b>：按 B1 Preliminary 的公开考试说明（Reading Part 5 多项选择完形、Part 6 开放式完形、Writing 的邮件与文章任务）整理，为本站原创内容，非官方出版材料。
  </div>
</section>
`,
  }));
}

/* ==========================================================
   10. 8 周学习计划
   ========================================================== */
function buildPlan() {
  const weeks = [
    {
      w: 1, title: '时态地基',
      vocab: '核心词 1–650（按话题：日常、家庭、时间）',
      grammar: ['tense', 'passive'],
      focus: '把「一般现在 / 进行 / 过去」三种时的信号词认熟，先把被动的基本公式记牢（be + 过去分词）。',
      drill: '做「动词时态」全部 45 题，记录错题考点。',
    },
    {
      w: 2, title: '时态进阶 + 非谓语',
      vocab: '核心词 651–1300（教育、娱乐、食物）',
      grammar: ['tense', 'nonfinite'],
      focus: '现在完成 vs 一般过去是这一周的核心。非谓语只记「哪些动词后接 to do、哪些接 doing」两列清单。',
      drill: '做「非谓语动词」全部题 + 时态错题重做一遍。',
    },
    {
      w: 3, title: '情态动词 + 条件句',
      vocab: '核心词 1301–1950（健康、购物、交通）',
      grammar: ['modal', 'conditional'],
      focus: "mustn't / don't have to 与 can't be 的区分。条件句只抓两点：主将从现、If I were you。",
      drill: '情态与条件两个族全部题。',
    },
    {
      w: 4, title: '名词冠词 + 代词',
      vocab: '核心词 1951–2578（工作、自然、情感）',
      grammar: ['noun', 'pronoun'],
      focus: '不可数名词清单（information / advice / furniture / news / equipment / luggage）要能默写。a/an 按音素判断。',
      drill: '名词冠词 18 题 + 代词 15 题，错题写进自己的清单。',
    },
    {
      w: 5, title: '形容词副词 + 介词',
      vocab: '常考词 251（B1 典型高频）',
      grammar: ['adjadv', 'prep'],
      focus: '比较级不规则表；hard/hardly、late/lately 这类形副同形要背死。介词固定搭配整理成一张表。',
      drill: '两个族全部题；把错的介词搭配单独抄一遍。',
    },
    {
      w: 6, title: '从句',
      vocab: '拓展词 280 + 短语 266',
      grammar: ['clause'],
      focus: '宾语从句「陈述语序 + 时态呼应」；状语从句不要 although+but / because+so 连用；定语从句 which vs where。',
      drill: '从句全部题；重点做改错题型（挑出正确句）。',
    },
    {
      w: 7, title: '句子结构与语篇',
      vocab: '全量词表过一遍，只看「未掌握」',
      grammar: ['syntax', 'conjunction'],
      focus: '反义疑问句（前肯后否）、so/neither 倒装、There be 就近原则；however 是副词不是连词。',
      drill: '两族全部题 + 写作时自查这四类错误。',
    },
    {
      w: 8, title: '综合冲刺',
      vocab: '只复习「复习」页里到期的卡；错词本过两遍',
      grammar: ['tense', 'passive', 'nonfinite', 'clause'],
      focus: '回看「语法练习」页各考点正确率，专攻低于 60% 的；把「易错点」按族扫一遍。',
      drill: '每天一组 40 题语法练习；错题只看解析不看题目，检验是否真的理解。',
    },
  ];

  const gname = new Map(GRAMMAR.map((g) => [g.id, g.name]));

  const cards = weeks.map((k) => `
<div class="gtopic">
  <h3>第 ${k.w} 周 · ${esc(k.title)} <span class="lv B1">${k.w <= 4 ? '打基础' : k.w <= 7 ? '补短板' : '冲刺'}</span></h3>
  <table class="gtable" style="margin:14px 0">
    <tbody>
      <tr><td style="width:88px">词汇</td><td>${esc(k.vocab)}</td></tr>
      <tr><td>语法</td><td>${k.grammar.map((g) => `<a href="grammar/${g}.html">${esc(gname.get(g) || g)}</a>`).join(' · ')}</td></tr>
      <tr><td>重点</td><td>${esc(k.focus)}</td></tr>
      <tr><td>练习</td><td>${esc(k.drill)}</td></tr>
    </tbody>
  </table>
</div>`).join('');

  write('plan.html', page({
    title: 'PET 8 周备考计划',
    desc: '把 3109 条词表、43 个语法考点和 261 道题分配到 8 周，每周有明确的词汇范围、语法族和练习目标。',
    active: 'plan',
    body: `
<div class="page-head">
  <div class="crumb"><a href="index.html">首页</a> / 计划</div>
  <h1>8 周备考计划</h1>
  <p class="lede">按「词汇 + 语法 + 练习」三条线并行推进。每周的词汇量按核心词 ${STATS.core} 条 ÷ 4 周铺开，
  语法按依赖关系排序（先时态再非谓语，先条件句再从句）。不用严格照搬，但顺序建议保持。</p>
</div>

<section class="section" style="margin-top:24px">
  <div class="kv">
    <div class="k"><b>8</b><span>周</span></div>
    <div class="k"><b>${STATS.core}</b><span>核心词（前 4 周）</span></div>
    <div class="k"><b>${STATS.pet + STATS.ext}</b><span>常考 + 拓展（第 5–6 周）</span></div>
    <div class="k"><b>${Q_STATS.total}</b><span>练习题</span></div>
  </div>
  <div class="note" style="margin-top:20px">每天建议 30–40 分钟：背单词 10 分钟（做完今天到期的词）+ 读一个语法考点 10 分钟 + 语法练习 15 分钟。
  如果只有 15 分钟，优先做「复习」和「测验」，读语法可以放到周末集中看。</div>
</section>

<section class="section">
  ${cards}
</section>

<section class="section">
  <div class="section-head"><h2>三个自查节点</h2></div>
  <div class="grid c3">
    <a class="card" href="quiz.html">
      <h3>第 2 周末</h3>
      <p class="desc">做一组 40 题语法练习。如果正确率低于 60%，说明时态还没稳，把第 1–2 周重来一遍再往下走。</p>
    </a>
    <a class="card" href="stats.html">
      <h3>第 5 周末</h3>
      <p class="desc">在「语法练习」页看各考点正确率，用「专攻最弱考点」直接练那一个，不要平均用力。</p>
    </a>
    <a class="card" href="traps.html">
      <h3>考前三天</h3>
      <p class="desc">把「易错点」按族扫一遍（119 条，12 页，每页 6–19 条）。这比重新读语法规则有效，因为考试考的就是这些边界情况。</p>
    </a>
  </div>
</section>
`,
  }));
}

/* ==========================================================
   构建
   ========================================================== */
function main() {
  const t0 = Date.now();
  buildHome();
  buildWords();
  buildTopics();
  buildGrammar();
  buildStudy();
  buildDrill();
  buildTraps();
  buildStats();
  buildPlan();

  const msg = [
    '构建完成',
    `  词条 ${STATS.total}（单词 ${STATS.words} / 短语 ${STATS.phrases}）`,
    `  频档 核心 ${STATS.core} / 常考 ${STATS.pet} / 拓展 ${STATS.ext}`,
    `  话题 ${TOPIC_SORTED.length}（共 ${STATS.topics}，有词的 ${TOPIC_SORTED.length}）`,
    `  语法 ${GRAMMAR_STATS.sections} 族 / ${GRAMMAR_STATS.topics} 考点 / ${GRAMMAR_STATS.traps} 条易错`,
    `  题目 ${Q_STATS.total}（选择 ${Q_STATS.choice} / 改错 ${Q_STATS.correct} / 填空 ${Q_STATS.fill}）`,
    `  考点覆盖 ${GT_IDS.size - Q_TOPIC_MISS.length}/${GT_IDS.size}`,
    `  耗时 ${Date.now() - t0}ms`,
  ].join('\n');
  console.log(msg);
  if (Q_TOPIC_MISS.length) {
    console.warn('  ⚠ 以下考点还没有题目：', Q_TOPIC_MISS.join(', '));
    process.exitCode = 1;
  }
}

main();
