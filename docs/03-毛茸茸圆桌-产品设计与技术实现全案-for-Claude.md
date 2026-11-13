# 《毛茸茸圆桌 · Fluffy Roundtable》产品设计与技术实现全案（for Claude Opus 5）

> **文档定位**：本报告整合了知乎黑客松 S3 官方赛事规则、官方《技术指南》（飞书文档）、知乎开放平台已核验 HTTP API 契约与项目前期构想，作为 **Claude Opus 5** 端到端构建可上线 MVP 的唯一权威施工蓝图（Single Source of Truth）。
>
> **前序文档说明**：若与仓库早期的 `docs/02-项目策划与技术架构全案.md` 存在命名或形态冲突，**一律以本文档为准**（统一项目名「毛茸茸圆桌 · Fluffy Roundtable」，统一四小只角色，放弃 Chrome 扩展方案，采用“100% 真实知乎 API 驱动的模拟知乎 + 侧边刘看山伴侣小屋”一体式 Web 架构）。

---

## 一、项目核心定位与架构边界（已拍板决策）

1. **产品名称**：**毛茸茸圆桌（Fluffy Roundtable）**
   - Slogan：**「在这儿刷知乎。刷完乱了，就问它们。」** —— *它知道你刚才看了什么，也一直都在。*
2. **参赛赛道**：**赛道 02：社区 × 数字伙伴（AI × 陪伴与交互）**（兼顾赛道 01 知识探索能力，使用官方刘看山 IP 素材）。
3. **产品形态（单页双层一体网站，不做 Chrome 扩展）**：
   - **主区域（模拟知乎冲浪流）**：基于真实知乎开放 API 渲染的轻量沉浸式“深夜知乎”，展示实时热榜、站内搜索结果、真实回答正文片段、赞同数、权威度（`AuthorityLevel`）与精选评论（`CommentInfoList`）。
   - **侧边伴侣小插件（页面右侧 / 右下角）**：常驻一只 2D 手绘风格小刘看山。用户在主区域点击展开、浏览回答时，前端**后台静默记录浏览轨迹（`readingTrail`）**，侧边刘看山仅用微表情与轻角标提示陪伴状态（不弹窗打断阅读）。
   - **毛茸茸小屋（点击刘看山丝滑展开）**：展开篝火旁四只小动物（呼噜猫、考据猫头鹰、护短柴犬、刘看山）与《头脑特工队》式弧形大光幕，直接拉出用户刚刚刷过的真实帖子开围炉夜话，完成情绪接住 → 证据拆解 → 溯源指路 → 决断存档的闭环。
4. **数据真实性红线**：
   - **只用真实的知乎 API 数据，不使用伪造/硬编码的模拟剧本。**
   - 严禁 LLM 在圆桌对话中编造不存在的知乎回答、作者名或链接；所有“引用原句”和“推荐延伸回答”必须可回溯至服务端真实返回的 API `Items`。
5. **无独立数据库架构（兼容知乎 AiWorks 一键托管）**：
   - 根据官方《技术指南》，知乎 **AiWorks 部署暂不支持独立数据库写入**，要求前端 + Node.js 全栈通过静态 JSON / `localStorage` 管理持久化状态。
   - 因此：**服务端不引入 MySQL/PostgreSQL/Redis**，热榜/搜索/圆桌分析缓存使用**服务端进程内 TTL 缓存（可选本地 JSON 预热/只读兜底）**；用户的静默浏览轨迹、当前会话记录与《清醒猫咖手账》全部持久化在浏览器 **`localStorage`**。

---

## 二、赛事规则、评分权重与关键硬约束

### 1. 时间线（2026 年）
- **报名截止**：12 月 4 日 23:59（组队截止：12 月 7 日 10:00，1–5 人/队）。
- **作品提交窗口**：**12 月 5 日 10:00 — 12 月 7 日 10:00**（48 小时窗口期内可修改，截止后不可替换）。
- **初审滚动评分**：12 月 7 日 — 12 月 11 日（知乎各业务线负责人评审，前 15 名晋级）。
- **决赛路演**：12 月 19 日深圳（5 分钟真机 Demo + 3 分钟 Q&A）。

