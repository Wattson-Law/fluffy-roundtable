# 毛茸茸圆桌 · 工作交接文档

> **最近交接**：2026-11-24（下方 Phase 1 为历史记录）
> **当前阶段**：「先听懂，再接话」第一轮已接入正式小屋；原句书签和文章导读保留。五人试用尚未进行。
> **工程位置**：`D:\fluffy-roundtable`
> **产品总设计稿 v1.0**：[先听懂，再接话](docs/superpowers/specs/2026-11-24-intent-first-cabin-design.md)（标签 `design-v1.0`）。新的对话、记忆、角色分工与验收标准以此为准。
> **历史技术参考**：[早期产品设计与技术实现全案](docs/03-毛茸茸圆桌-产品设计与技术实现全案-for-Claude.md)；不覆盖总设计稿。现役功能以 README 和已通过的验证为准。

---

## 2026-11-24 · 第一轮：读者改口，下一句就变

- [技术路线](docs/superpowers/plans/2026-11-24-intent-first-iteration.md) · [实际界面、验证方法和五人试用提纲](docs/intent-first/README.md)。新的需求以总设计稿为准；下文按日期保留各次交付时的状态。
- 文章导读沿用已有的逐字引文；读者输入后属于自由对话，不恢复被打断的导读。`turn-intent.ts` 读取本轮和本桌最近的需求线索；`turn-reply.ts` 决定回应与同篇证据。窗边随聊可以没有文章，不调用模型、不传私聊。旧文章桌继续可读。
- 收起小屋、开始输入都会让迟到的发言让位。屋外邀请先挂起，接受后才写入聊天；旧版本中已经写好的便签只显示一次。「七天」仍是本版限制，不当成共享关键记忆的正式规则。
- 下一步先匿名试用，区分「听错需求」和「语气不合适」；再做会话阅读分离、可纠正/遗忘的长期记忆与站内旁听。此次无新画稿，无线上部署变更。

## 2026-11-22 · 从「聊这篇」到「聊这一句」

- 阅读卡支持原生划选及无须拖动的「逐句挑选」。整篇对话保留旧 URL 键，选句对话另按来源、原文位置和摘录标识。同一句在不同位置、不同文章里的书签不会串桌。
- 书签中的 `start` 是原文位置；发给正式分析的 `focus.start` 则是**截取后的正文**内的位置。只在正文精确匹配时接受；缓存区分不同书签。试读仍完全本地。书签可从阅读记录、小屋、手账回看；正文不在时如实显示夹签时的短摘，不需要为找一句话上传阅读历史。
- 呼噜猫不在读者划选、输入或查看原段时打扰。已拍板或明确表示聊完不再发便签。原有 5 分钟、24 小时和七天边界不变；原始美术、离线原型和转场继续保留。
- [复验方式、真实内容与模拟边界、五人试用提纲](docs/sentence-bookmarks/README.md)。本轮不变更在线服务凭据或部署。

## 2026-11-21 · 正式页面接入阅读、聊天与主动便签

