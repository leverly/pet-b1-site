/* ==========================================================
   PET 领航 · 剑桥 B1 官方备考系统 · 静态站点生成器 v2
   用法：node build-site.mjs
   输出：根目录 index.html + topics/ grammar/ 等
   ========================================================== */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WORDS, TOPICS, STATS } from './src/data-words.js';
let AUDIO = {};
try {
  ({ AUDIO } = await import('./src/data-audio.js'));
} catch (e) {
  AUDIO = {};
}
import { GRAMMAR, GRAMMAR_STATS } from './src/data-grammar.js';
import { QUESTIONS } from './src/data-quiz.js';
import { QUESTIONS_2 } from './src/data-quiz2.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = __dir;

const assetHash = (rel) => createHash('sha256').update(readFileSync(join(__dir, rel))).digest('hex').slice(0, 8);
const CSS_VER = assetHash('assets/style.css');
const JS_VER = assetHash('assets/app.js');

const ALL_Q = [...QUESTIONS, ...QUESTIONS_2];

/* ---------------- 派生数据 ---------------- */
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

/* ---------------- 数据内联 ---------------- */
const __inlineCache = new Map();

function inlineData(keys, extra) {
  const ALL = {
    WORDS, TOPICS, STATS, GRAMMAR, GRAMMAR_STATS, QUESTIONS, QUESTIONS_2,
  };
  const extraKeys = Object.keys(extra || {});
  const extraSig = extraKeys.length
    ? '|' + extraKeys.map((k) => k + ':' + JSON.stringify(extra[k]).length + ':' + JSON.stringify(extra[k]).slice(0, 48)).join(',')
    : '';
  const id = keys.join(',') + extraSig;
  if (__inlineCache.has(id)) return __inlineCache.get(id);
  const body = keys.map((k) => {
    if (!(k in ALL)) throw new Error('inlineData: unknown key ' + k);
    return `window.PET_DATA.${k}=${JSON.stringify(ALL[k])};`;
  }).concat(extraKeys.map((k) => `window.PET_DATA.${k}=${JSON.stringify(extra[k])};`)).join('\n');
  const out = `<script>window.PET_DATA=window.PET_DATA||{};\n${body}</scr` + `ipt>`;
  __inlineCache.set(id, out);
  return out;
}

/* ---------------- 工具 ---------------- */
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

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

/* ---------------- 导航 & 品牌 ---------------- */
const SITE_NAME = 'PET 领航';

const NAV = [
  { href: 'index.html', label: '首页', key: 'home' },
  { href: 'quiz.html', label: '背单词', key: 'words-study' },
  { href: 'review.html', label: '练语法', key: 'grammar-drill' },
  { href: 'words.html', label: '词库', key: 'words' },
  { href: 'grammar.html', label: '语法', key: 'grammar' },
  { href: 'wrong.html', label: '错题本', key: 'wrong' },
  { href: 'plan.html', label: '8周计划', key: 'plan' },
  { href: 'stats.html', label: '学习数据', key: 'stats' },
  { href: 'content.html', label: '内容说明', key: 'content' },
];

const LOGO_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`;

const LOGO_HTML = (base) => `<a class="logo" href="${base}index.html">
  <span class="logo-mark">${LOGO_SVG}</span>
  <span>PET 领航</span>
  <span class="logo-badge">B1</span>
</a>`;

const HEADER = (base, active) => `<div class="scroll-progress"></div>
<header class="hdr">
  <div class="hdr-in">
    ${LOGO_HTML(base)}
    <nav class="hdr-nav">
      ${NAV.map((n) => `<a href="${base}${n.href}"${n.key === active ? ' class="on"' : ''}>${n.label}</a>`).join('')}
    </nav>
    <div class="hdr-tools">
      <button class="theme-btn" aria-label="切换主题">☾</button>
      <button class="menu-btn" aria-label="菜单" aria-expanded="false">☰</button>
    </div>
  </div>
</header>`;

const FOOTER = (base) => `<footer class="foot">
  <div class="foot-in">
    <div class="col">
      <div class="logo" style="margin-bottom:10px">
        <span class="logo-mark">${LOGO_SVG}</span>
        <span>PET 领航</span>
        <span class="logo-badge">B1</span>
      </div>
      <p style="line-height:1.7;margin:0;color:var(--text-2)">面向中小学生的剑桥 B1 Preliminary (PET for Schools) 系统备考站。官方 ${STATS.total} 词全配英音、${GRAMMAR_STATS.topics} 个语法考点、${Q_STATS.total} 道真题式精练与 8 周打卡计划。</p>
    </div>
    <div class="col">
      <h4>每日备考</h4>
      <a href="${base}quiz.html">听音背单词</a>
      <a href="${base}review.html">真题练语法</a>
      <a href="${base}wrong.html">智能错题本</a>
      <a href="${base}plan.html">8 周通关计划</a>
    </div>
    <div class="col">
      <h4>官方体系</h4>
      <a href="${base}words.html">3,109 官方词表</a>
      <a href="${base}topics/index.html">23 个剑桥话题</a>
      <a href="${base}grammar.html">12 大语法族</a>
    </div>
    <div class="col">
      <h4>数据与帮助</h4>
      <a href="${base}stats.html">学习数据与备份</a>
      <a href="${base}content.html">内容与数据说明</a>
      <a href="${base}index.html#faq">常见问题</a>
    </div>
  </div>
  <div class="foot-bottom">
    <span>PET 领航 · 剑桥 B1 Preliminary 官方大纲备考系统</span>
    <span>词表源自 Cambridge B1 Preliminary Vocabulary List (2025) · 离线与在线均可顺畅使用</span>
  </div>
</footer>`;

function page({ base = '', active = '', title, desc = '', body, script = '', rawScript = '', dataKeys = [], dataExtra = null }) {
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
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%232563eb'/%3E%3Cstop offset='1' stop-color='%234f46e5'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='32' height='32' rx='9' fill='url(%23g)'/%3E%3Ctext x='16' y='22' font-family='system-ui,sans-serif' font-size='16' font-weight='800' fill='%23fff' text-anchor='middle'%3EP%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="${base}assets/style.css?v=${CSS_VER}">
<script>try{var m=JSON.parse(localStorage.getItem('pet-theme-manual')||'null');var h=new Date().getHours();var t=(m==='light'||m==='dark')?m:((h>=19||h<6)?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){var h2=new Date().getHours();document.documentElement.setAttribute('data-theme',(h2>=19||h2<6)?'dark':'light');}</script>
</head>
<body data-base="${base}">
${HEADER(base, active)}
<main class="main">
<div class="wrap">
${body}
</div>
</main>
${FOOTER(base)}
<script src="${base}assets/app.js?v=${JS_VER}"></script>
${script ? `${inlineData(dataKeys, dataExtra)}<script>${script}</script>` : ''}
${rawScript}
</body>
</html>`;
}

/* ==========================================================
   1. 首页（商业落地页 + 今日学习驾驶舱）
   ========================================================== */