### 2. 评分权重（决定开发优先级）
| 维度 | 初审权重 | 决赛权重 | 对工程与设计的直接要求 |
| :--- | :---: | :---: | :--- |
| **AI 场景价值** | **40%** | **35%** | 紧扣知乎真实冲浪痛点，让业务线评委一眼看出社区生态价值，避免做成通用套壳聊天框。 |
| **创新度** | **25%** | **25%** | “静默陪伴刷帖 → 点开刘看山进小屋对刚看过的帖子开会”的交互范式要鲜明、有画面感。 |
| **完成度** | **25%** | **25%** | 公网 URL 点开即玩（免登录游客路径必须 100% 跑通），真实 API 稳定不报错，无死链、无加载卡死。 |
| **产品体验与设计感** | **10%** | **8%** | 2D 手绘绘本手账美学与清晰可读的“模拟知乎”阅读流自然融合，PC/移动端均可用。 |
| **计划书与演示** | — | **7%** | 配套产品说明计划书，路演 5 分钟流畅演示完整闭环。 |

### 3. 提交与评奖关键要求
- **必交材料**：① 公网可访问体验链接（推荐接入知乎 OAuth；**游客免登必须可用**，如有登录入口需说明测试方式）；② 产品说明计划书。
- **最佳社区人气奖**：12 月 5 日 — 12 月 19 日按活动广场「点赞量 + 使用量 + 评论量」评选（2 支队伍）。因此**一键生成可分享的《清醒决断手账卡》/《知乎冲浪守护兽诊断卡》**极具拉新价值。
- **部署选项**：首选适配 **知乎 AiWorks**（`https://www.zhihu.com/project-square`，前端 + Node.js 全栈、无数据库写入），同时保留 Docker / **腾讯云 CloudBase** 部署兼容性。

---

## 三、核心体验与产品交互设计

### 1. 四只圆桌成员设定（与 `assets/` 视觉统一）

| 角色 | 身份定位 | 职责与发言风格 | 对应数据源 |
| :--- | :--- | :--- | :--- |
| 🐱 **呼噜猫** | 治愈行动官 | **先接住情绪 / 暖场破冰**：温柔、不爹味说教，先把用户“越刷越乱/越看越急”的紧绷感接住。 | 当前浏览轨迹上下文 |
| 🦉 **考据猫头鹰** | 数据考据官 | **拆解原文与客观核查**：高亮你刚看过的帖子原文句段，指出话术陷阱（贩卖焦虑、隐性引流、以偏概全）或核心论点依据，并引入站外客观事实对照。 | 已读帖子 `ContentText` + `AuthorityLevel` + `global_search` |
| 🐕 **护短柴犬** | 踩坑情报员 | **护短指路 / 挖真实声音**：替用户吐槽水帖/情绪噪音，提炼精选评论区里的反方打脸声音，并自动用更精准的关键词重搜知乎，端出 **2–3 篇可点击溯源的真实好回答**。 | `CommentInfoList` + 二次 `zhihu_search` |
| 🦊 **刘看山** | 圆桌主持 & 侧边伴侣 | **静默陪伴与最终收口**：平时蹲在页面侧边静默记录浏览；开会时主持节奏，最后递出**「3 分钟最小掌控卡」**并引导存入《清醒猫咖手账》。 | 全局控制 + 卡片汇总 |

