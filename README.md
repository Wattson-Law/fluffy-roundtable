# 🐾 毛茸茸圆桌 · Fluffy Roundtable

> **在这儿刷知乎。刷完乱了，就问它们。**
> *它知道你刚才看了什么，也一直都在。*

知乎黑客松 S3 · 赛道 02（AI × 陪伴与交互）参赛作品。
100% 真实知乎开放平台 API 驱动的「模拟知乎 + 侧边刘看山伴侣小屋」一体式 Web 应用。

---

## 核心体验（五步闭环）

1. **模拟知乎** — 真实热榜 / 站内搜索，点进问题可读真实回答正文、赞同数、权威度与精选评论
2. **静默陪伴** — 展开全文或视口停留 ≥2.5s，右下角刘看山悄悄记下（`readingTrail`，最多 5 篇）
3. **毛茸茸小屋** — 点开刘看山，大光幕拉出你刚刷过的真实帖子，四小只围炉开会
4. **3 分钟最小掌控卡** — 一句话结论 + 今天就能做的一件小事
5. **清醒猫咖手账** — 拍板后解锁主题小猫，连同结论与原帖链接存入 `localStorage`

## 四只圆桌成员

| 角色 | 职责 | 数据源 |
|---|---|---|
| 🐱 呼噜猫 | 先接住情绪，**严禁掺任何建议** | 当前浏览轨迹 |
| 🦉 考据猫头鹰 | 拆解原文、高亮话术陷阱、引站外客观对照 | `ContentText` + `global_search` |
| 🐕 护短柴犬 | 替你吐槽、挖评论区反方声音、重搜端出真实好帖 | `CommentInfoList` + 二次 `zhihu_search` |
| 🦊 刘看山 | 静默陪伴 + 最终收口 + 递出掌控卡 | 全局 |

---

## 本地运行

```bash
cp .env.example .env.local   # 填入 ZHIHU_ACCESS_SECRET
npm install
npm run dev                  # http://localhost:3100
npm run smoke                # 全链路冒烟（56 项）
```

**LLM 为可选增强**：未配置 `LLM_*` 时自动降级为规则引擎，四小只照常开会，Demo 永不白屏。

### 绘本素材（不入 Git）

`public/assets/images/` 与 `public/assets/ip/` 下的 7 个大图受上行带宽限制未入库，缺图不会崩，只是小屋背景与右下角头像裂图。补救方式：

```bash
# 方式 A：本地素材
cp "F:\图片\知乎\毛茸茸圆桌会\*.png" public/assets/images/
unzip -j "F:\图片\知乎\kanshan-three-views.zip" "看山三视图/*.jpg" -d public/assets/ip/

# 方式 B：仓库内已有等价的归档素材
#   assets/images/*.webp（1600×900 压缩版）
#   assets/ip/kanshan-*.jpg（同源刘看山三视图）
```

细节见 [`HANDOVER.md`](HANDOVER.md) §六。

## 架构要点

- **无数据库**（适配知乎 AiWorks）：服务端仅进程内 TTL 缓存，用户数据全在 `localStorage`
- **额度防爆仓**：`hot_list` 15 分钟缓存、搜索 30 分钟缓存、圆桌结果 30 分钟缓存；额度 <15% 自动延长 TTL ×4
- **每轮圆桌最多消耗 2 次搜索额度**（`global_search` ×1 + `zhihu_search` ×1）
- **防幻觉三重保险**：素材编号 `READ_x`/`EXT_x`/`NEW_x` → 引文逐字校验是否为原文子串 → `curatedSources` 由服务端按索引回填真实 URL，LLM 永不生成链接

## 三条台词红线（服务端强制过滤）

1. 永远说「它没在回答你此刻的问题」，**绝不说某篇知乎回答写得烂**
2. 呼噜猫第一句只接情绪，出现「不过/但是/你可以/建议你」即丢弃该条
3. 绝不承诺「剩下的都没问题」

## 目录

```
src/
├── app/
│   ├── page.tsx                      # 模拟知乎 + 侧边刘看山 + 小屋浮层
│   └── api/
│       ├── zhihu/{hot,search,quota}  # 知乎开放平台代理（含缓存与降级）
│       └── roundtable/{analyze,follow-up}
├── lib/
│   ├── zhihu-client.ts               # Bearer + Timestamp 封装、字段归一化
│   ├── cache.ts                      # 进程内 TTL 缓存
│   ├── llm.ts                        # 圆桌编排 Prompt + 防幻觉校验
│   ├── fallback-engine.ts            # 规则兜底引擎（LLM 不可用时独立撑场）
│   └── storage.ts                    # localStorage：轨迹 / 手账
└── components/{zhihu-sim,companion,cabin,journal}/
```

## 仓库归档（策划 · 素材 · 原型）

仓库同时保留项目早期的策划全案、Image2 素材与 HTML 动效原型，均不影响 Next.js 应用运行：

| 路径 | 内容 |
|---|---|
| [`docs/08-项目介绍与素材索引（原 README 归档）.md`](docs/08-项目介绍与素材索引（原 README 归档）.md) | 完整项目介绍、角色设定与素材索引（原仓库首页） |
| [`docs/`](docs/) | 01–07：宣传通稿、策划与技术架构全案、UI 动效指南、分镜与三视图提示词、Galgame 差分立绘、11.16 拉门小屋进度 |
| [`prototypes/`](prototypes/) | 3 个浏览器直接打开的交互动效原型（5 步 Demo / Galgame v1 / 拉门小屋聊天室） |
| [`assets/`](assets/) | 12 张去背多视角透明 PNG、四角色三视图、界面预览、概念图 WebP、刘看山 IP 素材 |

> `.gitignore` 排除了 `assets/` 以外的构建产物；`assets/` 为策划归档，约 45 MB，`git clone` 时可加 `--filter=blob:none` 或 `--depth=1` 加速。

## 进度

- **Phase 1（P0）** ✅ 真实 API 端到端闭环已跑通
- **Phase 2（P1）** 待办：OAuth 登录模块、决断卡图片导出
- **Phase 3（P2）** 待办：AiWorks 公网部署、移动端实测、演示视频