function buildHome() {
  const topicCards = TOPIC_SORTED.slice(0, 6).map((t) => `<a class="card" href="topics/${t.id}.html">
    <div class="card-ico">${t.icon}</div>
    <h3>${esc(t.name)}</h3>
    <div class="meta">${t.n} 个官方词条 · ${esc(t.official)}</div>
  </a>`).join('');

  const grammarCards = GRAMMAR.slice(0, 6).map((g) => `<a class="card" href="grammar/${g.id}.html">
    <div class="card-ico purple">${g.icon}</div>
    <h3>${esc(g.name)}</h3>
    <div class="meta">${g.topics.length} 个必考语法点 · ${g.topics.reduce((s, t) => s + t.traps.length, 0)} 条易错避坑</div>
  </a>`).join('');

  const body = `
<section class="hero">
  <div class="hero-split">
    <div>
      <div class="hero-badge"><span class="dot-live"></span>对齐 Cambridge B1 Preliminary (PET for Schools) 2025 官方考纲</div>
      <h1>8 周系统拿下剑桥 PET，<br><span class="accent-word">词汇 · 语法 · 刷题</span>一站通关</h1>
      <p class="lede">
 专为 3–9 年级中小学生打造的 PET 科学备考系统：<b>${STATS.total.toLocaleString('en-US')} 个官方词条全配纯正英音</b>，
 <b>${GRAMMAR_STATS.topics} 个语法考点配中式易错避坑</b>，<b>${Q_STATS.total} 道真题式精练</b>。
 每天 20 分钟跟着艾宾浩斯遗忘曲线闯关，进步看得见，家长省心更放心。
 </p>
      <div class="hero-cta">
        <a class="btn primary" href="quiz.html">开始背单词 <span aria-hidden="true">→</span></a>
        <a class="btn" href="review.html">真题练语法</a>
        <a class="btn ghost" href="plan.html">看 8 周计划</a>
      </div>
      <div class="hero-trust">
        <span><b>✓</b> 2025 剑桥官方全量词表</span>
        <span><b>✓</b> 100% 纯正英音朗读</span>
        <span><b>✓</b> 离线可用 · 支持档案备份</span>
      </div>
    </div>

    <div class="cockpit-card" id="today">
      <div class="cockpit-top">
        <span class="level-pill" id="cLevel">🏅 Lv.1 剑桥萌新 · 0 XP</span>
        <button class="countdown-pill" data-open-exam="1" id="cCountdown">📅 <span>设置 PET 考试倒计时</span></button>
      </div>
      <div class="cockpit-metrics">
        <div class="streak-box">
          <b id="tStreak">0</b>
          <span id="tStreakLabel">天连学</span>
        </div>
        <div class="today-goal">
          <div class="today-goal-row">
            <span>今日词汇闯关 <b id="tWords">0</b> / <b id="tGoal">20</b> 词</span>
            <span class="today-pct" id="tPct">0%</span>
          </div>
          <div class="bar"><i id="tBar" style="width:0%"></i></div>
          <div class="cockpit-sub">
            <span id="cTarget">目标：Merit 优秀 (153+)</span>
            <a href="stats.html" style="font-weight:600">查看学习数据 →</a>
          </div>
        </div>
      </div>
      <div class="mission-list">
        <a class="mission-item" href="quiz.html">
          <span class="mi-ico blue">🎧</span>
          <span class="mi-main"><b>第一步：听音闯关背单词</b><small id="ttWords">按遗忘曲线先过高频词，每词纯正英音朗读</small></span>
          <span class="mi-go">开始 →</span>
        </a>
        <a class="mission-item" href="review.html">
          <span class="mi-ico purple">⚡</span>
          <span class="mi-main"><b>第二步：真题题型练语法</b><small id="ttGrammar">每天 10–20 题，专攻正确率低的薄弱考点</small></span>
          <span class="mi-go">去练 →</span>
        </a>
        <a class="mission-item" href="wrong.html">
          <span class="mi-ico rose">🎯</span>
          <span class="mi-main"><b>第三步：清空今日错题本</b><small id="ttWrong">自动收纳错词错题，支持一键打印复习纸</small></span>
          <span class="mi-go">查看 →</span>
        </a>
      </div>
    </div>
  </div>

  <div class="stats reveal">
    <div class="stat"><b data-count="${STATS.words}">${STATS.words}</b><span>官方单词</span><small>100% 附英音朗读</small></div>
    <div class="stat"><b data-count="${STATS.phrases}">${STATS.phrases}</b><span>高频短语</span><small>完形与写作提分点</small></div>
    <div class="stat"><b data-count="${GRAMMAR_STATS.topics}">${GRAMMAR_STATS.topics}</b><span>核心语法考点</span><small>覆盖 A2/B1/B1+</small></div>
    <div class="stat"><b data-count="${GRAMMAR_STATS.traps}">${GRAMMAR_STATS.traps}</b><span>中式易错避坑</span><small>✕ 错句 vs ✓ 对句</small></div>
    <div class="stat"><b data-count="${Q_STATS.total}">${Q_STATS.total}</b><span>真题式精练</span><small>单选 · 改错 · 填空</small></div>
  </div>
</section>

<section class="section reveal">
  <div class="section-head">
    <div class="section-head-left">
      <span class="kicker">科学提分闭环</span>
      <h2>为什么每天 20 分钟，8 周就能稳过 PET？</h2>
      <span class="sub">拒绝盲目刷题和死记硬背，把备考拆成孩子能坚持、家长看得见的 4 步工程</span>
    </div>
  </div>
  <div class="grid c4">
    <div class="card step-card">
      <span class="step-num">STEP 01</span>
      <h3>按词频分级 + 听音抗遗忘</h3>
      <p class="desc">先拿下最常考的 ${STATS.b1} 个核心高频词，再攻克中低频。SM-2 遗忘曲线自动排期，答错 10 分钟复现，告别“背了又忘”。</p>
    </div>
    <div class="card step-card">
      <span class="step-num">STEP 02</span>
      <h3>直击中国孩子常踩语法坑</h3>
      <p class="desc">不照搬枯燥语法书，把 ${GRAMMAR_STATS.topics} 个考点提炼成公式表 + ${GRAMMAR_STATS.traps} 组红绿对比错句，睡前 3 分钟就能看懂避坑。</p>
    </div>
    <div class="card step-card">
      <span class="step-num">STEP 03</span>
      <h3>对齐真考 Part 5 / 6 精练</h3>
      <p class="desc">单项选择、写作改错、开放填空三种题型混编，每题即时给解析，自动定位正确率最低的薄弱考点集中突破。</p>
    </div>
    <div class="card step-card">
      <span class="step-num">STEP 04</span>
      <h3>错题闭环 + 打印复习纸</h3>
      <p class="desc">错词需连对 2 次才移出错题本，支持一键打印 A4 错题纸；所有学习记录本地保存，支持随时导出备份。</p>
    </div>
  </div>
</section>

<section class="section reveal">
  <div class="section-head">
    <div class="section-head-left">
      <span class="kicker">核心学习模块</span>
      <h2>词库、语法、刷题三线联动</h2>
      <span class="sub">每一项都严格紧扣剑桥 B1 Preliminary 官方大纲</span>
    </div>
  </div>
  <div class="grid c3">
    <a class="card" href="words.html">
      <div class="card-ico">📚</div>
      <h3>全量官方词表 · ${STATS.total} 条</h3>
      <p class="desc">完整收录 Cambridge B1 Preliminary 2025 官方词表，含音标、词性、精准中文释义、官方例句与纯正英音点击即读。</p>
      <div class="meta" style="margin-top:12px">核心高频 ${STATS.b1} · 中频主力 ${STATS.b2} · 拓展 ${STATS.b3}</div>
    </a>
    <a class="card" href="grammar.html">
      <div class="card-ico purple">📐</div>
      <h3>系统语法体系 · ${GRAMMAR_STATS.sections} 族 ${GRAMMAR_STATS.topics} 考点</h3>
      <p class="desc">从时态、被动、非谓语到三大从句与语篇衔接，按 PET 考查权重排序，每个考点都可一键跳转专项刷题。</p>
      <div class="meta" style="margin-top:12px">${GRAMMAR_STATS.traps} 条易错对比 · ${GRAMMAR_STATS.examples} 个精选例句</div>
    </a>
    <a class="card" href="review.html">
      <div class="card-ico ok">✍️</div>
      <h3>考点专项刷题 · ${Q_STATS.total} 题</h3>
      <p class="desc">全面覆盖全部 ${GRAMMAR_STATS.topics} 个语法考点，自动统计各考点正确率，支持「专攻最弱考点」与「只练错题本」。</p>
      <div class="meta" style="margin-top:12px">单选 ${Q_STATS.choice} · 改错 ${Q_STATS.correct} · 填空 ${Q_STATS.fill}</div>
    </a>
  </div>
</section>

<section class="section reveal">
  <div class="section-head">
    <div class="section-head-left">
      <span class="kicker">高频场景词库</span>
      <h2>按 23 个剑桥官方话题成组记词</h2>
      <span class="sub">阅读和写作总是围绕同一主题出词，按话题记效率翻倍</span>
    </div>
    <a class="btn sm soft" href="topics/index.html">查看全部 ${TOPIC_SORTED.length} 个话题 →</a>
  </div>
  <div class="grid c3">${topicCards}</div>
</section>

<section class="section reveal">
  <div class="section-head">
    <div class="section-head-left">
      <span class="kicker">语法避坑图谱</span>
      <h2>按 ${GRAMMAR_STATS.sections} 大语法族逐个击破</h2>
      <span class="sub">直击完形填空与写作丢分重灾区</span>
    </div>
    <a class="btn sm soft" href="grammar.html">进入完整语法体系 →</a>
  </div>
  <div class="grid c3">${grammarCards}</div>
</section>

<section class="section reveal" id="faq">
  <div class="section-head">
    <div class="section-head-left">
      <span class="kicker">常见问题</span>
      <h2>关于 PET 备考与使用，你可能想了解</h2>
    </div>
  </div>
  <div class="faq-list">
    <details class="faq-item" open>
      <summary>这套系统适合几年级的孩子？刚考完 KET 能直接用吗？</summary>
      <p>非常适合小学 3–6 年级及初中 7–8 年级正在备考剑桥 PET（B1 Preliminary for Schools）的学生。刚通过 KET 的孩子可以从「核心高频 907 词」和标注为 <b>A2 巩固</b> 的语法考点起步，平滑过渡到 B1 主力考点。</p>
    </details>
    <details class="faq-item">
      <summary>孩子平时学校作业多，每天需要花多长时间？</summary>
      <p>建议每天 15–20 分钟即可：10 分钟听音背 20 个单词（系统自动安排到期复习 + 新词），5–10 分钟刷 10 道语法题。周末再花 10 分钟清一次错题本，8 周就能扎实跑完一轮完整体系。</p>
    </details>
    <details class="faq-item">
      <summary>手机、iPad 和电脑都能用吗？需要下载 App 吗？</summary>
      <p>全端自适应，手机、iPad 平板和电脑浏览器打开就能直接学，无需下载安装 App，也没有弹窗广告。所有 3,109 条单词音频均为纯正剑桥英音，点开即播。</p>
    </details>
    <details class="faq-item">
      <summary>孩子的背词进度和错题本会丢失吗？换设备怎么办？</summary>
      <p>学习记录实时保存在当前浏览器中，离线也能使用。如果需要在电脑和 iPad 之间切换，或担心清缓存丢失，可以随时在「学习数据」页点击<b>一键导出学习档案</b>，在新设备上导入即可无缝恢复。</p>
    </details>
    <details class="faq-item">
      <summary>这个网站覆盖了 PET 考试的哪些部分？</summary>
      <p>重点攻克 PET 备考最核心的底层能力：<b>完整 3,109 官方大纲词表（含听力辨音）</b>、<b>43 个核心语法考点</b>，以及直接对齐 <b>Reading Part 5（单选完形）、Part 6（开放填空）与 Writing 写作自查（改错）</b>的 261 道精练题，帮孩子先把词汇和语法地基打牢。</p>
    </details>
  </div>
</section>
`;

  write('index.html', page({
    title: 'PET 领航 · 剑桥 B1 官方词汇与语法系统备考平台',
    desc: `面向中小学生的剑桥 PET (B1 Preliminary) 备考系统：${STATS.total} 官方词条纯正英音朗读、${GRAMMAR_STATS.topics} 个语法考点避坑、${Q_STATS.total} 道真题式精练与 8 周打卡计划。`,
    active: 'home',
    body,
    dataKeys: ['STATS'],
    script: `
const P = window.PET;
function refresh() {
  const set = (id, v) => { const e = document.querySelector(id); if (e) e.textContent = v; };
  const lv = P.levelInfo();
  set('#cLevel', '🏅 Lv.' + lv.lv + ' ' + lv.name + ' · ' + lv.xp + ' XP');
  const days = P.daysLeft();
  const cd = document.querySelector('#cCountdown');
  if (cd) {
    if (days === null) cd.innerHTML = '📅 <span>设置 PET 考试倒计时</span>';
    else if (days >= 0) cd.innerHTML = '⏳ 距 PET 考试还有 <b>' + days + '</b> 天';
    else cd.innerHTML = '📅 <span>更新 PET 考试日期</span>';
  }
  set('#cTarget', '目标：' + P.targetLabel());
  const st = P.streak();
  set('#tStreak', st);
  set('#tStreakLabel', st === 0 ? '今日开启' : '天连学');
  set('#tWords', P.todayWords());
  set('#tGoal', P.goal());
  const pct = P.todayPct();
  set('#tPct', pct + '%');
  const bar = document.querySelector('#tBar');
  if (bar) bar.style.width = pct + '%';
  const q = P.todayQuestions();
  set('#ttGrammar', q ? '今天已精练 ' + q + ' 题，继续保持手感' : '每天 10–20 题，专攻正确率低的考点');
  const due = P.srsStats().due;
  set('#ttWords', due ? '今天有 ' + due + ' 个词到期，先复习再学新词' : '按遗忘曲线先过高频词，每词英音朗读');
  const wn = P.wordBookCount() + P.wrongIds().length;
  set('#ttWrong', wn ? '当前 ' + wn + ' 条错题待攻克，支持打印复习纸' : '太棒了，错题本目前干干净净');
}
refresh();
document.addEventListener('pet:daily', refresh);
document.addEventListener('pet:srs', refresh);
document.addEventListener('pet:profile', refresh);
`,
  }));
}

/* ==========================================================
   2. 官方词表（补齐全量英音一键朗读）
   ========================================================== */