### 2. 自适应圆桌画风（推荐默认设计决策：适配 100% 真实 API 数据）
由于左侧全部使用实时知乎热榜与站内搜索数据，用户浏览的问题可能是**职业/情感焦虑帖**、**消费/人生选择纠结帖**，也可能是**热点吃瓜/硬核科普帖**。为避免硬套单一模板导致出戏，AI 圆桌分析接口在后端自动识别浏览主题并切换三种自适应模式（均遵循同一 JSON 结构输出）：
1. **情绪/焦虑/软广拆解模式**（命中焦虑、上岸、卖课、年龄危机等）：侧重“卸下自责 + 揪出引流/偏差话术 + 同路人实操帖”。
2. **正反决策辩论模式**（命中对比、值不值得、怎么选、利弊）：侧重“梳理高赞正反双方真实底牌 + 站外客观坐标 + 向用户追问 1 个关键取舍维度（如短期现金流 vs 长期复利）再拍板”。
3. **热点吃瓜/硬核科普速览模式**（新闻事件、影视吐槽、纯技术科普）：侧重“快速理清各方立场与时间线 + 剥离情绪带节奏 + 提炼 1 张 3 分钟可带走的认知卡片”。

### 3. 完整用户流（五步闭环）

```text
[1. 进入「模拟知乎」主界面]
    ├─ 默认加载真实知乎热榜（服务端 15 分钟缓存 hot_list）
    ├─ 支持顶部搜索框直接搜索任意纠结问题 / 关键词（调用 zhihu_search）
    └─ （可选 OAuth 登录后）可切换到「我的知乎收藏夹」流直接浏览
           │
           ▼ 点击任意话题，展开该话题下的真实回答列表（zhihu_search 拉取）
[2. 侧边刘看山静默伴侣（不打扰阅读）]
    ├─ 用户每点击展开一篇回答、或某篇回答在视口停留 >= 2.5 秒：
    │    → 自动写入前端 readingTrail（保留最近 3–5 篇，持久化至 localStorage）
    ├─ 侧边刘看山状态切换：
    │    → 0 篇：安静趴在右下角/侧边，轻提示「我在旁边陪你刷，乱了点我」
    │    → 1~N 篇：微表情切换（推眼镜/记笔记），角标更新「已陪你看 N 篇」+ 轻气泡低语
    └─ 点击刘看山悬浮组件 → 平滑打开「毛茸茸小屋」抽屉/浮层
           │
           ▼
[3. 毛茸茸小屋（头脑特工队大光幕 + 篝火围炉）]
    ├─ 顶部「大光幕」：横向陈列用户刚刚刷过的 N 篇真实帖子卡片（带赞同数、作者、权威度角标）
    │  （若用户未点开具体回答就点击刘看山，自动抓取当前列表前 3 篇高赞作为开会素材）
    ├─ 中央「四小只圆桌剧场」：
    │    1) 情绪与水分雷达条（信息纯度 / 焦虑煽动度 / 软广嫌疑信号）
    │    2) 呼噜猫 → 猫头鹰（带真实原文高亮引用卡片）→ 柴犬（带 2~3 篇二次检索真话溯源卡片）→ 刘看山逐轮气泡演绎
    │    3) 如属决策类问题，提供 1 个轻交互追问芯片（用户点选后动态追加刘看山针对性拍板建议）
    └─ 底部「3 分钟最小掌控卡」：一句话结论 + 1 个今天就能试的微动作
           │
           ▼ 点击【我决定了 / 收进清醒手账】
[4. 《清醒猫咖手账》与分享裂变]
    ├─ 解锁一只对应主题配饰的小猫徽章（科技赛博猫 / 职场指南针猫 / 吃瓜护目镜猫等），连同本次结论和原帖链接存入 localStorage
    └─ 支持生成一张纯前端 Canvas/HTML 导出图片《今日清醒决断卡》（OAuth 登录后可额外生成《我的知乎冲浪精神状态 & 守护兽》）
```

---

## 四、知乎开放平台 API 契约与配额架构（已核验）

