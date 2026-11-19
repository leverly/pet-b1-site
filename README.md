# PET B1 备考站

把 Cambridge B1 Preliminary（PET）的**完整官方词汇表**和**考试范围内的语法体系**做成一个可计数、可练习、可复习的静态网站。

## 直接打开

```bash
open index.html          # 双击也行，无需服务器、无需构建
```

站点把数据内联进了每个页面，所以 `file://` 协议下也能正常工作（浏览器会拦截 ES module 的跨域加载，因此这里不用 module）。

## 内容规模

| 项目 | 数量 | 来源 |
|---|---|---|
| 官方单词 | 2843 | Cambridge *B1 Preliminary Vocabulary List*（2025-08）正文 |
| 官方短语 | 266 | 同上 |
| 词条合计 | 3109 | 全部带中文释义、音标、词性、官方例句 |
| 官方话题 | 23 | 同上，附录 2 Topic Lists |
| 语法族 | 12 | 按时态、被动、非谓语、情态、条件、名词冠词、代词、形副、介词、从句、句式、语篇组织 |
| 语法考点 | 43 | 每个含规则、变化表、例句、易错对比 |
| 易错对比 | 119 | ✕ 错句 / ✓ 对句 / 一句错因 |
| 练习题 | 261 | 选择 146 · 改错 70 · 开放式填空 45，覆盖全部 43 个考点 |

词表覆盖率：扣除附录 1 的封闭清单（数字、星期、月份、季节、国家国籍、大洲）后，
PDF 正文的 3008 个去重词条中本站覆盖 **99.4%**，剩余 19 条是 `a/an`、`café/cafe` 这类斜杠形式
（已拆成主词条 + 别名）或 `v/versus` 这类缩写。

## 页面

| 页面 | 作用 |
|---|---|
| `index.html` | 入口与方法说明 |
| `words.html` | 全量词表：搜索、频档筛选、掌握状态、分页 |
| `topics/index.html` | 23 个官方话题；每个话题有独立页面 |
| `grammar.html` | 12 族 43 考点，含变化表与 ✕/✓ 对照 |
| `bank.html` | 261 题全量题库，可按题型/关键词筛选，显示解析 |
| `quiz.html` | 随机测验：可选题型、语法族、题量；键盘 1–4 / Enter |
| `voc.html` | 词汇自测：看词选义 / 看义选词，干扰项取自同话题同词性 |
| `review.html` | 间隔重复复习（SM-2 简化版），按遗忘曲线排期 |
| `traps.html` | 119 条易错点集中在同一页，可搜索 |
| `plan.html` | 8 周备考计划 |
| `stats.html` | 所有数字的实时统计与口径说明 |

## 学习闭环

```
词汇（3109 条）──┐
                 ├── 自测 / 测验 ──→ 记忆库（localStorage）
语法（43 考点）──┤                        │
                 │                        ▼
题库（261 题）───┘              复习页按遗忘曲线排期
```

答对/答错会写进记忆库，影响「复习」页下次出现的时间：
忘了 → 10 分钟后再来；会了 → 按 ease 因子拉长间隔（1 天 → 3 天 → 7 天 → 21 天以上）。

## 数据怎么来的

```
reference/b1preliminary2020.pdf   Cambridge 官方 PDF（53 页）
        │  pypdf 抽文本
        ▼
reference/raw.txt
        │  parse_pet.py     解析词条 / 短语 / 附录 2 话题
        ▼
reference/pet_entries.json · pet_topics.json
        │  build_words.py   接 ECDICT 生成中文释义 + 频档
        ▼
reference/pet_words.json
        │  emit_words.py    裁剪字段、生成话题中文名
        ▼
src/data-words.js                 构建器读取的数据源
```

### 关于中文释义