function buildWords() {
  const body = `
<div class="page-head">
  <div class="crumb"><a href="index.html">首页</a> / 官方词库</div>
  <h1>剑桥 PET 官方词表</h1>
  <p class="lede">完整收录 Cambridge B1 Preliminary (2025) 官方词表：${STATS.words} 词 + ${STATS.phrases} 短语，按真实语料词频分三档，<b>最常考的高频词排在最前</b>，点 🔊 可听剑桥英音。</p>
</div>

<section class="section" style="margin-top:24px">
  <div class="kv">
    <div class="k"><b>${STATS.b1}</b><span>核心高频（必背，先拿稳）</span><div class="bar"><i style="width:${Math.round(STATS.b1 / STATS.total * 100)}%"></i></div></div>
    <div class="k"><b>${STATS.b2}</b><span>中频主力（阅读与写作关键）</span><div class="bar warn"><i style="width:${Math.round(STATS.b2 / STATS.total * 100)}%"></i></div></div>
    <div class="k"><b>${STATS.b3}</b><span>拓展词汇（考前冲刺认识即可）</span><div class="bar rose"><i style="width:${Math.round(STATS.b3 / STATS.total * 100)}%"></i></div></div>
    <div class="k" id="kKnown"><b>0</b><span>已标记掌握</span><div class="bar ok"><i style="width:0%"></i></div></div>
  </div>
</section>

<section class="section" style="margin-top:30px">
  <div class="toolbar">
    <input class="field" id="wq" type="search" placeholder="输入英文单词或中文释义快速查找…" autocomplete="off">
    <a class="btn sm soft" href="topics/index.html">按 23 个官方话题浏览 →</a>
    <a class="btn sm primary" href="quiz.html">去闯关背单词 →</a>
  </div>
  <div class="chips" style="margin-bottom:18px">
    <button class="chip on" data-filter="all">全部词条</button>
    <button class="chip" data-filter="b1">核心高频</button>
    <button class="chip" data-filter="b2">中频主力</button>
    <button class="chip" data-filter="b3">拓展词汇</button>
    <button class="chip" data-filter="phrase">仅高频短语</button>
    <button class="chip" data-filter="new">未掌握</button>
    <button class="chip" data-filter="known">已掌握</button>
  </div>
  <div id="wlist"></div>
</section>
`;
  const script = `
const { WORDS, STATS } = window.PET_DATA;
const P = window.PET;
P.renderWordList({ mount: '#wlist', words: WORDS, pageSize: 40, search: '#wq', initialFilter: 'new' });
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
    dataExtra: { PET_AUDIO: AUDIO },
    title: `官方词库 · ${STATS.total} 条带英音朗读`,
    desc: 'Cambridge B1 Preliminary 官方词表全量，含中文释义、音标、词性、官方例句与纯正英音朗读。',
    active: 'words',
    body, script,
  }));
}

/* ==========================================================
   3. 话题索引 + 话题详情（含英音朗读）
   ========================================================== */
function buildTopics() {
  const cards = TOPIC_SORTED.map((t) => `<a class="card" href="${t.id}.html">
    <div class="card-ico">${t.icon}</div>
    <h3>${esc(t.name)}</h3>
    <div class="meta">${t.n} 个词条 · ${esc(t.official)}</div>
  </a>`).join('');

  write('topics/index.html', page({
    base: '../',
    title: '23 个剑桥官方话题词库',
    desc: 'Cambridge B1 Preliminary 官方 23 个生活与校园话题词库，成组记忆更高效。',
    active: 'words',
    body: `
<div class="page-head">
  <div class="crumb"><a href="../index.html">首页</a> / <a href="../words.html">官方词库</a> / 按话题</div>
  <h1>按话题记词 · ${TOPIC_SORTED.length} 个官方场景</h1>
  <p class="lede">剑桥官方把 B1 词汇按中小学生日常阅读、口语和写作高频场景分为 ${TOPIC_SORTED.length} 个话题。同话题单词成组记忆，做阅读理解和写邮件时更容易整块联想。</p>
</div>
<section class="section" style="margin-top:26px">
  <div class="grid c3">${cards}</div>
  <div class="note">注：功能词（the / and / of 等）与跨场景通用词归在<a href="../words.html">全部官方词表</a>中；部分多义词会同时出现在多个相关话题里。</div>
</section>`,
  }));

  TOPIC_SORTED.forEach((t) => {
    const list = WORD_BY_TOPIC.get(t.id) || [];
    const topicAudio = {};
    list.forEach((w) => { if (AUDIO[w.w]) topicAudio[w.w] = AUDIO[w.w]; });
    write(`topics/${t.id}.html`, page({
      base: '../',
      dataKeys: [],
      dataExtra: {
        TOPIC_WORDS: list.map((w) => ({ w: w.w, pos: w.pos, posZh: w.posZh, t: w.t, zh: w.zh, tag: w.tag, ph: w.ph, ex: w.ex, tp: w.tp, al: w.al, frq: w.frq })),
        PET_AUDIO: topicAudio,
      },
      title: `${t.name} · ${list.length} 个话题词汇`,
      desc: `${t.official} 话题下的剑桥 B1 Preliminary 官方词汇与英音朗读。`,
      active: 'words',
      body: `
<div class="page-head">
  <div class="crumb"><a href="../index.html">首页</a> / <a href="../words.html">官方词库</a> / <a href="index.html">话题</a> / ${esc(t.name)}</div>
  <h1>${t.icon} ${esc(t.name)}</h1>
  <p class="lede">${esc(t.official)} · 共 ${list.length} 个官方词条。点击 🔊 听纯正英音，点右侧按钮标记已掌握。</p>
</div>
<section class="section" style="margin-top:26px">
  <div class="toolbar">
    <input class="field" id="wq" type="search" placeholder="在本话题内搜索英文或中文…" autocomplete="off">
    <a class="btn sm soft" href="index.html">← 返回全部话题</a>
  </div>
  <div class="chips" style="margin-bottom:18px">
    <button class="chip" data-filter="all">全部</button>
    <button class="chip" data-filter="b1">核心高频</button>
    <button class="chip" data-filter="b2">中频主力</button>
    <button class="chip" data-filter="b3">拓展词</button>
    <button class="chip on" data-filter="new">未掌握</button>
  </div>
  <div id="wlist"></div>
</section>`,
      script: `
const list = window.PET_DATA.TOPIC_WORDS;
window.PET.renderWordList({ mount: '#wlist', words: list, pageSize: 40, search: '#wq', initialFilter: 'new' });
`,
    }));
  });
}

/* ==========================================================
   4. 语法体系（族索引 + 详情页，带实时正确率徽章）
   ========================================================== */
function topicCardHtml(t, index) {
  const qn = (Q_BY_TOPIC.get(t.id) || []).length;
  const trapN = t.traps.length;
  const plainRule = t.rule.replace(/\*\*([^*]*)\*\*/g, '$1').replace(/`([^`]*)`/g, '$1');
  const quick = plainRule.length > 68 ? plainRule.slice(0, 66) + '…' : plainRule;
  const lvLabel = t.level === 'A2' ? 'A2 巩固' : t.level === 'B1+' ? 'B1+ 冲卓越' : 'B1 核心';

  const body = `
  <p class="grule">${rich(t.rule)}</p>
  ${t.form ? `<div class="gform">${esc(t.form)}</div>` : ''}
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
  ${qn ? `<div style="margin-top:18px"><a class="btn sm primary" href="../review.html?topic=${t.id}">专项刷这个考点（${qn} 题）→</a></div>` : ''}`;

  return `
<details class="tcard" id="${t.id}">
  <summary class="tcard-sum">
    <span class="tcard-num">${String(index + 1).padStart(2, '0')}</span>
    <span class="tcard-main">
      <span class="tcard-title">${esc(t.name)}<span class="lv ${esc(t.level)}">${lvLabel}</span></span>
      <span class="tcard-quick">${esc(quick)}</span>
    </span>
    <span class="tcard-meta">${trapN} 条避坑${qn ? ` · ${qn} 题` : ''}</span>
    <span class="tcard-caret" aria-hidden="true"></span>
  </summary>
  <div class="tcard-body">${body}</div>
</details>`;
}

function buildGrammar() {
  const cards = GRAMMAR.map((g) => {
    const trapN = g.topics.reduce((a, t) => a + t.traps.length, 0);
    const qN = g.topics.reduce((a, t) => a + (Q_BY_TOPIC.get(t.id) || []).length, 0);
    const names = g.topics.map((t) => esc(t.name)).join(' · ');
    return `<a class="card gfam" href="grammar/${g.id}.html" data-gid="${g.id}">
      <div class="gfam-top"><span class="card-ico purple">${g.icon}</span><span class="gfam-count">${g.topics.length} 个考点</span></div>
      <h3>${esc(g.name)}</h3>
      <p class="gfam-list">${names}</p>
      <div class="gfam-foot">
        <span class="meta">${trapN} 条易错避坑 · ${qN} 道题</span>
        <span class="meta" data-gacc="${g.id}"></span>
      </div>
    </a>`;
  }).join('');

  write('grammar.html', page({
    title: `语法体系 · ${GRAMMAR_STATS.sections} 族 ${GRAMMAR_STATS.topics} 考点`,
    desc: `剑桥 PET 语法 ${GRAMMAR_STATS.sections} 大族 ${GRAMMAR_STATS.topics} 个必考语法点，含公式表、例句与中式易错避坑对比。`,
    active: 'grammar',
    dataKeys: ['GRAMMAR'],
    body: `
<div class="page-head">
  <div class="crumb"><a href="index.html">首页</a> / 语法体系</div>
  <h1>PET 语法避坑体系</h1>
  <p class="lede">按 PET 真题考查密度排成 ${GRAMMAR_STATS.sections} 个语法族、${GRAMMAR_STATS.topics} 个核心考点。
 点进任意模块即可展开公式表、精选例句与 <b>✕ 易错句 vs ✓ 正确句</b> 对比，学完直接刷专项题。</p>
</div>

<section class="section" style="margin-top:24px">
  <div class="kv">
    <div class="k"><b>${GRAMMAR_STATS.sections}</b><span>核心语法族</span></div>
    <div class="k"><b>${GRAMMAR_STATS.topics}</b><span>必考语法点</span></div>
    <div class="k"><b>${GRAMMAR_STATS.traps}</b><span>中式易错避坑</span></div>
    <div class="k"><b>${Q_STATS.total}</b><span>配套精练题</span></div>
  </div>
</section>

<section class="section" style="margin-top:28px">
  <div class="grid c3">${cards}</div>
</section>

<div class="note">难度标签说明：<span class="lv A2">A2 巩固</span> 为 KET 已学基础巩固，<span class="lv B1">B1 核心</span> 为 PET 必考主力丢分点，<span class="lv B1+">B1+ 冲卓越</span> 主要用于阅读长难句与写作冲刺 Merit / Distinction。</div>
`,
    script: `
const { GRAMMAR } = window.PET_DATA;
const P = window.PET;
const stats = P.qTopicStats();
const byTopic = new Map(stats.map(x => [x.topic, x]));
GRAMMAR.forEach(g => {
  let n = 0, ok = 0;
  g.topics.forEach(t => { const s = byTopic.get(t.id); if (s) { n += s.n; ok += s.ok; } });
  const el = document.querySelector('[data-gacc="' + g.id + '"]');
  if (el && n > 0) {
    const pct = Math.round(ok / n * 100);
    el.textContent = '正确率 ' + pct + '%';
    el.style.color = pct >= 80 ? 'var(--ok)' : pct >= 60 ? 'var(--gold)' : 'var(--rose)';
    el.style.fontWeight = '700';
  }
});
`,
  }));

  GRAMMAR.forEach((g, gi) => {
    const prev = GRAMMAR[gi - 1];
    const next = GRAMMAR[gi + 1];
    const cardsHtml = g.topics.map((t, i) => topicCardHtml(t, i)).join('');
    const navBtns = `
  <div class="gfam-pager">
    ${prev ? `<a class="btn sm" href="${prev.id}.html">← ${esc(prev.name)}</a>` : '<span></span>'}
    <a class="btn sm soft" href="../grammar.html">全部语法族</a>
    ${next ? `<a class="btn sm" href="${next.id}.html">${esc(next.name)} →</a>` : '<span></span>'}
  </div>`;

    write(`grammar/${g.id}.html`, page({
      base: '../',
      title: `${g.name} · ${g.topics.length} 个语法考点`,
      desc: `${g.name}：${g.topics.map((t) => t.name).join('、')}。含规则公式、例句与中式易错避坑对比。`,
      active: 'grammar',
      body: `
<div class="page-head">
  <div class="crumb"><a href="../index.html">首页</a> / <a href="../grammar.html">语法体系</a> / ${esc(g.name)}</div>
  <h1>${g.icon} ${esc(g.name)}</h1>
  <p class="lede">${esc(g.hook)}</p>
</div>

<section class="section" style="margin-top:22px">
  <div class="toolbar">
    <button class="chip" id="expandAll">全部展开</button>
    <button class="chip" id="collapseAll">全部收起</button>
    <a class="btn sm primary" href="../review.html" style="margin-left:auto">去练语法真题 →</a>
  </div>
  <div class="tcards">${cardsHtml}</div>
  ${navBtns}
</section>

<div class="note">点击任意考点标题展开公式与避坑对比。<span class="lv A2">A2 巩固</span> 基础复习 · <span class="lv B1">B1 核心</span> PET 必考 · <span class="lv B1+">B1+ 冲卓越</span> 进阶加分。</div>
`,
      rawScript: `<script>
(function(){
  var expand = document.querySelector('#expandAll');
  var collapse = document.querySelector('#collapseAll');
  var all = function(){ return document.querySelectorAll('.tcard'); };
  if (expand) expand.addEventListener('click', function(){ all().forEach(function(d){ d.open = true; }); });
  if (collapse) collapse.addEventListener('click', function(){ all().forEach(function(d){ d.open = false; }); });
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
   5. 闯关背单词（支持四选一 + 闪卡回忆双模式 + 音效开关）
   ========================================================== */
function buildStudy() {
  write('quiz.html', page({
    dataKeys: ['WORDS', 'STATS'],
    dataExtra: { PET_AUDIO: AUDIO },
    title: '听音背单词 · 遗忘曲线闯关',
    desc: `用艾宾浩斯遗忘曲线背 ${STATS.total} 个 PET 官方词条：纯正英音自动朗读，支持四选一闯关与闪卡回忆双模式。`,
    active: 'words-study',
    body: `
<div class="page-head">
  <div class="crumb"><a href="index.html">首页</a> / 听音背单词</div>
  <h1>听音闯关背单词</h1>
  <p class="lede">按 <b>艾宾浩斯遗忘曲线</b> 科学排期：答错 10 分钟后再现，答稳了自动拉长间隔（1 天 → 3 天 → 7 天 → 21 天+），每词自带纯正剑桥英音。</p>

  <div class="scope-bar">
    <div class="scope-bar-label">选择背词词库范围</div>
    <div class="chips" id="scopeBar">
      <button class="chip on" data-s="all">全部词条 <b>${STATS.total}</b></button>
      <button class="chip" data-s="b1">核心高频 <b>${STATS.b1}</b></button>
      <button class="chip" data-s="b2">中频主力 <b>${STATS.b2}</b></button>
      <button class="chip" data-s="b3">拓展词汇 <b>${STATS.b3}</b></button>
      <button class="chip" data-s="phrase">只背短语 <b>${STATS.phrases}</b></button>
    </div>
    <p class="scope-bar-hint" id="scopeHint">全部 3,109 条官方词表与短语，覆盖最全</p>
  </div>
</div>

<section class="section" style="margin-top:22px">
  <div class="card" style="padding:20px 24px">
    <div class="today-goal-row">
      <span>今日已背 <b id="kToday">0</b> / <b id="kGoal">20</b> 词 · 🔥 连续打卡 <b id="kStreak">0</b> 天</span>
      <span class="today-pct" id="kPct">0%</span>
    </div>
    <div class="bar"><i id="kBar" style="width:0%"></i></div>
    <div class="chips" style="margin-top:14px" id="goalChips">
      <span class="quiz-count" style="margin-right:6px">每日目标</span>
      <button class="chip" data-goal="10">10 词</button>
      <button class="chip on" data-goal="20">20 词</button>
      <button class="chip" data-goal="30">30 词</button>
      <button class="chip" data-goal="50">50 词</button>
    </div>
  </div>
  <div class="kv" id="srsKv" style="margin-top:14px">
    <div class="k"><b id="kLeft">—</b><span>尚未学习</span></div>
    <div class="k"><b id="kTotal">—</b><span>已学词数（牢固 <b id="kMature" style="display:inline;font-size:1em;color:var(--ok)">0</b>）</span></div>
    <div class="k"><b id="kDue" style="color:var(--accent)">—</b><span>今日待复习</span></div>
    <div class="k"><b id="kAcc">—</b><span id="kAccSub">背词准确率</span></div>
    <div class="k"><b id="kScope">—</b><span>本范围总词量</span></div>
  </div>
</section>

<section class="section" style="margin-top:26px" id="setup">
  <div class="card setup-card">
    <div class="setup-head">
      <h3>开始本轮闯关</h3>
      <div class="setup-actions">
        <button class="btn primary" id="startBtn">开始背单词 →</button>
        <button class="btn ghost sm" id="resetBtn">重置进度</button>
      </div>
    </div>

    <div class="setup-grid">
      <div class="setup-group">
        <div class="kicker">学习模式</div>
        <div class="chips" id="cardChips">
          <button class="chip on" data-c="choice">四选一 · 看英选义</button>
          <button class="chip" data-c="recall">闪卡 · 主动回忆</button>
        </div>
        <p class="setup-hint" id="cardHint">听音看词选中文，系统自动判分，中小学生最易上手</p>
      </div>

      <div class="setup-group">
        <div class="kicker">学习内容</div>
        <div class="chips" id="modeChips">
          <button class="chip on" data-m="mix">智能混合</button>
          <button class="chip" data-m="due">只复习到期</button>
          <button class="chip" data-m="new">只学新词</button>
        </div>
        <p class="setup-hint" id="modeHint">到期复习 + 适量新词，兼顾巩固与推进</p>
      </div>

      <div class="setup-group">
        <div class="kicker">英音朗读与音效</div>
        <div class="chips" id="sayChips">
          <button class="chip on" data-say="on">自动朗读 3 遍</button>
          <button class="chip" data-say="off">静音（手动点 🔊）</button>
          <button class="chip on" id="sfxToggle">提示音：开</button>
        </div>
        <p class="setup-hint" id="sayHint">每题出现自动朗读 3 遍纯正英音，耳朵眼睛一起记</p>
      </div>

      <div class="setup-group">
        <div class="kicker">本轮词数</div>
        <p class="setup-hint" style="margin-top:0">每轮出 <b id="lenEcho">20</b> 词，与上方「每日目标」保持一致</p>
      </div>
    </div>

    <div class="note setup-note">
      电脑快捷键：<b>1–4</b> 选答案、<b>空格</b>翻卡、<b>Enter</b> 下一词。答错的词会自动收进<a href="wrong.html">错题本</a>。
    </div>
  </div>
</section>

<section class="section" id="zone" style="display:none"><div id="fc"></div></section>
`,
    script: `
const { WORDS } = window.PET_DATA;
const P = window.PET;
let mode = 'mix', src = 'all', card = 'choice';
let autoSay = (function () {
  try { var v = localStorage.getItem('pet-autosay'); return v === null ? true : v === '1'; } catch (e) { return true; }
})();

function refreshKv() {
  const pool = src === 'phrase' ? WORDS.filter(w => w.t === 'phrase')
             : src === 'all' ? WORDS
             : WORDS.filter(w => w.tag === src);
  const all = P.srsAll ? P.srsAll() : {};
  const now = Date.now();
  let learned = 0, due = 0, mature = 0, left = 0;
  pool.forEach(w => {
    const r = all[w.w.toLowerCase()];
    if (!r) { left++; return; }
    learned++;
    if ((r.due || 0) <= now) due++;
    if ((r.ivl || 0) >= 21) mature++;
  });
  const set = (id, v) => { const e = document.querySelector(id); if (e) e.textContent = v; };
  set('#kScope', pool.length);
  set('#kLeft', left);
  set('#kTotal', learned);
  set('#kMature', mature);
  set('#kDue', due);

  const acc = P.wordAccStats ? P.wordAccStats(pool) : { answered: 0, rate: null };
  set('#kAcc', acc.rate === null ? '—' : Math.round(acc.rate * 100) + '%');
  const accSub = document.querySelector('#kAccSub');
  if (accSub) accSub.textContent = acc.answered ? '背词准确率（' + acc.answered + ' 次作答）' : '背词准确率';
  const accEl = document.querySelector('#kAcc');
  if (accEl) {
    accEl.style.color = acc.rate === null ? '' : acc.rate >= 0.8 ? 'var(--ok)' : acc.rate >= 0.6 ? 'var(--gold)' : 'var(--rose)';
  }
}
refreshKv();
document.addEventListener('pet:srs', refreshKv);

function refreshDaily() {
  const set = (id, v) => { const e = document.querySelector(id); if (e) e.textContent = v; };
  set('#kToday', P.todayWords());
  set('#kGoal', P.goal());
  set('#kStreak', P.streak());
  const pct = P.todayPct();
  set('#kPct', pct + '%');
  const bar = document.querySelector('#kBar');
  if (bar) bar.style.width = pct + '%';
  document.querySelectorAll('#goalChips .chip').forEach(c => {
    c.classList.toggle('on', parseInt(c.getAttribute('data-goal'), 10) === P.goal());
  });
  set('#lenEcho', P.goal());
}
refreshDaily();
document.addEventListener('pet:daily', refreshDaily);
document.querySelectorAll('#goalChips .chip').forEach(c => {
  c.addEventListener('click', () => { P.setGoal(c.getAttribute('data-goal')); refreshDaily(); });
});

function pick(sel, attr, cb) {
  document.querySelectorAll(sel + ' .chip[' + attr + ']').forEach(c => c.addEventListener('click', () => {
    document.querySelectorAll(sel + ' .chip[' + attr + ']').forEach(x => x.classList.remove('on'));
    c.classList.add('on'); cb(c.getAttribute(attr));
  }));
}
const HINTS = {
  card: {
    choice: '听音看词选中文，系统自动判分，中小学生最易上手',
    recall: '先看英文独立回想，再翻卡自评掌握程度，记忆更深刻'
  },
  mode: {
    mix: '到期复习 + 适量新词，兼顾巩固与推进',
    due: '只复习今天到期的词，专心把旧词钉牢',
    new: '只学还没背过的新词，适合周末集中抢进度'
  },
  src: {
    b1: '先拿下卷面最常见的高频词（约 907 个），性价比最高',
    b2: '阅读与写作的核心主力词，稳冲 Merit 优秀',
    b3: '低频拓展词，考前冲刺 Distinction 时再补齐',
    all: '全部 3,109 条官方词表与短语，覆盖最全',
    phrase: '266 条高频固定搭配与短语，专攻完形填空与写作'
  }
};
function setHint(id, text) { const el = document.querySelector('#' + id); if (el) el.textContent = text; }

pick('#cardChips', 'data-c', v => { card = v; setHint('cardHint', HINTS.card[v]); });
pick('#modeChips', 'data-m', v => { mode = v; setHint('modeHint', HINTS.mode[v]); refreshKv(); });

document.querySelectorAll('#sayChips .chip[data-say]').forEach(c => {
  if ((c.getAttribute('data-say') === 'on') !== autoSay) c.classList.remove('on');
  else c.classList.add('on');
  c.addEventListener('click', () => {
    document.querySelectorAll('#sayChips .chip[data-say]').forEach(x => x.classList.remove('on'));
    c.classList.add('on');
    autoSay = c.getAttribute('data-say') === 'on';
    try { localStorage.setItem('pet-autosay', autoSay ? '1' : '0'); } catch (e) {}
    setHint('sayHint', autoSay ? '每题出现自动朗读 3 遍纯正英音，耳朵眼睛一起记' : '静音模式；想听发音时点单词旁的 🔊');
  });
});

const sfxBtn = document.querySelector('#sfxToggle');
function syncSfx() {
  if (!sfxBtn) return;
  const on = P.sfxEnabled();
  sfxBtn.classList.toggle('on', on);
  sfxBtn.textContent = on ? '提示音：开' : '提示音：关';
}
syncSfx();
if (sfxBtn) sfxBtn.addEventListener('click', () => { P.setSfx(!P.sfxEnabled()); syncSfx(); });

(function initScope() {
  document.querySelectorAll('#scopeBar .chip').forEach(c => {
    c.classList.toggle('on', c.getAttribute('data-s') === src);
    c.addEventListener('click', () => {
      document.querySelectorAll('#scopeBar .chip').forEach(x => x.classList.remove('on'));
      c.classList.add('on');
      src = c.getAttribute('data-s');
      setHint('scopeHint', HINTS.src[src]);
      refreshKv();
    });
  });
  setHint('scopeHint', HINTS.src[src]);
})();

document.querySelector('#startBtn').addEventListener('click', () => {
  const pool = src === 'phrase' ? WORDS.filter(w => w.t === 'phrase')
             : src === 'all' ? WORDS
             : WORDS.filter(w => w.tag === src);
  document.querySelector('#setup').style.display = 'none';
  document.querySelector('#zone').style.display = '';
  P.wordStudy({ mount: '#fc', words: pool, mode, card, limit: P.goal(), backHref: 'quiz.html', autoSay });
  const zone = document.querySelector('#zone');
  window.scrollTo({ top: Math.max(0, zone.getBoundingClientRect().top + window.scrollY - 80), behavior: 'smooth' });
});

document.querySelector('#resetBtn').addEventListener('click', () => {
  if (confirm('确定清空所有背单词进度？此操作无法撤销。')) { P.srsReset(); P.clearKnown(); refreshKv(); P.toast('已重置背单词进度'); }
});
`,
  }));
}

/* ==========================================================
   6. 真题练语法
   ========================================================== */
function buildDrill() {
  const groupOptions = GRAMMAR.map((g) => {
    const n = g.topics.reduce((a, t) => a + (Q_BY_TOPIC.get(t.id) || []).length, 0);
    return `<button class="chip" data-g="${g.id}">${esc(g.name)} · ${n}</button>`;
  }).join('');

  write('review.html', page({
    dataKeys: ['QUESTIONS', 'QUESTIONS_2', 'GRAMMAR'],
    title: '真题练语法 · 考点专项精练',
    desc: `${Q_STATS.total} 道 PET 语法精练题，覆盖全部 ${GT_IDS.size} 个考点，自动定位最弱考点并收集错题。`,
    active: 'grammar-drill',
    body: `
<div class="page-head">
  <div class="crumb"><a href="index.html">首页</a> / 真题练语法</div>
  <h1>真题题型练语法</h1>
  <p class="lede">${Q_STATS.total} 道精练题完整覆盖 <b>${GT_IDS.size} 个 PET 核心考点</b>。系统实时追踪各考点正确率，自动把薄弱项浮到最前，答错的题一键收进错题本。</p>
</div>

<section class="section" style="margin-top:24px">
  <div class="kv">
    <div class="k"><b id="kQn">0</b><span>累计精练题数</span></div>
    <div class="k"><b id="kRate" style="color:var(--accent)">—</b><span>综合正确率</span></div>
    <div class="k"><b id="kWrong" style="color:var(--rose)">0</b><span>语法错题本</span></div>
  </div>
</section>

<section class="section" style="margin-top:28px" id="setup">
  <div class="card setup-card">
    <div class="setup-head">
      <h3>配置本组练习</h3>
      <div class="setup-actions">
        <button class="btn primary" id="startBtn">开始刷题 →</button>
        <button class="btn ghost sm" id="resetBtn">清空记录</button>
      </div>
    </div>

    <div class="setup-grid">
      <div class="setup-group">
        <div class="kicker">练习范围</div>
        <div class="chips" id="scopeChips">
          <button class="chip on" data-scope="all">全部考点</button>
          <button class="chip" data-scope="wrong">只练错题本 <span id="wrongN">0</span></button>
          <button class="chip" data-scope="weak">专攻最弱考点</button>
        </div>
        <p class="setup-hint">选「专攻最弱考点」会自动挑出正确率最低的薄弱项集中突破</p>
      </div>

      <div class="setup-group">
        <div class="kicker">真考题型</div>
        <div class="chips" id="typeChips">
          <button class="chip on" data-t="all">混合真题</button>
          <button class="chip" data-t="choice">单项选择 (Part 5)</button>
          <button class="chip" data-t="correct">写作改错</button>
          <button class="chip" data-t="fill">开放填空 (Part 6)</button>
        </div>
        <p class="setup-hint">混合模式最贴近真考；改错题专治写作常见语法失分</p>
      </div>

      <div class="setup-group">
        <div class="kicker">本组题量</div>
        <div class="chips" id="lenChips">
          <button class="chip" data-l="10">10 题</button>
          <button class="chip on" data-l="20">20 题</button>
          <button class="chip" data-l="40">40 题</button>
        </div>
        <p class="setup-hint">20 题约 8–10 分钟，适合日常打卡</p>
      </div>

      <div class="setup-group wide">
        <div class="kicker">按语法族筛选 <span style="text-transform:none;letter-spacing:0;font-weight:500">· 仅在「全部考点」时生效</span></div>
        <div class="chips" id="groupChips">
          <button class="chip on" data-g="all">不限语法族</button>
          ${groupOptions}
        </div>
      </div>
    </div>

    <div class="note setup-note">
      快捷键：<b>1–4</b> 选答案、<b>Enter</b> 下一题；填空题按 <b>Enter</b> 提交。答错自动进入<a href="wrong.html">错题本</a>。
    </div>
  </div>
</section>

<section class="section" id="zone" style="display:none"><div id="qz"></div></section>
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
}
refreshStats();
document.addEventListener('pet:qlog', refreshStats);

const tp = new URLSearchParams(location.search).get('topic');
if (tp && TNAME.has(tp)) {
  topic = tp;
  const scopeChips = document.querySelector('#scopeChips');
  if (scopeChips) scopeChips.style.display = 'none';
  const banner = document.createElement('div');
  banner.className = 'note';
  banner.style.cssText = 'margin-top:18px;border-left-color:var(--accent)';
  banner.innerHTML = '当前专项考点：<b>' + P.esc(TNAME.get(tp)) + '</b> · 共 ' +
    (BY_TOPIC.get(tp) || []).length + ' 题 · <a href="review.html">切回全部自由练习 →</a>';
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
    if (!pool.length) { P.toast('错题本目前是空的，先练一组吧！'); return; }
  } else if (scope === 'weak') {
    const w = weakestTopic();
    if (!w) { P.toast('先练满几题，系统就能自动识别最弱考点'); return; }
    pool = pool.filter(q => q.topic === w);
  } else {
    if (grp !== 'all') pool = pool.filter(q => GT.get(q.topic) === grp);
  }
  if (type !== 'all') pool = pool.filter(q => (q.type || 'choice') === type);
  if (!pool.length) { P.toast('当前筛选组合下没有题目，换个条件试试'); return; }

  document.querySelector('#setup').style.display = 'none';
  document.querySelector('#zone').style.display = '';
  P.quiz({ mount: '#qz', questions: pool, limit: len, shuffle: true,
    reviewHref: 'grammar.html', reviewLabel: '回顾语法避坑',
    onRestart: () => location.reload(),
    onFinish: refreshStats });
  const zone = document.querySelector('#zone');
  window.scrollTo({ top: Math.max(0, zone.getBoundingClientRect().top + window.scrollY - 80), behavior: 'smooth' });
});

document.querySelector('#resetBtn').addEventListener('click', () => {
  if (confirm('确定清空全部语法练习记录与错题本？')) { P.qReset(); refreshStats(); P.toast('已清空语法记录'); }
});
`,
  }));
}

/* ==========================================================
   7. 智能错题本（支持发音 + 一键打印 A4 错题纸）
   ========================================================== */
function buildWrongBook() {
  write('wrong.html', page({
    dataKeys: ['WORDS', 'QUESTIONS', 'QUESTIONS_2', 'GRAMMAR'],
    dataExtra: { PET_AUDIO: AUDIO },
    title: '智能错题本 · 重做与打印复习纸',
    desc: '自动收纳错词和语法错题，支持一键重做、英音朗读和 A4 错题复习纸打印。',
    active: 'wrong',
    body: `
<div class="page-head">
  <div class="crumb"><a href="index.html">首页</a> / 智能错题本</div>
  <h1>智能错题本</h1>
  <p class="lede">做错的单词和语法题都会自动收录。单词需<b>连续答对 2 次</b>才移出，确保真记住；家长可随时点击「打印错题纸」，方便孩子睡前或考前纸质复盘。</p>
</div>

<section class="section" style="margin-top:22px">
  <div class="chips" id="tabs">
    <button class="chip on" data-tab="word">单词错题 <span id="nWord">0</span></button>
    <button class="chip" data-tab="gram">语法错题 <span id="nGram">0</span></button>
  </div>
  <div class="toolbar" style="margin-top:16px">
    <input class="field" id="wq" type="search" placeholder="在错题本里搜索…" autocomplete="off">
    <select class="field" id="psize" style="max-width:130px;padding:8px 10px;font-size:.84rem">
      <option value="10">每页 10 条</option>
      <option value="20">每页 20 条</option>
      <option value="50">每页 50 条</option>
    </select>
    <button class="btn primary sm" id="redoBtn">重做本页</button>
    <button class="btn soft sm" id="printBtn">🖨️ 打印错题纸</button>
    <button class="btn ghost sm" id="clearBtn">清空列表</button>
  </div>
  <div id="wbList"></div>
  <div class="pager" id="wbPager"></div>
  <div class="empty" id="wbEmpty" style="display:none">
    <b>🎉 错题本是空的！</b>去<a href="quiz.html">背单词</a>或<a href="review.html">练语法</a>，做错的题会自动收进来方便复盘
  </div>
</section>

<section class="section" id="redoZone" style="display:none">
  <div class="section-head"><h2>本页错题重做</h2><span class="sub" id="redoInfo"></span></div>
  <div id="redoHost"></div>
</section>
`,
    script: `
const { WORDS, QUESTIONS, QUESTIONS_2, GRAMMAR } = window.PET_DATA;
const P = window.PET;
const ALLQ = [...QUESTIONS, ...QUESTIONS_2];
const QBYID = new Map(ALLQ.map(q => [q.id, q]));
const WBYW = new Map(WORDS.map(w => [w.w.toLowerCase(), w]));
const TNAME = new Map();
GRAMMAR.forEach(g => g.topics.forEach(t => TNAME.set(t.id, t.name)));

const PSIZE_KEY = 'pet-wb-psize';
let PAGE_SIZE = parseInt(localStorage.getItem(PSIZE_KEY) || '10', 10);
if ([10, 20, 50].indexOf(PAGE_SIZE) < 0) PAGE_SIZE = 10;
let tab = 'word', page = 0, query = '';

function wordItems() {
  return P.wordBookList().map(x => ({ kind: 'word', key: x.w, rec: x, meta: WBYW.get(x.w) || {} }));
}
function gramItems() {
  return P.wrongIds().map(id => {
    const q = QBYID.get(id);
    const rec = (P.qLog().wrongIds || {})[id] || {};
    return { kind: 'gram', key: id, rec, q, topicName: TNAME.get(q && q.topic) || '' };
  }).filter(x => x.q);
}
function currentItems() {
  let arr = tab === 'word' ? wordItems() : gramItems();
  if (query) {
    const t = query.toLowerCase();
    arr = arr.filter(it => JSON.stringify(it).toLowerCase().includes(t));
  }
  return arr;
}

function wordRow(it) {
  const m = it.meta;
  const origWord = m.w || it.key;
  const canPlay = P.hasAudio(origWord);
  return '<div class="wrow wb-row" data-key="' + P.esc(it.key) + '">' +
    '<span class="w-cell">' +
      (canPlay ? '<button class="w-say" data-say="' + P.esc(origWord) + '" title="听英音">🔊</button>' : '') +
      '<span class="w">' + P.esc(origWord) + (m.ph ? '<span class="ph">/' + P.esc(m.ph) + '/</span>' : '') + '</span>' +
    '</span>' +
    '<span class="pos">' + P.esc(m.posZh || '') + '</span>' +
    '<span class="zh">' + P.esc(m.zh || '（无释义）') + '</span>' +
    '<span class="flag">错 ' + it.rec.wrong + ' 次 · 连对 ' + (it.rec.right || 0) + '/' + P.MASTER_STREAK + '</span>' +
    '<span class="wb-actions"><button class="btn xs" data-master="' + P.esc(it.key) + '">✓ 已掌握</button></span>' +
  '</div>';
}

function gramRow(it) {
  const q = it.q;
  const typeName = q.type === 'correct' ? '改错' : q.type === 'fill' ? '填空' : '单选';
  return '<div class="wb-gram" data-key="' + P.esc(it.key) + '">' +
    '<div class="qmeta"><span class="qtype">' + typeName + '</span>' +
      '<span class="flag">' + P.esc(it.topicName) + '</span>' +
      (q.level ? '<span class="lv ' + P.esc(q.level) + '">' + P.esc(q.level) + '</span>' : '') +
    '</div>' +
    '<div class="wb-stem">' + P.esc(q.stem) + '</div>' +
    '<div class="wb-actions"><button class="btn xs" data-master="' + P.esc(it.key) + '">✓ 已掌握</button></div>' +
  '</div>';
}

function draw() {
  const items = currentItems();
  const total = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  if (page >= total) page = total - 1;
  if (page < 0) page = 0;
  const slice = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  document.querySelector('#nWord').textContent = P.wordBookCount();
  document.querySelector('#nGram').textContent = P.wrongIds().length;

  const host = document.querySelector('#wbList');
  const empty = document.querySelector('#wbEmpty');
  const pager = document.querySelector('#wbPager');
  const redoBtn = document.querySelector('#redoBtn');
  const clearBtn = document.querySelector('#clearBtn');
  const printBtn = document.querySelector('#printBtn');

  if (!items.length) {
    host.innerHTML = ''; pager.innerHTML = ''; empty.style.display = '';
    redoBtn.disabled = true; clearBtn.disabled = true; printBtn.disabled = true;
    return;
  }
  empty.style.display = 'none';
  redoBtn.disabled = false; clearBtn.disabled = false; printBtn.disabled = false;

  host.innerHTML = tab === 'word'
    ? '<div class="wordlist">' + slice.map(wordRow).join('') + '</div>'
    : slice.map(gramRow).join('');

  let html = '<button data-pg="' + (page - 1) + '"' + (page === 0 ? ' disabled' : '') + '>‹</button>';
  for (let i = 0; i < total; i++) {
    if (total > 9 && i > 1 && i < total - 2 && Math.abs(i - page) > 1) {
      if (i === 2 || i === total - 3) html += '<span class="pager dots">…</span>';
      continue;
    }
    html += '<button data-pg="' + i + '"' + (i === page ? ' class="on"' : '') + '>' + (i + 1) + '</button>';
  }
  html += '<button data-pg="' + (page + 1) + '"' + (page === total - 1 ? ' disabled' : '') + '>›</button>';
  pager.innerHTML = html;
  pager.querySelectorAll('[data-pg]').forEach(b => {
    b.addEventListener('click', () => {
      const p = parseInt(b.getAttribute('data-pg'), 10);
      if (!isNaN(p)) { page = p; draw(); window.scrollTo({ top: 180, behavior: 'smooth' }); }
    });
  });

  host.querySelectorAll('[data-say]').forEach(b => {
    b.addEventListener('click', e => { e.stopPropagation(); P.playWord(b.getAttribute('data-say'), { times: 1 }); });
  });
  host.querySelectorAll('[data-master]').forEach(b => {
    b.addEventListener('click', () => {
      const key = b.getAttribute('data-master');
      if (tab === 'word') P.wordMaster(key); else P.qClearWrong(key);
      P.toast('已移出错题本');
      draw();
    });
  });
}

document.querySelectorAll('#tabs .chip').forEach(c => {
  c.addEventListener('click', () => {
    document.querySelectorAll('#tabs .chip').forEach(x => x.classList.remove('on'));
    c.classList.add('on');
    tab = c.getAttribute('data-tab');
    page = 0; draw();
  });
});
document.querySelector('#wq').addEventListener('input', e => { query = e.target.value.trim(); page = 0; draw(); });
const psizeSel = document.querySelector('#psize');
if (psizeSel) {
  psizeSel.value = String(PAGE_SIZE);
  psizeSel.addEventListener('change', () => {
    PAGE_SIZE = parseInt(psizeSel.value, 10);
    try { localStorage.setItem(PSIZE_KEY, String(PAGE_SIZE)); } catch (e) {}
    page = 0; draw();
  });
}
document.querySelector('#printBtn').addEventListener('click', () => window.print());
document.addEventListener('pet:wordbook', draw);
document.addEventListener('pet:qlog', draw);

document.querySelector('#clearBtn').addEventListener('click', () => {
  const label = tab === 'word' ? '单词错题' : '语法错题';
  if (!confirm('确定清空全部' + label + '？此操作不可撤销。')) return;
  if (tab === 'word') P.wordBookReset(); else P.qClearWrong();
  draw();
});

document.querySelector('#redoBtn').addEventListener('click', () => {
  const items = currentItems();
  const slice = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  if (!slice.length) return;
  const zone = document.querySelector('#redoZone');
  zone.style.display = '';
  document.querySelector('#redoInfo').textContent = '本页 ' + slice.length + ' 题 · 答对即推进掌握进度';
  if (tab === 'word') redoWords(slice); else redoGram(slice);
  zone.scrollIntoView({ block: 'start', behavior: 'smooth' });
});

function redoWords(slice) {
  const host = document.querySelector('#redoHost');
  let i = 0, done = 0, released = 0;
  let autoNextTimer = null;
  const AUTO_NEXT_MS = 780;
  function step() {
    clearTimeout(autoNextTimer);
    autoNextTimer = null;
    if (i >= slice.length) {
      P.sfx('win');
      host.innerHTML = '<div class="qcard" style="text-align:center">' +
        '<div style="font-size:1.45rem;font-weight:700">🎉 本页错词重做完成</div>' +
        '<div style="color:var(--text-2);margin-top:8px">答对 ' + done + ' / ' + slice.length + ' · 其中 ' + released + ' 个已移出错题本</div>' +
        '<div style="margin-top:20px"><button class="btn primary" id="rdAgain">返回错题本</button></div></div>';
      host.querySelector('#rdAgain').addEventListener('click', () => { document.querySelector('#redoZone').style.display = 'none'; draw(); });
      return;
    }
    const w = slice[i].meta;
    const ds = P.pickDistractors(WORDS, w, 3);
    const opts = [w].concat(ds);
    P.shuffle(opts);
    const ans = opts.indexOf(w);
    host.innerHTML = '<div class="flash-shell">' +
      '<div class="quiz-top"><div class="quiz-progress"><i style="width:' + (i / slice.length * 100) + '%"></i></div>' +
      '<span class="quiz-count">' + (i + 1) + ' / ' + slice.length + '</span></div>' +
      '<div class="fcard" style="justify-content:flex-start;padding-top:30px;min-height:0">' +
        '<div class="fword" style="font-size:clamp(1.6rem,5vw,2.1rem)">' + P.esc(w.w) + '</div>' +
        '<div style="font-size:.84rem;color:var(--text-3);margin-top:10px">选出正确的中文释义</div></div>' +
      '<div class="qopts" style="margin-top:14px">' +
        opts.map((o, k) => '<button class="qopt" data-k="' + k + '"><span class="key">' + 'ABCD'[k] + '</span><span>' + P.esc(o.zh || '') + '</span></button>').join('') +
      '</div><div id="rfb"></div></div>';
    let answered = false;
    host.querySelectorAll('.qopt').forEach(b => {
      b.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const k = parseInt(b.getAttribute('data-k'), 10);
        const ok = k === ans;
        P.sfx(ok ? 'ok' : 'bad');
        host.querySelectorAll('.qopt').forEach(x => {
          const xi = parseInt(x.getAttribute('data-k'), 10);
          x.classList.add('locked');
          if (xi === ans) x.classList.add('right');
          else if (xi === k) x.classList.add('wrong');
        });
        const mastered = P.wordAttempt(w.w, ok);
        if (ok) { done++; if (mastered) released++; }
        const fb = host.querySelector('#rfb');
        if (ok) {
          // 与背单词页一致：答对后短暂确认，自动进入下一题
          fb.innerHTML = '<div class="feedback auto-next"><b>✓ 对了！' +
            (mastered ? '已移出错题本' : '再对 ' + (P.MASTER_STREAK - (P.wordBook()[w.w.toLowerCase()] || {}).right) + ' 次即移出') +
            '</b>' + P.esc(w.w) + ' · ' + P.esc(w.posZh || '') +
            '<span class="auto-next-hint">即将进入下一题…</span></div>';
          clearTimeout(autoNextTimer);
          autoNextTimer = setTimeout(() => {
            if (!document.body.contains(host)) return;
            i++; step();
          }, AUTO_NEXT_MS);
        } else {
          fb.innerHTML = '<div class="feedback bad"><b>✕ 正确答案：' + P.esc(w.zh) + '</b>' +
            P.esc(w.w) + ' · ' + P.esc(w.posZh || '') + '</div>' +
            '<div class="quiz-actions"><span class="spacer"></span><button class="btn primary" id="rn">下一题 →</button></div>';
          fb.querySelector('#rn').addEventListener('click', () => { i++; step(); });
        }
      });
    });
  }
  step();
}

function redoGram(slice) {
  P.quiz({
    mount: '#redoHost',
    questions: slice.map(it => it.q),
    shuffle: true,
    reviewHref: '',
    onRestart: () => { document.querySelector('#redoZone').style.display = 'none'; draw(); },
  });
}

draw();
`,
  }));
}

/* ==========================================================
   8. 8 周通关计划（交互式打卡 + 考试倒计时节奏推荐）
   ========================================================== */
function buildPlan() {
  const weeks = [
    {
      w: 1, title: '时态地基',
      vocab: '核心高频词 1–250（卷面最常出现的第一批词）',
      grammar: ['tense', 'passive'],
      focus: '认熟「一般现在 / 现在进行 / 一般过去」信号词，背牢被动语态基础公式（be + 过去分词）。',
      drill: '刷完「动词时态」专项题，建立第一批个人错题本。',
    },
    {
      w: 2, title: '时态进阶 + 非谓语',
      vocab: '核心高频词 251–500',
      grammar: ['tense', 'nonfinite'],
      focus: '重点拿下「现在完成 vs 一般过去」（PET 头号丢分点）；非谓语记住常用接 to do 与 doing 的动词清单。',
      drill: '刷完「非谓语动词」专项题 + 重做第 1 周时态错题。',
    },
    {
      w: 3, title: '情态动词 + 条件句',
      vocab: '核心高频词 501–750',
      grammar: ['modal', 'conditional'],
      focus: "分清 mustn't（禁止）与 don't have to（不必）；条件句抓牢「主将从现」与 If I were you。",
      drill: '完成情态与条件两个语法族的全部题目。',
    },
    {
      w: 4, title: '名词冠词 + 代词',
      vocab: '核心高频词 751–907 收官 + 中频词入场',
      grammar: ['noun', 'pronoun'],
      focus: '熟记 PET 高频不可数名词（information / advice / furniture / news / equipment / luggage）；a/an 按发音判断。',
      drill: '完成名词冠词与代词专项题，核心高频词达成首轮闭环。',
    },
    {
      w: 5, title: '形容词副词 + 介词搭配',
      vocab: '中频主力词（结合 23 个官方话题成组背）',
      grammar: ['adjadv', 'prep'],
      focus: '牢记不规则比较级与 hard/hardly、late/lately 等易混词；重点整理写作高频介词固定搭配。',
      drill: '刷完两族专项题，打印本周介词错题纸复习一遍。',
    },
    {
      w: 6, title: '三大从句突破',
      vocab: '拓展词汇 + 266 条高频短语',
      grammar: ['clause'],
      focus: '宾语从句坚持「陈述语序」；状语从句杜绝 although+but / because+so 连用；定语从句区分 which 与 where。',
      drill: '刷完从句全部题目，重点练习「写作改错」题型。',
    },
    {
      w: 7, title: '句子结构与语篇衔接',
      vocab: '词库筛选「未掌握」查漏补缺',
      grammar: ['syntax', 'conjunction'],
      focus: '掌握反义疑问句、so/neither 倒装与 There be 就近原则；区分 however（副词）与 but（连词）。',
      drill: '完成两族全部题，用语法避坑清单自查近期的作文。',
    },
    {
      w: 8, title: '考前全真冲刺',
      vocab: '只刷今日到期复习词 + 清空错词本',
      grammar: ['tense', 'passive', 'nonfinite', 'clause'],
      focus: '打开「真题练语法」专攻正确率低于 70% 的薄弱考点；通读全部 119 条红绿易错对比。',
      drill: '每天一组 40 题混合真题模拟手感，轻松上考场！',
    },
  ];

  const gname = new Map(GRAMMAR.map((g) => [g.id, g.name]));
  const cards = weeks.map((k) => `
<div class="gtopic plan-week" data-week="${k.w}">
  <div class="plan-week-head">
    <h3 style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">第 ${k.w} 周 · ${esc(k.title)} <span class="lv ${k.w <= 4 ? 'A2' : k.w <= 7 ? 'B1' : 'B1+'}">${k.w <= 4 ? '夯实基础' : k.w <= 7 ? '提分补弱' : '考前冲刺'}</span></h3>
    <button class="plan-check" data-check-week="${k.w}">○ 标记本周完成</button>
  </div>
  <table class="gtable" style="margin:10px 0 0">
    <tbody>
      <tr><td style="width:88px">词汇任务</td><td>${esc(k.vocab)}</td></tr>
      <tr><td>语法模块</td><td>${k.grammar.map((g) => `<a href="grammar/${g}.html">${esc(gname.get(g) || g)}</a>`).join(' · ')}</td></tr>
      <tr><td>核心要点</td><td>${esc(k.focus)}</td></tr>
      <tr><td>刷题验收</td><td>${esc(k.drill)}</td></tr>
    </tbody>
  </table>
</div>`).join('');

  write('plan.html', page({
    title: '8 周 PET 通关打卡计划',
    desc: '把 3,109 官方词条、43 个语法考点和 261 道真题科学分配到 8 周，支持逐周勾选打卡与倒计时节奏规划。',
    active: 'plan',
    dataKeys: ['STATS'],
    body: `
<div class="page-head">
  <div class="crumb"><a href="index.html">首页</a> / 8 周通关计划</div>
  <h1>8 周 PET 系统通关计划</h1>
  <p class="lede">按「高频词汇 + 语法避坑 + 真题精练」三线并行推进。前 4 周打牢核心地基，第 5–7 周补齐阅读写作主力，第 8 周集中冲刺。</p>
</div>

<section class="section" style="margin-top:22px">
  <div class="card" style="padding:22px 24px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:14px">
      <div>
        <div style="font-weight:700;font-size:1.05rem" id="planTitle">8 周打卡总进度：<span id="planCount">0</span> / 8 周</div>
        <div style="font-size:.84rem;color:var(--text-2);margin-top:2px" id="planPace">设置 PET 考试日期后，自动帮你计算每日建议背词量</div>
      </div>
      <button class="btn sm soft" data-open-exam="1">📅 设置考试日期与目标</button>
    </div>
    <div class="bar ok"><i id="planBar" style="width:0%"></i></div>
  </div>
</section>

<section class="section" style="margin-top:28px">
  ${cards}
</section>

<section class="section">
  <div class="section-head"><h2>三个关键自查节点</h2></div>
  <div class="grid c3">
    <a class="card" href="review.html">
      <div class="card-ico">🔍</div>
      <h3>第 2 周末自查</h3>
      <p class="desc">在「练语法」刷一组 40 题。若正确率低于 65%，说明时态基础还不稳，建议先消化错题再进入第 3 周。</p>
    </a>
    <a class="card" href="stats.html">
      <div class="card-ico gold">📊</div>
      <h3>第 5 周末诊断</h3>
      <p class="desc">打开「学习数据」查看语法薄弱考点，用「专攻最弱考点」精准提分，不平均用力。</p>
    </a>
    <a class="card" href="grammar.html">
      <div class="card-ico ok">🚀</div>
      <h3>考前三天冲刺</h3>
      <p class="desc">清空错题本，并快速通读语法页里的 119 条 ✕ 错句 / ✓ 对句对比，考场轻松避开高频陷阱。</p>
    </a>
  </div>
</section>
`,
    script: `
const P = window.PET;
function refreshPlan() {
  let done = 0;
  document.querySelectorAll('.plan-week').forEach(card => {
    const w = card.getAttribute('data-week');
    const isDone = P.planDone(w);
    if (isDone) done++;
    card.classList.toggle('done', isDone);
    const btn = card.querySelector('[data-check-week]');
    if (btn) btn.textContent = isDone ? '✓ 本周已完成' : '○ 标记本周完成';
  });
  const cnt = document.querySelector('#planCount'); if (cnt) cnt.textContent = done;
  const bar = document.querySelector('#planBar'); if (bar) bar.style.width = (done / 8 * 100) + '%';
  const days = P.daysLeft();
  const pace = document.querySelector('#planPace');
  if (pace) {
    if (days !== null && days > 0) {
      const rec = Math.max(15, Math.min(80, Math.ceil(907 / Math.max(14, days * 0.65))));
      pace.innerHTML = '距 PET 考试还有 <b>' + days + ' 天</b> · 目标 <b>' + P.esc(P.targetLabel()) + '</b> · 建议每天背 <b>' + rec + ' 词</b> + 练 15 题';
    } else {
      pace.textContent = '建议每天 20 分钟：背单词 10 分钟 + 语法避坑与刷题 10 分钟（点击右侧设置考试倒计时）';
    }
  }
}
document.querySelectorAll('[data-check-week]').forEach(btn => {
  btn.addEventListener('click', () => {
    const on = P.togglePlanWeek(btn.getAttribute('data-check-week'));
    if (on) { P.sfx('ok'); P.toast('🎉 打卡成功，又推进了一周！'); }
    refreshPlan();
  });
});
document.addEventListener('pet:profile', refreshPlan);
refreshPlan();
`,
  }));
}

/* ==========================================================
   9. 内容与数据说明（纯静态：词表规模、语法分布、口径）
   ========================================================== */
function buildContent() {
  const tagRows = [
    ['核心高频 b1（卷面最常见）', STATS.b1],
    ['中频主力 b2（阅读写作主力）', STATS.b2],
    ['拓展词汇 b3（冲刺阶段认识）', STATS.b3],
  ];
  const topicRows = TOPIC_SORTED.map((t) => `<tr><td>${t.icon} ${esc(t.name)}</td><td>${esc(t.official)}</td><td style="text-align:right">${t.n}</td></tr>`).join('');
  const gramRows = GRAMMAR.map((g) => {
    const n = g.topics.reduce((s, t) => s + t.traps.length, 0);
    const q = g.topics.reduce((s, t) => s + (Q_BY_TOPIC.get(t.id) || []).length, 0);
    return `<tr><td>${g.icon} ${esc(g.name)}</td><td style="text-align:right">${g.topics.length}</td><td style="text-align:right">${n}</td><td style="text-align:right">${q}</td></tr>`;
  }).join('');

  write('content.html', page({
    title: '内容与数据说明',
    desc: `PET 领航收录的 ${STATS.total} 条官方词表、${GRAMMAR_STATS.topics} 个语法考点与 ${Q_STATS.total} 道精练题的规模明细与权威口径说明。`,
    active: 'content',
    body: `
<div class="page-head">
  <div class="crumb"><a href="index.html">首页</a> / 内容与数据说明</div>
  <h1>内容与数据说明</h1>
  <p class="lede">本站全部内容均来自剑桥官方大纲与公开考试说明。这里列出词表、语法与题库的完整规模，以及每个数字的口径来源。</p>
</div>

<section class="section" style="margin-top:24px">
  <div class="section-head">
    <div class="section-head-left">
      <span class="kicker">官方内容规模与权威口径</span>
      <h2>本站全量词表与题库数据明细</h2>
      <span class="sub">所有数字均由构建脚本实时统计，对应 Cambridge B1 Preliminary (2025) 官方词表</span>
    </div>
  </div>
  <div class="kv">
    <div class="k"><b>${STATS.words}</b><span>官方单词</span></div>
    <div class="k"><b>${STATS.phrases}</b><span>官方短语</span></div>
    <div class="k"><b>${STATS.total}</b><span>词条总计</span></div>
    <div class="k"><b>${STATS.withExample}</b><span>带官方例句</span></div>
    <div class="k"><b>${STATS.topics}</b><span>官方话题</span></div>
  </div>
  <table class="gtable" style="margin-top:20px">
    <thead><tr><th>频档分级</th><th style="text-align:right">词条数</th><th style="text-align:right">占比</th></tr></thead>
    <tbody>${tagRows.map(([n, v]) => `<tr><td>${n}</td><td style="text-align:right">${v}</td><td style="text-align:right">${(v / STATS.total * 100).toFixed(1)}%</td></tr>`).join('')}</tbody>
  </table>
</section>

<section class="section">
  <div class="section-head"><h2>语法体系与题量分布</h2></div>
  <table class="gtable">
    <thead><tr><th>语法族</th><th style="text-align:right">考点数</th><th style="text-align:right">易错避坑</th><th style="text-align:right">配套题量</th></tr></thead>
    <tbody>${gramRows}</tbody>
  </table>
</section>

<section class="section">
  <div class="section-head"><h2>23 个官方话题词量</h2><span class="sub">部分多义词归属多个话题</span></div>
  <table class="gtable">
    <thead><tr><th>中文话题</th><th>剑桥官方英文名</th><th style="text-align:right">词数</th></tr></thead>
    <tbody>${topicRows}</tbody>
  </table>
</section>

<section class="section">
  <div class="section-head"><h2>数据来源与口径说明</h2></div>
  <div class="note">
    <b>官方词表</b>：源自 Cambridge University Press 发布的 <i>B1 Preliminary and B1 Preliminary for Schools Vocabulary List</i>（August 2025），正文词条 + 附录 2 的 23 个话题表；附录 1 的封闭清单（数字、星期、月份等）未逐条计入总数。<br><br>
    <b>中文释义与英音</b>：释义结合官方词性筛选并对 300+ 高频多义词做了人工精校；全部 ${STATS.total.toLocaleString('en-US')} 条词条均预合成纯正剑桥英音音频，无外链依赖。<br><br>
    <b>频档与语法题库</b>：频档按真实英语语料词频启发式分为高频/中频/低频三档；语法考点与 ${Q_STATS.total} 道精练题按 B1 Preliminary 公开考试说明（Reading Part 5/6 与 Writing 常见语法点）原创编写。
  </div>
</section>

<section class="section">
  <div class="note">
    查看你的个人学习进度与备份？见<a href="stats.html">学习数据 →</a>
  </div>
</section>
`,
  }));
}

/* ==========================================================
   10. 学习数据 & 档案备份
   ========================================================== */
function buildStats() {
  write('stats.html', page({
    title: '学习数据与统计',
    desc: '实时追踪 PET 备考进度、近 7 天学习活跃度与词表题库分布，支持跨设备导出和导入学习档案。',
    active: 'stats',
    dataKeys: ['STATS', 'GRAMMAR'],
    body: `
<div class="page-head">
  <div class="crumb"><a href="index.html">首页</a> / 学习数据</div>
  <h1>学习数据与进度统计</h1>
  <p class="lede">每一次背词、刷题和错题攻克都会实时汇总在这里，支持跨设备导出和恢复学习进度。</p>
</div>

<section class="section" style="margin-top:24px">
  <div class="report-banner">
    <div>
      <h2 id="rpHeading">剑桥 PET 备考进度总览</h2>
      <p id="rpSub">设定考试日期与目标档位，首页驾驶舱与 8 周计划将自动同步冲刺节奏</p>
    </div>
    <div class="report-actions">
      <button class="btn solid sm" data-open-exam="1">📅 设置考试档案</button>
      <button class="btn sm" id="exportBtn">⬇ 导出档案备份</button>
      <label class="btn sm" style="cursor:pointer">⬆ 导入恢复<input type="file" id="importFile" accept=".json" style="display:none"></label>
    </div>
  </div>
</section>

<section class="section" style="margin-top:24px">
  <div class="kv">
    <div class="k"><b id="rLevel">Lv.1</b><span id="rXp">剑桥萌新 · 0 XP</span></div>
    <div class="k"><b id="rStreak" style="color:var(--gold)">0 天</b><span>当前连续打卡</span></div>
    <div class="k"><b id="rWords" style="color:var(--accent)">0</b><span id="rWordsSub">已学词数（牢固 0）</span></div>
    <div class="k"><b id="rQRate" style="color:var(--ok)">—</b><span id="rQSub">语法精练总正确率</span></div>
    <div class="k"><b id="rWrong" style="color:var(--rose)">0</b><span>错题本待清理</span></div>
  </div>
</section>

<section class="section" style="margin-top:28px">
  <div class="card">
    <span class="kicker">近 7 天学习活跃度</span>
    <h3 style="margin-bottom:4px">每日学习量（词数 + 题数）</h3>
    <p class="meta" id="chartSummary">每天保持节奏，记忆效果远胜考前突击</p>
    <div class="chart-bars" id="chartBars"></div>
  </div>
</section>

<section class="section" id="topicDiagSection">
  <div class="section-head">
    <div class="section-head-left">
      <h2>各考点掌握诊断</h2>
      <span class="sub">答满 3 题的考点按正确率从低到高排列，红色项建议重点重练</span>
    </div>
  </div>
  <div id="topicDiagList"></div>
</section>

<section class="section">
  <div class="note">
    想看词表规模、语法族分布与数据来源口径？见<a href="content.html">内容与数据说明 →</a>
  </div>
</section>
`,
    script: `
const P = window.PET;

function renderReport() {
  const prof = P.profile();
  const lv = P.levelInfo();
  const srs = P.srsStats();
  const qst = P.qTopicStats();
  const qN = qst.reduce((a, x) => a + x.n, 0);
  const qOk = qst.reduce((a, x) => a + x.ok, 0);
  const days = P.daysLeft();
  const set = (id, v) => { const e = document.querySelector(id); if (e) e.textContent = v; };

  set('#rpHeading', (prof.childName ? prof.childName + '的 ' : '') + 'PET 备考进度总览');
  set('#rpSub', '目标：' + P.targetLabel() + (days !== null && days >= 0 ? ' · 距考试还有 ' + days + ' 天' : ' · 点击右侧可设置考试倒计时'));
  set('#rLevel', 'Lv.' + lv.lv);
  set('#rXp', lv.name + ' · ' + lv.xp + ' XP');
  set('#rStreak', P.streak() + ' 天');
  set('#rWords', srs.total);
  set('#rWordsSub', '已学词数（已牢固 ' + srs.mature + ' 词）');
  set('#rQRate', qN ? Math.round(qOk / qN * 100) + '%' : '—');
  set('#rQSub', qN ? '累计精练 ' + qN + ' 题' : '暂未开始语法练习');
  set('#rWrong', P.wordBookCount() + P.wrongIds().length);

  // 各考点掌握诊断
  const TNAME = new Map();
  (window.PET_DATA.GRAMMAR || []).forEach(g => g.topics.forEach(t => TNAME.set(t.id, t.name)));
  const diagRows = qst.filter(x => x.n >= 3).sort((a, b) => a.rate - b.rate);
  const diagSec = document.querySelector('#topicDiagSection');
  const diagList = document.querySelector('#topicDiagList');
  if (diagList) {
    if (diagRows.length) {
      if (diagSec) diagSec.style.display = '';
      diagList.innerHTML = '<div class="wordlist">' + diagRows.map(x => {
        const pct = Math.round(x.rate * 100);
        const cls = pct < 60 ? 'bar rose' : pct < 80 ? 'bar warn' : 'bar ok';
        return '<div class="wrow" style="grid-template-columns:1.4fr 110px 1fr auto;cursor:default">' +
          '<span class="w" style="cursor:default">' + P.esc(TNAME.get(x.topic) || x.topic) + '</span>' +
          '<span class="pos">' + x.ok + ' / ' + x.n + ' 题</span>' +
          '<span class="' + cls + '"><i style="width:' + pct + '%"></i></span>' +
          '<span class="flag">' + pct + '%</span></div>';
      }).join('') + '</div>';
    } else {
      if (diagSec) diagSec.style.display = 'none';
    }
  }

  // 7日柱状图
  const days7 = P.last7Days();
  const maxV = Math.max(10, ...days7.map(d => d.total));
  const sum7 = days7.reduce((a, d) => a + d.total, 0);
  set('#chartSummary', sum7 ? '近 7 天累计完成 ' + sum7 + ' 次词/题练习，继续加油！' : '今天开始背第一组词，这里就会点亮 7 天学习曲线');
  const host = document.querySelector('#chartBars');
  if (host) {
    host.innerHTML = days7.map(d => {
      const h = d.total ? Math.max(8, Math.round(d.total / maxV * 100)) : 4;
      return '<div class="chart-col">' +
        '<span class="chart-val">' + (d.total || '') + '</span>' +
        '<div class="chart-bar-wrap"><div class="chart-bar" style="height:' + h + '%;' + (d.total ? '' : 'opacity:.25') + '"></div></div>' +
        '<span class="chart-day">' + d.label + '</span>' +
      '</div>';
    }).join('');
  }
}

renderReport();
document.addEventListener('pet:profile', renderReport);

document.querySelector('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([P.exportBackup()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pet-study-backup-' + P.todayKey() + '.json';
  a.click();
  P.toast('✓ 学习档案已导出保存');
});

document.querySelector('#importFile').addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try { P.importBackup(String(r.result || '')); }
    catch (err) { P.toast('导入失败：请确认是导出的 JSON 备份文件'); }
  };
  r.readAsText(f);
});
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
  buildWrongBook();
  buildStats();
  buildContent();
  buildPlan();

  const msg = [
    '构建完成（PET 领航 v2）',
    `  词条 ${STATS.total}（单词 ${STATS.words} / 短语 ${STATS.phrases}）`,
    `  频档 高频 ${STATS.b1} / 中频 ${STATS.b2} / 低频 ${STATS.b3}`,
    `  话题 ${TOPIC_SORTED.length}（有词的 ${TOPIC_SORTED.length}）`,
    `  语法 ${GRAMMAR_STATS.sections} 族 / ${GRAMMAR_STATS.topics} 考点 / ${GRAMMAR_STATS.traps} 条易错`,
    `  题目 ${Q_STATS.total}（选择 ${Q_STATS.choice} / 改错 ${Q_STATS.correct} / 填空 ${Q_STATS.fill}）`,
    `  发音 ${Object.keys(AUDIO).length} 条`,
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