> **重要工程约束**：以下接口地址、参数大小写与响应字段均已对照本地 `zhihu-cli` 官方参考文档核验。**`zhihu_search` 返回的 `ContentText` 实际上包含大段甚至完整回答文本**，足以支撑左侧“模拟知乎”的真实阅读流，无需虚构数据。

### 1. 通用鉴权 Header
所有服务端对 `https://developer.zhihu.com` 的请求均须在 **Node.js 服务端** 注入（绝不暴露给前端浏览器）：
- `Authorization: Bearer <ZHIHU_ACCESS_SECRET>`
- `X-Request-Timestamp: <Unix 秒级时间戳字符串>`
- `Content-Type: application/json`

### 2. 本项目核心接口清单与缓存策略

| 接口能力 | HTTP 端点 & 参数 | 每日免费额度 | 返回关键字段（已核验） | 本项目用途与防爆仓缓存策略 |
| :--- | :--- | :---: | :--- | :--- |
| **知乎热榜** | `GET /api/v1/content/hot_list?Limit=30` | **100 次/天** | `Data.Items[]`: `Title`, `Url`, `ThumbnailUrl`, `Summary` | 驱动模拟知乎首页热榜流。**必须做服务端内存 15 分钟 TTL 缓存**（全站共享，每天至多消耗 ~96 次）。 |
| **知乎搜索** | `GET /api/v1/content/zhihu_search?Query=...&Count=10` (`Count` 最大 10) | **5,000 次/天** | `Data.Items[]`: `Title`, `ContentType`, `ContentID`, `ContentText`, `Url`, `CommentCount`, `VoteUpCount`, `AuthorName`, `AuthorAvatar`, `AuthorBadge`, `AuthorBadgeText`, `EditTime`, `CommentInfoList[].Content`, `AuthorityLevel` (`1`-`4`), `RankingScore` | **主力双用途接口**：① 点开热榜标题或搜索关键词时，用它拉取真实回答列表渲染左侧“模拟知乎”；② 护短柴犬二次改写关键词找同路人实操帖。**按 `Query` 规范化做 30 分钟服务端缓存**。 |
| **全网搜索** | `GET /api/v1/content/global_search?Query=...&Count=10&SearchDB=all` (最大 20，可用 `Filter` 但**不可传 `host=="zhihu.com"`**) | **5,000 次/天** | 同上（无 `RankingScore`） | 考据猫头鹰在“焦虑/决策/核查”场景中拉取站外权威数据、行业报告与客观事实对照。**按 `Query` 做 30 分钟缓存**。 |
| **额度查询** | `GET /api/v1/quota` (可选 `APIIDs`) | **不耗额度** | `Data[]`: `APIID`, `APIName`, `TotalQuota`, `TotalUsed`, `RemainingQuota` | 开发调试或页面状态监控可用；接近阈值时自动延长缓存 TTL。 |
| **知乎直答** *(可选兜底)* | `POST /v1/chat/completions` (`model`: `zhida-fast-1p5` / `zhida-thinking-1p5` / `zhida-agent`) | **100 次/天** | OpenAI-compatible 响应（含 `reasoning_content`） | **不作为主流程依赖**（防 100 次/天瓶颈），圆桌推理主要使用选手自有 LLM / 看山工作台算力额度。 |
| **OAuth & 用户数据** *(P1 独立模块)* | 见下方 OAuth 专题 | **10,000 次/天** | 关注人、收藏夹、近期收藏、本人创作 | 登录后查看收藏夹并在模拟知乎中浏览，或生成《冲浪精神状态卡》。 |

> **关于 `question_answers` 接口的特别提示**：前期文档曾提及问题回答接口，但当前已核验的 `http-api.md`（2026-07-16）与本地 CLI 尚未列出独立 `question_answers` 端点契约。**工程上请统一以 `zhihu_search`（5,000 次/天，传入热榜完整问题标题作为 `Query`）作为稳定主链路获取该问题下的多篇真实回答**；仅当确认新版 `zhihu-cli` 开放且配额足够时再作可选补充。

