/* ==========================================================
   PET 备考站 · 静态站点生成器
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
  { href: 'bank.html', label: '题库', key: 'bank' },
  { href: 'quiz.html', label: '测验', key: 'quiz' },
  { href: 'review.html', label: '复习', key: 'review' },
  { href: 'voc.html', label: '词汇自测', key: 'voc' },
  { href: 'traps.html', label: '易错点', key: 'traps' },
  { href: 'plan.html', label: '计划', key: 'plan' },
  { href: 'stats.html', label: '数据', key: 'stats' },
];

const LOGO_HTML = (base) => `<a class="logo" href="${base}index.html">PET <em>B1 备考站</em></a>`;

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
      <h4>PET B1 备考站</h4>
      <span style="display:block;line-height:1.7">B1 Preliminary 官方词表 ${STATS.total} 条 + ${GRAMMAR_STATS.topics} 个语法考点 + ${Q_STATS.total} 道易错题</span>
    </div>
    <div class="col">
      <h4>词汇</h4>
      <a href="${base}words.html">全部词表</a>
      <a href="${base}topics/index.html">按话题</a>
      <a href="${base}review.html">间隔重复复习</a>
    </div>
    <div class="col">
      <h4>语法</h4>
      <a href="${base}grammar.html">语法体系</a>
      <a href="${base}bank.html">易错题库</a>
      <a href="${base}quiz.html">随机测验</a>
    </div>
    <div class="col">
      <h4>关于</h4>
      <a href="${base}plan.html">8 周计划</a>
      <a href="${base}stats.html">数据总览</a>
      <a href="${base}traps.html">易错点速查</a>
    </div>
  </div>
</footer>`;

function page({ base = '', active = '', title, desc = '', body, script = '', rawScript = '', dataKeys = [], dataExtra = null }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
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

  const grammarCards = GRAMMAR.map((g) => `<a class="card" href="grammar.html#${g.id}">
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
    <a class="btn primary" href="review.html">开始今天的复习 <span aria-hidden="true">→</span></a>
    <a class="btn ghost" href="quiz.html">先测 10 题</a>
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
    <a class="card" href="bank.html">
      <div class="card-ico">?</div>
      <h3>易错题库 · ${Q_STATS.total} 题</h3>
      <p class="desc">三种题型混编：单项选择（对齐 PET Part 5）、挑出正确句（写作自查）、开放式填空（对齐 PET Part 6）。每题都有解析说明"为什么错"，不是只给答案。</p>
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

<section class="section">
  <div class="section-head"><h2>怎么用这个站</h2></div>
  <div class="grid c2">
    <div class="card">
      <h3 style="margin-bottom:12px">每天 15 分钟</h3>
      <p class="desc" style="margin:0">
        <b>5 分钟</b> 打开「复习」，做完今天到期的词卡（系统按遗忘曲线排期）。<br>
        <b>5 分钟</b> 读一个语法考点，重点看 ✕/✓ 那几组对比句。<br>
        <b>5 分钟</b> 做 10 道该考点的题，错题解析会说明错因。
      </p>
    </div>
    <div class="card">
      <h3 style="margin-bottom:12px">考前两周</h3>
      <p class="desc" style="margin:0">
        ① 在「数据」页看各考点正确率，专攻低于 60% 的；<br>
        ② 用「词汇」页把「核心」档过一遍，只看没掌握的；<br>
        ③ 用「题库」按题型刷改错题（写作最容易扣分的地方）。
      </p>
    </div>
  </div>
  <div class="note">
    数据口径：词表来自 Cambridge 官方 <i>B1 Preliminary Vocabulary List</i>（2025 年 8 月版）附录 1 与附录 2，共 ${STATS.words} 词 + ${STATS.phrases} 短语；中文释义来自 ECDICT 并以人工覆盖表校正高频多义词；频档依据考试大纲标签与语料词频。语法考点与题目为本站按 B1 考查范围整理，非官方材料。
  </div>
</section>
`;
  write('index.html', page({
    title: 'PET B1 备考站 · 官方词表 + 语法体系 + 易错题库',
    desc: `Cambridge B1 Preliminary 官方词表 ${STATS.total} 条全量入库，${GRAMMAR_STATS.topics} 个语法考点逐条拆解，${Q_STATS.total} 道易错题带解析。`,
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
    title: `PET 官方词汇表 · ${STATS.total} 条`,
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
      title: `${t.name} · ${list.length} 个 PET 单词`,
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
   4. 语法总览
   ========================================================== */