主数据来自 [ECDICT](https://github.com/skywind3000/ECDICT)（开源英汉词典，66MB csv）。
直接用会有两个问题，脚本里做了处理：

1. **义项顺序和词性错乱** —— `go` 会给出"打赌/保释金"。解决：按官方词性优先取义，
   并过滤 `[计]`/`[化]` 这类领域标注。
2. **生僻第二义** —— `donkey` → "驴子；笨蛋"、`breeze` → "微风；煤屑"。
   解决：每词最多 2 个义项 + 通用规则剔除结尾的 1–2 字生僻义 + 约 400 条人工覆盖表。

覆盖表在 `reference/build_words.py` 的 `OVERRIDE` 里，改完重跑流水线即可。

### 频档口径

- **核心**（2578）：中考或高考大纲词，或 Oxford 3000 / Collins 3 星以上
- **常考**（251）：语料词频前 25000
- **拓展**（280）：其余大纲内词

这是启发式分档，不是官方 CEFR 标注。`stats.html` 里也写明了。

## 改内容

```bash
# 改语法或题库（手写数据源）
$EDITOR src/data-grammar.js     # 语法族 / 考点 / 易错对比
$EDITOR src/data-quiz.js        # 选择题
$EDITOR src/data-quiz2.js       # 改错题 + 开放填空

# 改词表释义
$EDITOR reference/build_words.py   # OVERRIDE 表
.venv/bin/python reference/build_words.py
.venv/bin/python reference/emit_words.py

# 重新生成站点
node build-site.mjs
```

构建结束会打印数据规模，并在有考点没有对应题目时退出码 1。

## 目录

```
pet-site/
├── build-site.mjs        生成器（页面模板 + 数据内联）
├── assets/
│   ├── style.css         设计系统（亮/暗双主题）
│   └── app.js            运行时：主题/进度/词表/测验/SRS/闪卡/词汇自测
├── src/
│   ├── data-words.js     3109 条词表（自动生成，勿手改）
│   ├── data-grammar.js   语法体系（手写）
│   ├── data-quiz.js      选择题（手写）
│   └── data-quiz2.js     改错 + 填空（手写）
├── reference/            官方 PDF、解析脚本、中间 JSON
└── *.html topics/        构建产物
```

`reference/` 下的 PDF、`raw.txt`、`ecdict.csv`（66MB）不参与运行时，只用于重建数据。

## 部署

已上线 GitHub Pages：

- 线上地址：**https://leverly.github.io/pet-b1-site/**
- 仓库：https://github.com/leverly/pet-b1-site （public，main 分支根目录）
- 平台：GitHub Pages（`main` / `/`），仓库根有 `.nojekyll`

**推送方式**：本机没有 `gh` CLI 和可用 SSH key，token 存在 macOS 钥匙串：

```bash
TOKEN=$(security find-generic-password -s "GitHub - https://api.github.com" -w)
git push "https://leverly:${TOKEN}@github.com/leverly/pet-b1-site.git" main
```

`git remote` 保持干净 URL，token 只在推送命令里临时拼接，不落盘。

**部署注意**：

1. 站点在 `/pet-b1-site/` 子路径下，所有链接必须是相对路径。当前全部相对，
   `topics/` 下用 `../`，已验证线上零 404。
2. `reference/ecdict.csv`（65MB）、`reference/raw.txt`、`.venv/` 已 gitignore，
   不参与部署；提交集约 4.8MB。
3. 数据内联方案让站点完全自包含：线上零外部请求（无 CDN、无字体外链），
   离线双击也一致。

## 已知限制

- 附录 1 的 word sets（数字、星期、月份等封闭清单）没有逐条计入词条总数，
  它们在 CEFR 里属于 "expected to know"，不成体系地收录反而干扰复习节奏。
- 语法考点与题库是按 B1 Preliminary 公开考试说明整理的原创内容，不是官方出版材料。
- 频档是启发式推断，不要当作官方 CEFR 等级判定。
- 记忆数据存在浏览器 localStorage，换浏览器或清缓存会丢失。