### 3. 知乎 OAuth 接入已核验避坑清单（P1 模块严格遵守）
1. **授权跳转**：`GET https://openapi.zhihu.com/authorize?redirect_uri={url_encoded_redirect_uri}&app_id={app_id}&response_type=code`（`redirect_uri` 必须与赛事后台登记完全一字不差）。
2. **回调参数名偏差**：实测回调传回的 Query 参数名是 **`authorization_code`**（而非标准 `code`），服务端回调路由必须兼容 `searchParams.get('authorization_code') || searchParams.get('code')`，再将其作为表单字段 **`code`** 提交给换 Token 接口。
3. **Token 交换**：`POST https://openapi.zhihu.com/access_token`（`Content-Type: application/x-www-form-urlencoded`），参数：`app_id`、`app_key`、`grant_type=authorization_code`、`redirect_uri`、`code`。注意部分接口业务响应里 **`code: 20000` 代表成功**，应以 `access_token` 或目标数据是否存在为准，不要误判 `20000` 为异常。
4. **回调无 `state` 与无 DB 安全存储**：实测知乎授权回调不带回 `state`。在无数据库的 Next.js（AiWorks）架构下，换取到的 OAuth `access_token` **必须加密签名后保存在服务端签发的 `HttpOnly; SameSite=Lax` Cookie 中**，严禁写入前端 `localStorage`、URL 或客户端日志；调用 `/api/v1/user/*` 时由 Next.js Route Handler 读取 Cookie 并同时附带 `Authorization: Bearer <ZHIHU_ACCESS_SECRET>` 与 `X-OAuth-Token: <oauth_access_token>`。
5. **大整数精度**：`GET https://openapi.zhihu.com/user` 返回的 `uid` 为 `int64`（超过 JS `Number.MAX_SAFE_INTEGER`），须先用正则将大整数转为字符串后再 `JSON.parse`。

---

## 五、推荐技术栈与工程架构（Next.js 全栈 + 无数据库）

### 1. 技术选型
- **框架**：**Next.js (App Router) + React + TypeScript**
- **样式与动效**：**Tailwind CSS + Framer Motion**（实现模拟知乎的流畅切换、刘看山微表情与气泡弹性动画、小屋大光幕展开、猫咖图鉴翻牌效果）
- **图标与绘图**：`lucide-react` + 仓库已有绘本素材（复用 `assets/images/*.webp` 与 `assets/ip/*.jpg`，工程初始化时同步至 `public/assets/`）
- **LLM 推理接入**：标准 OpenAI SDK（或 `fetch`）连接兼容接口（支持配置看山工作台 800 美元算力额度端点或其他 OpenAI-compatible 模型），强制 JSON Schema 结构化输出四小只圆桌剧本。

### 2. 建议代码目录结构