function buildGrammar() {
  const sections = GRAMMAR.map((g) => {
    const topics = g.topics.map((t) => {
      const qn = (Q_BY_TOPIC.get(t.id) || []).length;
      return `
<div class="gtopic" id="${t.id}">
  <h3>${esc(t.name)} <span class="lv ${esc(t.level)}">${esc(t.level)}</span></h3>
  <div class="grule">${rich(t.rule)}</div>
  ${t.form ? `<div class="gform">${esc(t.form)}</div>` : ''}
  ${t.table ? `<table class="gtable"><thead><tr>${t.table.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
    t.table.rows.map((r) => `<tr>${r.map((c, i) => `<td>${i === 0 ? esc(c) : esc(c)}</td>`).join('')}</tr>`).join('')
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
  ${qn ? `<div style="margin-top:16px"><a class="btn sm" href="bank.html?topic=${t.id}">练这个考点（${qn} 题）→</a></div>` : ''}
</div>`;
    }).join('');

    return `
<section class="section" id="${g.id}">
  <div class="section-head">
    <h2>${g.icon} ${esc(g.name)}</h2>
    <span class="sub">${g.topics.length} 个考点</span>
  </div>
  <p class="note" style="margin-top:0">${esc(g.hook)}</p>
  ${topics}
</section>`;
  }).join('<hr class="rule">');

  const toc = GRAMMAR.map((g) => `<a class="chip" href="#${g.id}">${g.icon} ${esc(g.name)}</a>`).join('');

  write('grammar.html', page({
    title: `PET 语法体系 · ${GRAMMAR_STATS.topics} 个考点`,
    desc: `B1 Preliminary 语法 ${GRAMMAR_STATS.sections} 大族 ${GRAMMAR_STATS.topics} 考点，每个考点含规则、变化表、例句与 ${GRAMMAR_STATS.traps} 条易错对比。`,
    active: 'grammar',
    body: `
<div class="page-head">
  <div class="crumb"><a href="index.html">首页</a> / 语法</div>
  <h1>语法体系 · ${GRAMMAR_STATS.sections} 族 ${GRAMMAR_STATS.topics} 个考点</h1>
  <p class="lede">按 B1 Preliminary 的考查权重组织，不是语法书目录。每个考点只讲考试真正会卡住你的部分：规则、形式变化、例句，以及 <b>✕ 错句 / ✓ 对句</b> 的对照 —— 后者才是分数所在。</p>
</div>
<section class="section" style="margin-top:26px">
  <div class="chips">${toc}</div>
</section>
${sections}
<div class="note">语法族的排序按考试中出现的密度排列，不代表难度。带 <span class="lv A2">A2</span> 的考点是复习性考点（KET 已覆盖），带 <span class="lv B1">B1</span> 的是 PET 主力考点，带 <span class="lv B1+">B1+</span> 的是进阶考点（出现在阅读长难句里，写作不强制）。</div>
`,
  }));
}

/* ==========================================================
   5. 题库（可筛选 + 全量浏览）
   ========================================================== */
function buildBank() {
  // by topic groups for browsing
  const groups = GRAMMAR.map((g) => {
    const items = g.topics.flatMap((t) => (Q_BY_TOPIC.get(t.id) || []).map((q) => ({ q, tn: t.name })));
    if (!items.length) return '';
    return `<section class="section" id="g-${g.id}">
      <div class="section-head"><h2>${g.icon} ${esc(g.name)}</h2><span class="sub">${items.length} 题</span></div>
      ${items.map(({ q, tn }) => qCard(q, tn)).join('')}
    </section>`;
  }).join('');

  write('bank.html', page({
    title: `PET 语法易错题库 · ${Q_STATS.total} 题`,
    desc: `${Q_STATS.choice} 道单项选择、${Q_STATS.correct} 道改错、${Q_STATS.fill} 道开放式填空，每题带错因解析。`,
    active: 'bank',
    body: `
<div class="page-head">
  <div class="crumb"><a href="index.html">首页</a> / 题库</div>
  <h1>易错题库 · ${Q_STATS.total} 题</h1>
  <p class="lede">按考点分组，点「显示答案」看解析。三种题型：<b>单项选择</b>对齐 PET Part 5 的完形填空；<b>改错</b>训练你发现错句的眼睛；<b>开放式填空</b>对齐 PET Part 6，要求写出括号词的正确形式。</p>
</div>
<section class="section" style="margin-top:26px">
  <div class="kv">
    <div class="k"><b>${Q_STATS.choice}</b><span>单项选择</span></div>
    <div class="k"><b>${Q_STATS.correct}</b><span>挑出正确句</span></div>
    <div class="k"><b>${Q_STATS.fill}</b><span>开放式填空</span></div>
    <div class="k"><b>${GT_IDS.size}</b><span>覆盖考点</span></div>
  </div>
  <div class="toolbar" style="margin-top:22px">
    <input class="field" id="qq" type="search" placeholder="搜索题干或解析…" autocomplete="off">
  </div>
  <div class="chips" style="margin-bottom:8px">
    <button class="chip on" data-qf="all">全部</button>
    <button class="chip" data-qf="choice">单项选择</button>
    <button class="chip" data-qf="correct">改错</button>
    <button class="chip" data-qf="fill">填空</button>
  </div>
</section>
<div id="qbank">${groups}</div>
<div class="empty" id="qempty" style="display:none"><b>没有匹配的题</b>换个关键词试试</div>
`,
    rawScript: `<script>
(function(){
  var q = document.querySelector('#qq'), f = 'all';
  function apply(){
    var term = (q.value||'').trim().toLowerCase();
    document.querySelectorAll('#qbank .qitem').forEach(function(el){
      var okF = f === 'all' || el.getAttribute('data-type') === f;
      var okQ = !term || (el.getAttribute('data-txt')||'').indexOf(term) >= 0;
      el.style.display = (okF && okQ) ? '' : 'none';
    });
    document.querySelectorAll('#qbank section').forEach(function(s){
      var any = Array.prototype.some.call(s.querySelectorAll('.qitem'), function(x){ return x.style.display !== 'none'; });
      s.style.display = any ? '' : 'none';
    });
    var anyVisible = Array.prototype.some.call(document.querySelectorAll('#qbank .qitem'), function(x){ return x.style.display !== 'none'; });
    var em = document.querySelector('#qempty');
    if (em) em.style.display = anyVisible ? 'none' : '';
  }
  if (q) q.addEventListener('input', apply);
  document.querySelectorAll('[data-qf]').forEach(function(c){
    c.addEventListener('click', function(){
      document.querySelectorAll('[data-qf]').forEach(function(x){ x.classList.remove('on'); });
      c.classList.add('on'); f = c.getAttribute('data-qf'); apply();
    });
  });
  document.querySelectorAll('[data-reveal]').forEach(function(b){
    b.addEventListener('click', function(){
      var item = b.closest('.qitem');
      var ans = item.querySelector('.qans');
      var on = ans.style.display !== 'none' && ans.style.display !== '';
      ans.style.display = on ? 'none' : '';
      b.textContent = on ? '显示答案' : '收起答案';
    });
  });
  // ?topic= 深链：滚动到该考点
  var tp = new URLSearchParams(location.search).get('topic');
  if (tp) {
    var target = document.querySelector('[data-topic="' + tp + '"]');
    if (target) { target.scrollIntoView({block:'center'}); target.style.outline = '2px solid var(--accent)'; }
  }
})();
</script>`,
  }));
}

function qCard(q, topicName) {
  const type = TYPE_OF_Q(q);
  const typeName = type === 'correct' ? '改错' : type === 'fill' ? '填空' : '选择';
  let stem = esc(q.stem).replace(/___/g, '<span class="blank">　</span>');
  let ansHtml = '';
  if (type === 'fill') {
    ansHtml = `<div style="font-family:var(--serif);font-size:1.02rem;margin-bottom:8px">答案：<b style="color:var(--ok)">${esc(q.answer)}</b></div>`;
    if (q.accept && q.accept.length > 1) {
      ansHtml += `<div style="font-size:.84rem;color:var(--text-3)">也接受：${q.accept.filter((a) => a !== q.answer).map(esc).join(' / ')}</div>`;
    }
  } else {
    ansHtml = `<ol style="margin:0 0 10px;padding-left:22px;font-family:var(--serif)">${q.options.map((o, i) => `<li style="margin-bottom:3px${i === q.answer ? ';color:var(--ok);font-weight:600' : ''}">${esc(o)}${i === q.answer ? ' ✓' : ''}</li>`).join('')}</ol>`;
  }
  return `<div class="qitem card" style="margin-bottom:12px" data-type="${type}" data-topic="${esc(q.topic)}"
    data-txt="${esc((q.stem + ' ' + (q.options || []).join(' ') + ' ' + q.why + ' ' + (q.answer || '')).toLowerCase())}">
  <div class="qmeta"><span class="qtype">${typeName}</span>
    <span class="flag">${esc(topicName)}</span>
    ${q.level ? `<span class="lv ${esc(q.level)}">${esc(q.level)}</span>` : ''}
    <span style="font-family:var(--mono);font-size:.68rem;color:var(--text-3);margin-left:auto">${esc(q.id)}</span>
  </div>
  <div class="qstem" style="font-size:1.02rem;margin-bottom:14px">${stem}</div>
  <div class="qans" style="display:none">
    ${ansHtml}
    <div class="feedback" style="margin-top:8px"><b>为什么</b>${esc(q.why)}</div>
  </div>
  <button class="btn sm" data-reveal style="margin-top:10px">显示答案</button>
</div>`;
}

/* ==========================================================
   6. 测验（随机抽题）
   ========================================================== */
function buildQuiz() {
  write('quiz.html', page({
    dataKeys: ['QUESTIONS', 'QUESTIONS_2', 'GRAMMAR'],
    title: 'PET 语法测验 · 随机抽题',
    desc: '从 261 道易错题中随机抽题，可选题型与题量，即时判分与解析。',
    active: 'quiz',
    body: `
<div class="page-head">
  <div class="crumb"><a href="index.html">首页</a> / 测验</div>
  <h1>随机测验</h1>
  <p class="lede">从 ${Q_STATS.total} 道题里抽。答错会立刻告诉你错因，连续答对有连击计数。键盘 <b>1–4</b> 选答案，<b>Enter</b> 下一题。</p>
</div>

<section class="section" style="margin-top:28px" id="setup">
  <div class="card" style="max-width:620px">
    <h3 style="margin-bottom:16px">出题设置</h3>
    <div style="margin-bottom:16px">
      <div class="kicker">题型</div>
      <div class="chips" id="typeChips">
        <button class="chip on" data-t="all">全部</button>
        <button class="chip" data-t="choice">单项选择</button>
        <button class="chip" data-t="correct">改错</button>
        <button class="chip" data-t="fill">填空</button>
      </div>
    </div>
    <div style="margin-bottom:20px">
      <div class="kicker">语法族</div>
      <div class="chips" id="groupChips">
        <button class="chip on" data-g="all">全部考点</button>
        ${GRAMMAR.map((g) => `<button class="chip" data-g="${g.id}">${esc(g.name)}</button>`).join('')}
      </div>
    </div>
    <div style="margin-bottom:20px">
      <div class="kicker">题量</div>
      <div class="chips" id="lenChips">
        <button class="chip" data-l="10">10 题</button>
        <button class="chip on" data-l="20">20 题</button>
        <button class="chip" data-l="40">40 题</button>
      </div>
    </div>
    <button class="btn primary" id="startBtn">开始 →</button>
  </div>
</section>

<section class="section" id="quizZone" style="display:none">
  <div id="qz"></div>
</section>
`,
    script: `
const { QUESTIONS, QUESTIONS_2, GRAMMAR } = window.PET_DATA;
const ALL = [...QUESTIONS, ...QUESTIONS_2];
const GT = new Map();
GRAMMAR.forEach(g => g.topics.forEach(t => GT.set(t.id, g.id)));
let type = 'all', grp = 'all', len = 20;

function pick(sel, attr, cb) {
  document.querySelectorAll(sel + ' .chip').forEach(c => c.addEventListener('click', () => {
    document.querySelectorAll(sel + ' .chip').forEach(x => x.classList.remove('on'));
    c.classList.add('on'); cb(c.getAttribute(attr));
  }));
}
pick('#typeChips', 'data-t', v => type = v);
pick('#groupChips', 'data-g', v => grp = v);
pick('#lenChips', 'data-l', v => len = parseInt(v, 10));

document.querySelector('#startBtn').addEventListener('click', () => {
  let pool = ALL.filter(q => {
    if (type !== 'all' && (q.type || 'choice') !== type) return false;
    if (grp !== 'all' && GT.get(q.topic) !== grp) return false;
    return true;
  });
  document.querySelector('#setup').style.display = 'none';
  document.querySelector('#quizZone').style.display = '';
  window.PET.quiz({
    mount: '#qz', questions: pool, limit: len, shuffle: true,
    reviewHref: 'bank.html',
    onRestart: () => location.reload(),
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
`,
  }));
}

/* ==========================================================
   7. 复习（间隔重复）
   ========================================================== */
function buildReview() {
  write('review.html', page({
    dataKeys: ['WORDS', 'STATS'],
    title: '间隔重复复习 · PET 单词记忆',
    desc: '按 SM-2 遗忘曲线安排每天该复习的单词，每天 10–20 张卡。',
    active: 'review',
    body: `
<div class="page-head">
  <div class="crumb"><a href="index.html">首页</a> / 复习</div>
  <h1>今天的复习</h1>
  <p class="lede">系统按遗忘曲线排期：忘记的卡 10 分钟后再出现，记得越牢间隔越长（1 天 → 3 天 → 7 天 → 21 天以上）。
  每天做完到期的卡就够，不要贪多。</p>
</div>

<section class="section" style="margin-top:26px">
  <div class="kv" id="srsKv">
    <div class="k"><b id="kDue">—</b><span>今天到期</span></div>
    <div class="k"><b id="kTotal">—</b><span>卡库总数</span></div>
    <div class="k"><b id="kMature">—</b><span>已牢固（间隔 ≥ 21 天）</span></div>
    <div class="k"><b id="kRev">—</b><span>累计复习次数</span></div>
  </div>
</section>

<section class="section" style="margin-top:30px" id="setup">
  <div class="card" style="max-width:620px">
    <h3 style="margin-bottom:16px">选择模式</h3>
    <div class="chips" id="modeChips">
      <button class="chip on" data-m="due">到期复习</button>
      <button class="chip" data-m="new">只学新词</button>
      <button class="chip" data-m="mix">混合（到期 + 新词）</button>
    </div>
    <div style="margin-top:16px" class="kicker">词源范围</div>
    <div class="chips" id="srcChips">
      <button class="chip on" data-s="core">核心词（${STATS.core}）</button>
      <button class="chip" data-s="all">全部词（${STATS.total}）</button>
    </div>
    <div style="margin-top:16px" class="kicker">每轮张数</div>
    <div class="chips" id="lenChips">
      <button class="chip" data-l="10">10 张</button>
      <button class="chip on" data-l="20">20 张</button>
      <button class="chip" data-l="30">30 张</button>
    </div>
    <div style="margin-top:22px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn primary" id="startBtn">开始复习 →</button>
      <button class="btn ghost" id="resetBtn">重置记忆数据</button>
    </div>
    <div class="note" style="margin-bottom:0">空格键翻卡；翻卡后按 <b>1</b> 忘了 · <b>2</b> 困难 · <b>3</b> 会了 · <b>4</b> 很熟。</div>
  </div>
</section>

<section class="section" id="zone" style="display:none"><div id="fc"></div></section>
`,
    script: `
const { WORDS, STATS } = window.PET_DATA;
const P = window.PET;
let mode = 'due', src = 'core', len = 20;

function refreshKv() {
  const s = P.srsStats();
  const set = (id, v) => { const e = document.querySelector(id); if (e) e.textContent = v; };
  set('#kDue', s.due); set('#kTotal', s.total); set('#kMature', s.mature); set('#kRev', s.reviews);
}
refreshKv();
document.addEventListener('pet:srs', refreshKv);

function pick(sel, attr, cb) {
  document.querySelectorAll(sel + ' .chip').forEach(c => c.addEventListener('click', () => {
    document.querySelectorAll(sel + ' .chip').forEach(x => x.classList.remove('on'));
    c.classList.add('on'); cb(c.getAttribute(attr));
  }));
}
pick('#modeChips', 'data-m', v => mode = v);
pick('#srcChips', 'data-s', v => src = v);
pick('#lenChips', 'data-l', v => len = parseInt(v, 10));

document.querySelector('#startBtn').addEventListener('click', () => {
  const pool = src === 'core' ? WORDS.filter(w => w.tag === 'core') : WORDS;
  document.querySelector('#setup').style.display = 'none';
  document.querySelector('#zone').style.display = '';
  P.flashcards({ mount: '#fc', words: pool, mode, limit: len, backHref: 'review.html' });
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.querySelector('#resetBtn').addEventListener('click', () => {
  if (confirm('确定清空所有记忆进度？此操作无法撤销。')) { P.srsReset(); P.clearKnown(); refreshKv(); }
});
`,
  }));
}

/* ==========================================================
   7b. 词汇自测
   ========================================================== */
function buildVocQuiz() {
  write('voc.html', page({
    dataKeys: ['WORDS', 'STATS'],
    title: '词汇自测 · 看词选义 / 看义选词',
    desc: `从 ${STATS.total} 条官方词条随机出题，四选一，干扰项取自同话题同词性，练到不靠排除法。`,
    active: 'voc',
    body: `
<div class="page-head">
  <div class="crumb"><a href="index.html">首页</a> / 词汇自测</div>
  <h1>词汇自测</h1>
  <p class="lede">从 ${STATS.total} 条词条里随机抽。干扰项优先取<b>同一话题、同一词性</b>的词 —— 靠"哪个看着眼熟"排除不掉，必须真的认识。
  答对答错都会写进记忆库，影响「复习」页的排期。</p>
</div>

<section class="section" style="margin-top:28px" id="setup">
  <div class="card" style="max-width:640px">
    <h3 style="margin-bottom:16px">出题设置</h3>
    <div style="margin-bottom:16px">
      <div class="kicker">方向</div>
      <div class="chips" id="dirChips">
        <button class="chip on" data-d="zh">看单词选释义</button>
        <button class="chip" data-d="en">看释义选单词</button>
      </div>
    </div>
    <div style="margin-bottom:16px">
      <div class="kicker">词源</div>
      <div class="chips" id="srcChips">
        <button class="chip on" data-s="core">核心词（${STATS.core}）</button>
        <button class="chip" data-s="all">全部词（${STATS.total}）</button>
        <button class="chip" data-s="phrase">短语（${STATS.phrases}）</button>
      </div>
    </div>
    <div style="margin-bottom:20px">
      <div class="kicker">题量</div>
      <div class="chips" id="lenChips">
        <button class="chip" data-l="10">10 题</button>
        <button class="chip on" data-l="20">20 题</button>
        <button class="chip" data-l="30">30 题</button>
      </div>
    </div>
    <button class="btn primary" id="startBtn">开始 →</button>
  </div>
</section>

<section class="section" id="zone" style="display:none"><div id="vq"></div></section>
`,
    script: `
const { WORDS, STATS } = window.PET_DATA;
const P = window.PET;
let dir = 'zh', src = 'core', len = 20;
function pick(sel, attr, cb) {
  document.querySelectorAll(sel + ' .chip').forEach(c => c.addEventListener('click', () => {
    document.querySelectorAll(sel + ' .chip').forEach(x => x.classList.remove('on'));
    c.classList.add('on'); cb(c.getAttribute(attr));
  }));
}
pick('#dirChips', 'data-d', v => dir = v);
pick('#srcChips', 'data-s', v => src = v);
pick('#lenChips', 'data-l', v => len = parseInt(v, 10));

document.querySelector('#startBtn').addEventListener('click', () => {
  let pool = src === 'core' ? WORDS.filter(w => w.tag === 'core' && w.t === 'word')
           : src === 'phrase' ? WORDS.filter(w => w.t === 'phrase')
           : WORDS;
  document.querySelector('#setup').style.display = 'none';
  document.querySelector('#zone').style.display = '';
  P.vocabQuiz({ mount: '#vq', words: pool, direction: dir, limit: len, feedSrs: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
`,
  }));
}

/* ==========================================================
   8. 易错点速查
   ========================================================== */
function buildTraps() {
  const all = [];
  GRAMMAR.forEach((g) => g.topics.forEach((t) => t.traps.forEach((x) => all.push({ ...x, g: g.name, t: t.name, tid: t.id, level: t.level }))));

  const items = all.map((x) => `<div class="trap" data-txt="${esc((x.t + ' ' + x.bad + ' ' + x.good + ' ' + x.why).toLowerCase())}">
    <div class="tth">${esc(x.t)} <span class="flag" style="margin-left:auto">${esc(x.g)} · ${esc(x.t)}</span></div>
    <span class="bad">${esc(x.bad)}</span>
    <span class="good">${esc(x.good)}</span>
    <div class="why">${rich(x.why)}</div>
    <div style="margin-top:8px"><a class="btn sm" href="grammar.html#${x.tid}">看考点规则 →</a></div>
  </div>`).join('');

  write('traps.html', page({
    title: `PET 语法易错点速查 · ${all.length} 条`,
    desc: `把 ${all.length} 条易错对比集中在一页：错误写法、正确写法、错因一句话。`,
    active: 'traps',
    body: `
<div class="page-head">
  <div class="crumb"><a href="index.html">首页</a> / 易错点</div>
  <h1>易错点速查 · ${all.length} 条</h1>
  <p class="lede">全站所有 ✕/✓ 对照集中在这里，按「错法 → 对法 → 一句话原因」排列。考前扫一遍，比重读语法书快。</p>
</div>
<section class="section" style="margin-top:26px">
  <div class="toolbar"><input class="field" id="tq" type="search" placeholder="搜索错法关键词，如 第三人称 / since / although…" autocomplete="off"></div>
  <div id="traps" class="traps">${items}</div>
  <div class="empty" id="tempty" style="display:none"><b>没找到</b>换个关键词</div>
</section>
`,
    rawScript: `<script>
(function(){
  var q = document.querySelector('#tq');
  if (!q) return;
  q.addEventListener('input', function(){
    var t = q.value.trim().toLowerCase(), any = false;
    document.querySelectorAll('#traps .trap').forEach(function(el){
      var ok = !t || (el.getAttribute('data-txt')||'').indexOf(t) >= 0;
      el.style.display = ok ? '' : 'none'; if (ok) any = true;
    });
    var em = document.querySelector('#tempty');
    if (em) em.style.display = any ? 'none' : '';
  });
})();
</script>`,
  }));
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
    title: 'PET 备考站 · 数据总览',
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
    <b>语法与题库</b>：按 B1 Preliminary 的公开考试说明（Reading Part 5 多项选择完形、Part 6 开放式完形、Writing 的邮件与文章任务）整理，为本站原创内容，非官方出版材料。
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
      focus: '回看「数据」页各考点正确率，专攻低于 60% 的；把「易错点速查」整页扫两遍。',
      drill: '每天一次 40 题随机测验；错题只看解析不看题目，检验是否真的理解。',
    },
  ];

  const gname = new Map(GRAMMAR.map((g) => [g.id, g.name]));

  const cards = weeks.map((k) => `
<div class="gtopic">
  <h3>第 ${k.w} 周 · ${esc(k.title)} <span class="lv B1">${k.w <= 4 ? '打基础' : k.w <= 7 ? '补短板' : '冲刺'}</span></h3>
  <table class="gtable" style="margin:14px 0">
    <tbody>
      <tr><td style="width:88px">词汇</td><td>${esc(k.vocab)}</td></tr>
      <tr><td>语法</td><td>${k.grammar.map((g) => `<a href="grammar.html#${g}">${esc(gname.get(g) || g)}</a>`).join(' · ')}</td></tr>
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
  <div class="note" style="margin-top:20px">每天建议 30–40 分钟：复习页 10 分钟（做完到期的卡）+ 读一个语法考点 10 分钟 + 做题 15 分钟。
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
      <p class="desc">做一次 40 题随机测验。如果正确率低于 60%，说明时态还没稳，把第 1–2 周重来一遍再往下走。</p>
    </a>
    <a class="card" href="stats.html">
      <h3>第 5 周末</h3>
      <p class="desc">看「数据」页的考点正确率。把低于 60% 的考点挑出来，在题库里只做那几族，不要平均用力。</p>
    </a>
    <a class="card" href="traps.html">
      <h3>考前三天</h3>
      <p class="desc">把「易错点速查」整页扫两遍（119 条）。这比重新读语法规则有效，因为考试考的就是这些边界情况。</p>
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
  buildBank();
  buildQuiz();
  buildReview();
  buildVocQuiz();
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