正式首页已接入 V6.1 的水彩小屋、窗沿和单角色发言立绘，书架使用 V1 动作图。下方 11 月 20 日的离线目标原型及原始素材全部保留。实际功能、体验入口和隐私边界以 [README 的正式应用章节](README.md#正式应用看山伴读与猫猫便签) 为准。

- `fr.readingHistory.v1` 存最近 100 篇阅读；老 `fr.readingTrail`（最近 5 篇真实阅读）仍可迁移。每轮上下文在开屋时确定；不同文章分别存进度，真实内容与本地试读不混用。
- `fr.companion.v1` 保存小屋的聊天、位置、卡片选择与猫的便签开关。最近 16 个话题各有最多 72 条发言；只有输入过文字的用户才会收到基于聊天的便签。检查前台状态、草稿、免打扰、同一轮去重及全局冷却。浏览器关掉后不发送。
- `fr.journalCats` 仍只在用户拍板后写入；重复点击不会重复建卡。打开真实圆桌仍走原有的分析、逐字引文与知乎溯源，不把测试对白当作在线回答。
- `/?sample=weekend-notebook` 和 `/?sample=two-bookmarks` 是本地编辑室的原创试读。实时服务未配置时可直接走完整交互；不产生虚构的知乎搜索、评论或投票，也不提交试读内容给模型。

## 本次设计交接 · 2026-11-20

[目标原型 V6.1：体验入口、素材与实现说明](docs/visual-target-v6.1/README.md)。从右下角书写的看山、伙伴入场，到轮流发言、插话和收卡，均可离线走通。单独对齐发言时，用预览地址末尾的 `#portraits`：一人一张立绘，气泡不闪，同一角色续话不重播。

正式应用启动后可访问 `/previews/roundtable-v6.1/index.html`。原型的文章、台词与手账仅供演示；接入正式前端时保留原有的阅读轨迹、引文校验、真实数据接口和正式手账存储。下文 Phase 1 记录仍指正式应用，不是这套原型的验收。

**素材保留约定：** 四角色原始三视图、窗沿到小屋的动画和聊天参考截图均见[原始美术与动效](assets/README.md)。后续迭代另存新版本，不删除、覆盖或移动现有图片和动画。

## 一、30 秒快速上手

```bash
cd D:\fluffy-roundtable
npm install          # 依赖已在，通常可跳过
npm run dev          # http://localhost:3100
npm run smoke        # 全链路冒烟（56 项，当前 56/56 通过）
npm run build        # 生产构建（已验证通过）
npx tsc --noEmit     # 类型检查（当前零错误）
```

**环境变量**：`.env.local`（已 gitignore，不进仓库）
- `ZHIHU_ACCESS_SECRET` —— **已由系统环境提供并实测连通**，9 项额度满血
- `LLM_*` —— 已配置但**当前不可用**（见 §五-1）

---

## 二、项目是什么

**一句话**：100% 真实知乎 API 驱动的「模拟知乎 + 侧边刘看山伴侣小屋」一体式 Web 应用。

**Slogan**：在这儿刷知乎。刷完乱了，就问它们。 —— *它知道你刚才看了什么，也一直都在。*

**赛道**：知乎黑客松 S3 · 赛道 02（AI × 陪伴与交互）

### 核心立论（护城河）

> 陪伴不是陪聊，陪伴是它亲眼看着你刚刚刷过了哪些让你破防的帖子，你开口时不用再从头解释一遍。

这句话决定了所有设计取舍。活动广场上的桌宠类作品没有一个能说出这句话——因为只有嵌在真实知乎数据流里的作品才配说。

### 五步闭环

```
1. 模拟知乎    真实热榜 / 站内搜索 → 点进问题读真实回答（正文/赞同/权威度/精选评论）
2. 静默陪伴    展开全文 或 视口停留 ≥2.5s → 写入 readingTrail（最多 5 篇，localStorage）
               右下角刘看山角标跳动 + 轻气泡低语，绝不弹窗打断阅读
3. 毛茸茸小屋  点刘看山 → 大光幕拉出刚刷过的真实帖子 → 四小只围炉开会
4. 掌控卡      3 分钟最小掌控卡：一句话结论 + 今天就能做的一件小事
5. 猫咖手账    拍板 → 解锁主题小猫，连同结论与原帖链接存入 localStorage
```

### 四只圆桌成员

| 角色 | 职责 | 数据源 |
|---|---|---|
| 🐱 呼噜猫 | 先接住情绪，**严禁掺任何建议** | 当前浏览轨迹 |
| 🦉 考据猫头鹰 | 拆解原文、高亮话术陷阱、引站外客观对照 | `ContentText` + `global_search` |
| 🐕 护短柴犬 | 替你吐槽、挖评论区反方声音、重搜端出真实好帖 | `CommentInfoList` + 二次 `zhihu_search` |
| 🦊 刘看山 | 静默陪伴 + 最终收口 + 递出掌控卡 | 全局 |

**它们不是四种性格，是同一句话的四个声部**：呼噜猫给结论（"不是你的问题"）、猫头鹰给证据、柴犬给补偿、刘看山给兜底。猫头鹰的理性不是来跟猫猫的温柔唱反调的，**它是来给那句温柔撑腰的**。

---

## 三、已完成（Phase 1 / P0 全部 5 项）

| 蓝图条目 | 状态 |
|---|---|
| Next.js + TS + Tailwind + Framer Motion 工程，素材迁入 `public/assets/`，`.env.example` + 防泄露 `.gitignore` | ✅ |
| `/api/zhihu/hot`（15min 缓存）与 `/api/zhihu/search`（30min 缓存）含降级兜底 | ✅ |
| 模拟知乎：热榜 → 搜索 → 真实回答阅读流 | ✅ |
| 静默浏览记录器 + `KanshanDock` 计数角标与轻气泡 | ✅ |
| `/api/roundtable/analyze` 完整流水线 + `CabinModal`（大光幕 + 雷达 + 四小只 + 掌控卡） | ✅ |

### 验证状态

- TypeScript：**零错误**
- 生产构建：**通过**
- 全链路冒烟：**56/56 通过**（`npm run smoke`）

### 实测数据（真实 API）

| 项 | 实测值 |
|---|---|
| 热榜 | 30 条真实数据，命中 15 分钟缓存 |
| 单篇回答正文 | 最长 **1114 字**（`ContentText` 确实返回大段正文，无需任何虚构数据） |
| 权威度 | Lv.4 真实可用 |
| 精选评论 | `CommentInfoList` 真实可用 |
| 额度 | `zhihu_search` 5000/5000 · `global_search` 5000/5000 · `hot_list` 100/100 |
| 圆桌首次分析 | 1128ms |
| 相同轨迹二次请求 | 15ms（命中缓存） |
| 每轮圆桌额度消耗 | **仅 2 次**搜索（`global_search`×1 + `zhihu_search`×1） |

---

## 四、关键工程约束（改代码前必读）

### 1. 数据真实性红线

**只用真实知乎 API 数据，不使用任何伪造/硬编码剧本。**

> ⚠️ 历史教训：前一版工程（`D:\pawtable`，已废弃）用了预置剧本快照，被新蓝图 §1.4 明确否定。不要走回头路。

### 2. 防幻觉三重保险（最核心的工程资产）

```
① 素材强制编号  READ_x（用户已读）/ EXT_x（站外）/ NEW_x（柴犬候选池）
② 引文逐字校验  excerpt 必须是原文真实子串，normalize 后 includes 检查，不通过即丢弃
③ URL 服务端回填 curatedSources 按 NEW_x 索引映射回真实对象，LLM 永不生成任何 URL
```

实现位置：`src/lib/llm.ts` 的 `verifyQuote()` / `sanitizeDialogues()`，以及 `analyze/route.ts` 的 tag→对象映射。

### 3. 三条台词红线（服务端强制过滤，不是建议）

| # | 规则 | 实现 |
|---|---|---|
| 1 | 永远说「它没在回答你此刻的问题」，**绝不说某篇知乎回答写得烂** | `sanitizeDialogues` 正则过滤 |
| 2 | 呼噜猫第一句只接情绪，出现「不过/但是/你可以/建议你」即丢弃该条 | 同上 |
| 3 | 绝不承诺「剩下的都没问题」 | 同上 |

**红线 1 是全场最重要的措辞**：一句之差，产品从"内容质检员"变成"帮你匹配处境的人"。前者得罪知乎生态，后者是生态的增量——这在知乎业务线评委面前是生死线。

### 4. 无数据库（适配 AiWorks）

- 服务端**仅**进程内 TTL 缓存，不引入 MySQL/PostgreSQL/Redis，不写本地文件
- 用户数据全在 `localStorage`：`fr.readingTrail` / `fr.journalCats`
- **OAuth token 严禁写入 localStorage**，只走 HttpOnly Cookie

### 5. 知乎 API 已核验契约（踩过的坑）

```
参数名必须 PascalCase：Query / Count / Limit
  小写 q、keyword 一律返回 Code 10001 "Query is required"

响应信封：{ Code, Message, Data }，Code 0 为成功
  Data.Items[] 才是列表，字段也是 PascalCase

字段名：Title / ContentText / Summary / AuthorName / VoteUpCount
       AuthorityLevel（注意是字符串 "1"-"4"）/ CommentInfoList[].Content

zhihu_search 的 Count 最大 10
global_search 的 Filter 不可传 host=="zhihu.com"
hot_list 只返回 Title/Url/ThumbnailUrl/Summary（无作者无正文）
```

### 6. 额度防爆仓

- `hot_list` 100 次/天 → **15 分钟缓存**（每天至多 ~96 次）
- 搜索各 5000 次/天 → **30 分钟缓存**
- 圆桌结果 → **30 分钟缓存**（相同轨迹秒出）
- 任一主力接口剩余 <15% → `setTtlMultiplier(4)` 自动延长 TTL

### 7. 图片防盗链

知乎 CDN 返回的 `AuthorAvatar` / `ThumbnailUrl` 必须：
```tsx
<img referrerPolicy="no-referrer" onError={隐藏或占位} />
```
`next.config.ts` 已设 `images.unoptimized = true`，不要改回 `next/image` 优化。

---

## 五、当前已知问题（交接重点）

### 1. 🔴 LLM 未接通 —— OpenCode 账户余额为 0

**现状**：四小只台词目前由**规则引擎**生成，逻辑正确、引用真实、红线都守住，但措辞固定。

**排查结论**（已穷尽测试，不是代码问题）：

| 测试项 | 结果 |
|---|---|
| `GET /models` | **200** ✅ 鉴权完全正常 |
| `kimi-k3` / `deepseek-v4.1-flash` 标准调用 | 402 Insufficient balance |
| 换 `/inference/v1` 路径 | 402（同样） |
| `stream: true` / `/responses` / `max_tokens:1` | 402（同样） |
| 全部 6 个 `-free` 模型 | 429 Free usage limit reached |
| 换第二把 key 重测 | **完全相同**，且报错指向**同一组织 ID** |

**根因**：额度绑定在组织 `org_01M4E5RR9TG176SBZ10QET86N3` 上而非 key 上，该组织付费余额为 0、免费配额耗尽。免费模型报错明示 *"Free models work in OpenCode"* —— 免费档面向客户端内使用，API 直连不享受。

**已做的准备**（接上即用，零改码）：
- 模型 ID 已更正为 `deepseek-v4.1-flash`（原 `deepseek4.1 flash` 不存在）
- 新增 `LLM_MODEL_FALLBACKS`，主模型 402/429 时按序自动降级
- 失败原因如实显示在小屋底部（"LLM 额度/限流暂不可用，已自动切换规则引擎"），**不假装用了 LLM**
- LLM 输出未通过红线/溯源校验（台词 <4 条）时也会标注并回退

**建议**：优先用赛事官方的**看山工作台 800 美元算力额度**（对口且免费），而不是自掏腰包充 OpenCode。拿到后只需填 `.env.local` 三项并重启。

### 2. 🟡 UI 未经实际渲染验证

Playwright 浏览器 MCP 通道在本次会话后半程持续报 `unhandled errors in a TaskGroup`，**我始终未能亲眼看到页面**。

- 服务端 SSR 输出已验证完整（标题、知乎导航、热榜区块、手账入口、刘看山立绘路径均在）
- 但配色对比度、留白、移动端适配、大光幕弧形感**均未经视觉确认**
- 色值取样来自对 `public/assets/images/` 四张绘本素材的分析，非实际渲染

**接手后第一件事建议**：打开 http://localhost:3100 肉眼过一遍，重点看
- 小屋深色背景上的文字对比度（最没把握的一项）
- 右下角刘看山的存在感（会不会太抢戏或太弱）
- 热榜列表信息密度
- 大光幕弧形透视效果

### 3. 🟡 蓝图与实际素材的差异

蓝图 §5.2 写 `assets/images/*.webp`，实际是 **4 张 `.png`**；`assets/ip/` 是解压出的 **3 张 `.jpg`** 刘看山三视图。已按实际文件名接入，路径见 §六。

---

## 六、代码地图

```
D:\fluffy-roundtable\
├── public/assets/
│   ├── images/   fluffy-roundtable-{campfire-2d-v3, hq-backview, screen-meeting, snow-topdown}.png
│   │             └─ hq-backview 用作小屋背景（过肩弧形光幕视角，最贴「头脑特工队控制室」）
│   └── ip/       33f11967...jpg（用作 KanshanDock 头像）+ 另两张三视图
├── src/
│   ├── app/
│   │   ├── page.tsx                    主页面：串起五步闭环的全部状态
│   │   ├── layout.tsx / globals.css    双氛围样式（zh-* 知乎区 / cabin-* 小屋区）
│   │   └── api/
│   │       ├── zhihu/{hot,search,quota}/route.ts
│   │       └── roundtable/{analyze,follow-up}/route.ts
│   ├── lib/
│   │   ├── zhihu-client.ts    Bearer+Timestamp 封装、字段归一化、信封解析
│   │   ├── cache.ts           进程内 TTL 缓存 + 额度紧张自动延长
│   │   ├── llm.ts             圆桌 Prompt、模式识别、雷达、防幻觉校验、模型降级链
│   │   ├── fallback-engine.ts 规则兜底引擎（LLM 不可用时独立撑全场）
│   │   └── storage.ts         localStorage：readingTrail / journalCats
│   ├── types/index.ts         ZhihuItem / ReadingTrailItem / RoundtableResult 等
│   └── components/
│       ├── zhihu-sim/   TopSearchBar · HotFeedList · QuestionDetail · AnswerCard
│       ├── companion/   KanshanDock（侧边静默陪伴）
│       ├── cabin/       CabinModal · BigScreenTrail · AnimalStage · ControlCard
│       └── journal/     CatJournalDrawer
└── scripts/smoke.mjs    全链路冒烟 56 项
```

### 关键文件说明

**`src/lib/fallback-engine.ts`** —— 这是 Demo 永不白屏的保险。LLM 挂了它独立产出完整五拍台词，所有引文同样走逐字抽取。改 LLM 相关逻辑时务必同步检查这里。

**`src/app/api/roundtable/analyze/route.ts`** —— 主流水线。先算好兜底结果，LLM 成功才覆盖；LLM 失败/输出不合格则保留兜底并在 `meta.note` 如实记录原因。

**`src/lib/llm.ts` 的 `detectMode()`** —— 三种自适应模式（§3.2）的入口。实测：焦虑+卖课 → `anti_anxiety`、对比取舍 → `decision_debate`、热点事件 → `topic_digest`，三者均已验证。

---

## 七、下一步（Phase 2 / P1）

按蓝图 §7 排期，优先级从高到低：

### 1. 🔴 知乎 OAuth 登录模块（硬阻塞项，建议最先做）

**为什么最优先**：风险全在审批和网络，不在编码。域名要公网可达、`redirect_uri` 要在赛事后台登记且一字不差。**建议尽早部署一个空壳页面把全链路跑通一次**，哪怕前端还是白板。

必须遵守的四个坑（蓝图 §4.3，已核验）：
```
① 回调参数名是 authorization_code（非标准 code）
   → searchParams.get('authorization_code') || searchParams.get('code')
   → 换 Token 时再作为表单字段 code 提交

② Token 交换 POST https://openapi.zhihu.com/access_token
   Content-Type: application/x-www-form-urlencoded
   参数：app_id / app_key / grant_type=authorization_code / redirect_uri / code
   注意：部分响应 code: 20000 代表成功，不要误判为异常

③ 回调不带 state，且无数据库
   → access_token 必须加密签名后存 HttpOnly; SameSite=Lax Cookie
   → 严禁写入 localStorage / URL / 客户端日志

④ /user 返回的 uid 是 int64，超过 MAX_SAFE_INTEGER
   → 必须先用正则把大整数转字符串再 JSON.parse
```

需要的环境变量：`ZHIHU_OAUTH_APP_ID` / `ZHIHU_OAUTH_APP_KEY` / `ZHIHU_OAUTH_REDIRECT_URI` / `OAUTH_COOKIE_SECRET`（`.env.example` 已留位）

登录后解锁：顶部「我的收藏夹」Tab（把吃灰收藏夹直接拉进小屋脱水）+《冲浪精神状态 & 守护兽》诊断卡。

### 2. 🟡 《今日清醒决断卡》前端图片导出

纯前端 Canvas/HTML 导出，**不依赖服务端**。直接关系「最佳社区人气奖」（12/05–12/19 按点赞+使用+评论量评选），是拉新裂变的核心抓手。

### 3. 🟡 LLM 接入验证

拿到可用额度后填 `.env.local` 重启即可。接上后务必重跑 `npm run smoke`，确认 LLM 路径下三条红线仍然守住（冒烟脚本 §5 专门验这个）。

### 4. 🟢 Phase 3 收尾

- AiWorks / CloudBase 公网部署（确认零数据库依赖下 localStorage、缓存、OAuth 回调、图片 no-referrer 均正常）
- 手机浏览器实测响应式 + 10 秒游客免登冷启动
- 5 分钟演示视频 + 《产品说明计划书》

---

## 八、赛事硬节点

| 时间 | 事项 |
|---|---|
| **12/04 23:59** | 报名截止 |
| 12/07 10:00 | 组队截止 |
| **12/05 10:00 – 12/07 10:00** | 作品提交窗口（48h 内可改，截止后不可替换） |
| 12/07 – 12/11 | 初审滚动评分，前 15 名晋级 |
| **12/19** | 深圳决赛路演（5 分钟真机 Demo + 3 分钟 Q&A） |

**必交材料**：① 公网可访问体验链接（**游客免登必须 100% 跑通**）② 产品说明计划书

**评分权重**：AI 场景价值 40%／创新度 25%／完成度 25%／设计感 10%

---

## 九、决赛问答预案

| 评委可能问 | 怎么答 |
|---|---|
| 你凭什么判断一篇回答没价值？ | 我们不判断价值，只判断**它有没有在回答这位用户的问题**。判定拆成正交的封闭问题，每条结论都挂原文片段，可点击溯源。 |
| 那个分数怎么算的？ | 雷达三项基于真实文本特征统计（证据密度/情绪词/引流词命中），不是模型臆测。关键证据一律给原文句子而非百分比。 |
| 会不会误伤优质内容？ | 判据宁可漏判不可错判，且所有判定只在对话内部表述为"没在回答你"，不在列表公开挂标。我们也从不声称"剩下的都没问题"。 |
| 这和普通桌宠/多 Agent 聊天有什么区别？ | **它知道你刚才看过什么。** 这是只有嵌在真实知乎数据流里的作品才能说的话。 |
| 额度扛得住公开拉票吗？ | 主链路只走 5000/天的两个搜索接口，热榜 15 分钟缓存，每轮圆桌仅消耗 2 次额度，有 quota 监控与自动延长 TTL。 |

---

## 十、给接手者的三句话

1. **先跑 `npm run smoke`**，56/56 通过说明环境和真实 API 都正常，再动代码。
2. **动 LLM 相关逻辑时，同步检查 `fallback-engine.ts`** —— 它是 Demo 不白屏的最后一道保险。
3. **三条台词红线是产品的命门，不是文案偏好**。尤其红线 1（绝不贬低知乎回答），它决定了这个产品在知乎评委眼里是生态的增量还是敌人。