```text
fluffy-roundtable/
├── public/
│   └── assets/
│       ├── images/                  # 迁移自 assets/images/（小屋背景、大光幕氛围等）
│       └── ip/                      # 迁移自 assets/ip/（刘看山官方三视图与立绘素材）
├── src/
│   ├── app/
│   │   ├── layout.tsx               # 字体、全局主题（模拟知乎区 + 绘本手账小屋双氛围变量）
│   │   ├── page.tsx                 # 主页面：左侧/主体「模拟知乎」+ 侧边「刘看山」+「毛茸茸小屋」浮层
│   │   └── api/
│   │       ├── zhihu/
│   │       │   ├── hot/route.ts     # GET 热榜（15 分钟进程内存缓存 + 轻分类标签）
│   │       │   ├── search/route.ts  # GET 站内搜索（按问题/关键词拉取真实回答列表 + 30 分钟缓存）
│   │       │   └── quota/route.ts   # GET 额度检查（调试/状态监控）
│   │       ├── roundtable/
│   │       │   ├── analyze/route.ts # POST 传入 readingTrail，执行全网核查+二次站内搜+LLM 生成四小只圆桌剧本
│   │       │   └── follow-up/route.ts # POST 决策追问选择后的刘看山定制拍板回复
│   │       └── auth/zhihu/          # [P1] login / callback / me / favorites 路由
│   ├── lib/
│   │   ├── zhihu-client.ts          # 封装 Bearer + Timestamp 请求、限流保护、错误码映射
│   │   ├── cache.ts                 # 带 TTL 的进程内存缓存（hot_list / search / roundtable）
│   │   ├── llm.ts                   # 圆桌 Multi-Agent 编排 Prompt、严格事实溯源校验（防幻觉）
│   │   └── storage.ts               # 前端 localStorage 封装：readingTrail、journalCats、decisionHistory
│   ├── types/
│   │   └── index.ts                 # ZhihuItem、ReadingTrailItem、RoundtableScript、JournalEntry 类型定义
│   └── components/
│       ├── zhihu-sim/               # 模拟知乎阅读流组件
│       │   ├── TopSearchBar.tsx     # 顶部仿知乎极简导航（热榜/搜索/我的收藏/手账入口）
│       │   ├── HotFeedList.tsx      # 实时热榜卡片流
│       │   ├── QuestionDetail.tsx   # 问题详情页：真实回答列表（作者/认证/赞同/权威度/长正文/精选评论）
│       │   └── AnswerCard.tsx       # 单篇回答卡片（负责曝光计时 & 展开全文时触发静默记录）
│       ├── companion/               # 侧边刘看山伴侣小插件
│       │   └── KanshanDock.tsx      # 右下角/侧边常驻刘看山（微表情、计数角标、轻气泡低语、呼出小屋）
│       ├── cabin/                   # 毛茸茸小屋与圆桌剧场
│       │   ├── CabinModal.tsx       # 篝火小屋主容器（大光幕 + 圆桌舞台 + 底部掌控卡）
│       │   ├── BigScreenTrail.tsx   # 《头脑特工队》式弧形大光幕（展示刚刷过的 N 篇真实帖子）
│       │   ├── AnimalStage.tsx      # 四只小动物逐轮对话演绎 + 情绪雷达进度条 + 高亮原文引用
│       │   ├── SourceTrailCards.tsx # 柴犬端出的 2~3 篇真实可点击溯源回答卡
│       │   └── ControlCard.tsx      # 3 分钟最小掌控感卡片 & 【我决定了】入账按钮
│       └── journal/                 # 《清醒猫咖手账》抽屉与分享卡
│           ├── CatJournalDrawer.tsx # 已收集小猫图鉴与历史决断存档
│           └── ShareCardModal.tsx   # 纯前端生成的决断/精神状态分享图
├── .env.example                     # 环境变量模板（ZHIHU_ACCESS_SECRET, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL...）
└── next.config.ts
```

### 3. 核心防幻觉与输出 JSON Schema 设计（关键工程约束）
在 `POST /api/roundtable/analyze` 中，后端接收前端传来的 `readingTrail`（最多 5 篇用户刚在模拟知乎中看过的真实帖子），执行以下流水线：
1. **并发补充真实外部素材**：
   - 提取 `readingTrail` 的核心问题主题与争议关键词，并发调用：
     - `global_search`（最多 1 次，拿 5 条站外新闻/权威报告给猫头鹰对照）；
     - `zhihu_search`（最多 1 次，换用更实操/避坑向关键词如 `"<主题> 避坑 真实经验"` 或 `"<主题> 复盘"`，拿候选池给护短柴犬挑选 **不在用户已读列表中的新回答**，优先挑 `AuthorityLevel >= 3` 或高赞真实经验）。
2. **输入构造与严格编号**：
   - 将用户已读帖子按 `[READ_0]`, `[READ_1]`... 编号，站外素材按 `[EXT_0]`... 编号，柴犬候选池按 `[NEW_0]`... 编号喂给 LLM。
3. **强制 LLM 输出结构化 JSON（并做服务端校验）**：
   ```ts
   interface RoundtableResult {
     mode: 'anti_anxiety' | 'decision_debate' | 'topic_digest';
     topicTitle: string;
     radar: {
       drynessScore: number;      // 干货密度 0-100
       anxietyScore: number;      // 情绪煽动/含焦量 0-100
       adRiskScore: number;       // 软广/引流嫌疑 0-100
       summaryTag: string;        // 一句话标签，如 "贩卖焦虑高发 · 建议脱水"
     };
     dialogues: Array<{
       speaker: 'purr_cat' | 'owl' | 'shiba' | 'kanshan';
       mood: 'warm' | 'glasses' | 'angry_protect' | 'calm' | 'happy';
       text: string;              // 简短口语化台词（<=120字，禁止爹味说教）
       quoteRef?: {
         sourceTag: string;       // 必须是真实传入的 "READ_0" / "EXT_0" 等
         excerpt: string;         // 必须为原文真实子串，服务端校验
         reason: string;          // 为何高亮这句（如 "文末引流钩子" / "无数据恐吓"）
       };
     }>;
     curatedSourceTags: string[]; // 必须从 "NEW_x" 编号中挑选 2~3 个，由服务端映射回真实 Title/Author/Url/VoteUpCount
     followUpQuestion?: {         // 仅在 decision_debate 或需要取舍时生成
       prompt: string;
       choices: Array<{ id: string; label: string }>;
     };
     controlCard: {
       oneLineTakeaway: string;   // 一句话真相/结论
       microAction: string;       // 今天 3 分钟能做的一件具体小事
       catBadgeTheme: 'cyber_gpu' | 'compass_orange' | 'goggles_calico' | 'cocoa_ragdoll';
       catBadgeName: string;      // 解锁小猫名，如 "背着指南针的橘猫侦探"
     };
   }
   ```
   - **服务端硬校验**：`curatedSourceTags` 由后端直接按索引映射回 API 原始对象的 `Url`、`Title`、`AuthorName`、`VoteUpCount`，**绝不允许 LLM 自己生成 URL**；若模型返回异常或超时，自动降级为基于 `VoteUpCount` 与 `AuthorityLevel` 的规则摘要兜底，保证 Demo 永远不白屏报错。

---

## 六、视觉美学与双氛围 UI 规范

1. **视觉反差与层次感（核心亮点）**：
   - **底层（模拟知乎区）**：采用干净熟悉的知乎社区信息流质感（纯白/浅灰底、知乎蓝 `#1772F6` 主操作与 `▲ 赞同` 角标、清晰的作者头衔与回答长文排版），让用户和评委一秒产生“我真的在刷知乎”的代入感。
   - **侧边刘看山 + 毛茸茸小屋（陪伴层）**：切换到手绘温暖绘本风——深苔藓绿/暖夜蓝夜色背景（`#142126` / `#1D2D35`）搭配奶油色水彩纸卡片（`#FFF8EB`）与篝火暖橘点缀（`#F59E0B`），与冰冷的信息流形成“从喧嚣信息流躲进篝火小屋”的情感反差。
2. **图片素材合规与加载**：
   - 现有 `assets/images/*.webp` 与 `assets/ip/*.jpg` 直接用于小屋背景、刘看山头像/立绘与开场引导；对于知乎接口返回的 `AuthorAvatar` / `ThumbnailUrl`，须在前端配置防盗链策略（`<img referrerPolicy="no-referrer" />` + 默认占位头像 fallback），防止外链图片在浏览器端 403 裂图。
3. **响应式布局**：
   - **PC 宽屏**：左侧模拟知乎阅读流（最大宽度 `840px` 居中/偏左），右下角悬浮刘看山（点击后从右侧滑出 `520px–600px` 宽的毛茸茸小屋，或展开居中剧场浮层，保留左侧隐约可见的知乎背景以强化“陪你看帖”感）。
   - **移动端（活动广场扫码/手机拉票重点）**：右下角悬浮精巧刘看山圆形按钮（带未读数角标），点击后平滑弹出全屏毛茸茸小屋，内部支持上下滑动看大光幕与小动物气泡。

---

## 七、分阶段实施排期（对标 12.05 提交截止）

### Phase 1（P0 核心必达：跑通真实 API 端到端闭环）
- [ ] 初始化 Next.js + TypeScript + Tailwind + Framer Motion 工程，迁移 `assets/` 至 `public/assets/`，配置 `.env.example` 与严格防泄露 `.gitignore`。
- [ ] 实现 `/api/zhihu/hot` 与 `/api/zhihu/search`（含 15 分钟/30 分钟服务端缓存与降级兜底）。
- [ ] 完成模拟知乎界面：实时热榜列表、顶部搜任意问题、点击问题进入真实回答阅读流（展示 `ContentText`、`VoteUpCount`、`AuthorityLevel`、`CommentInfoList` 及原帖链接）。
- [ ] 完成**静默浏览记录器**：点击展开/停留阅读自动写入 `readingTrail`（`localStorage`），并在侧边 `KanshanDock` 实时显示陪伴计数与轻气泡状态。
- [ ] 实现 `/api/roundtable/analyze` 后端流水线（`readingTrail` + `global_search` + 二次 `zhihu_search` + LLM 结构化输出 + 服务端链接溯源映射）及 `CabinModal` 完整演绎（大光幕 + 雷达 + 四小只冒泡 + 3 分钟掌控卡）。

### Phase 2（P1 体验拔高与赛事加分项）
- [ ] 完成《清醒猫咖手账》侧栏/弹窗与《今日清醒决断卡》前端图片导出（助推社区人气奖）。
- [ ] 接入**知乎 OAuth 登录**独立模块（兼容 `authorization_code`、`20000` 业务码、`int64 uid` 字符串化、`HttpOnly` Cookie），登录后可在模拟知乎顶部多出一个「我的收藏夹」Tab（直接把吃灰收藏夹拉进小屋脱水），并解锁《冲浪精神状态 & 守护兽》诊断卡。
- [ ] 对决策类问题补齐 `follow-up` 1 步互动追问体验；完善无结果/网络抖动/API 限流时的优雅兜底提示。

### Phase 3（P2 提交前验收与部署上线）
- [ ] 在 **AiWorks** 或 CloudBase 完成真实公网部署验证（确认零数据库依赖下 `localStorage`、缓存、OAuth 回调地址、图片 `no-referrer` 均正常）。
- [ ] 手机浏览器实测响应式体验 + 10 秒游客免登冷启动实测。
- [ ] 更新仓库 `README.md` 反映最终代码架构，录制 5 分钟演示视频并撰写正式《产品说明计划书》。

---

## 八、给 Claude Opus 5 的执行前自检清单

1. **先读现有文件**：动工前先核对根目录 `.gitignore`、`.gitattributes` 以及 `assets/images/`、`assets/ip/` 实际文件名。
2. **禁止数据库写入依赖**：不要引入 Prisma / SQLite 写入文件 / Postgres，确保在纯前端 + 无状态 Node.js（AiWorks）环境可直接运行。
3. **环境变量隔离**：严禁把真实的 `ZHIHU_ACCESS_SECRET`、`LLM_API_KEY` 或 `app_key` 提交进 Git 仓库。
4. **严格验证真实数据**：模拟知乎和圆桌中的所有回答内容、赞同数、作者与链接均须来自知乎 API 实时返回（可做短时内存缓存），严禁造假数据。
5. **编码与中文环境**：在 Windows 下操作或提交脚本时统一使用 UTF-8（无 BOM），避免出现乱码。
