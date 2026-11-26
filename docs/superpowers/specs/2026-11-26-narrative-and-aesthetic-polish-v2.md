# 毛茸茸圆桌 · 第二轮项目叙事与前端审美精修规格

> 日期：2026-11-26  
> 适用仓库：`D:\fluffy-roundtable`（当前分支 `feat/pet-model-dialogue`，基于第一轮改造）  
> 目标范围：正式首页 `/`、窗边试聊 `/trial`、离线试聊包 `docs/reader-trial/window-seat.zip` 共用同一套小屋与书架视觉语言；**只改 `D:\fluffy-roundtable`，绝不触碰 `F:\AI解决方案\AI生成工艺检索`，绝不删除/覆盖原有画稿与归档资源**。

---

## 一、深度审阅发现（基于全链路实机截图走查）

第一轮虽然把「窗边第五席」的透视水彩圆桌搭稳了，但走查桌面与手机全流程截图（首页 → 阅读 → 入座 → 对白 → 引文 → 掌控卡 → 拍板 → 猫咖手账 → 伙伴名册）后，仍存在 **5 处叙事断层** 与 **6 处审美割裂**：

### 1.1 项目叙事上的 5 处断层
1. **核心护城河在首页说得太浅**：Hero 文案“读到想多聊一句的地方，就来窗边……”像普通书评插件，未能传达“**它亲眼看着你刚翻过哪些帖子，开口时不用从头解释，而是由同一句话的四个声部接住你**”的独特定位。
2. **阅读流与窗沿伴读缺少无声默契**：阅读流里卡片与问题标题上下重复念两遍，试读无头像作者显示冰冷灰圆（`bg-slate-200`）；读者停留读完一篇后，右下角 `KanshanDock` 只有一个纯数字角标，缺乏看山“静静陪你记下”的微低语。
3. **入座态与群聊态还在用两张不同的桌子**：`Entrance`（`.gather-scene`）仍在用旧扁桌 `art.table`，入座一瞬切换到群聊态时家具突然变形；且 `.gather-note` 简单按 `slice(0, 76)` 截断正文，把句子生硬拦腰斩断；下方空态的 `ListeningDesk` 与 `ThoughtShelf` 带着突兀的深绿大竖杠色块，在首屏底部露出一截“断头绿条”。
4. **收口与手账仪式感落差**：点「我拍板，收进手账」后只变为灰字禁用按钮，缺少“信笺落章”与回看入口；`CatJournalDrawer` 仅是纯文字框，没有对应第一轮原型里“贴在手账右上角的小猫印记”。
5. **伙伴名册偏说明书化**：点击「认识四位伙伴」仅见职责说明，缺少各自围巾色彩辨识与角色温度。

### 1.2 前端风格与审美上的 6 处割裂
1. **两代水彩资产色温撞车（最明显）**：小屋屋顶 `blank.webp` 与窗沿 `rail.webp` 带高饱和马卡龙粉/天蓝渐层，与下方温暖的宣纸米白页面、蜂蜜橡木圆桌及水彩墙面冲突。
2. **字体回退链含粗硬宋体**：`--serif` 在 Windows 下回退顺序含 `SimSun` 优先位，导致标题在非苹方/思源设备上略显锯齿；Hero 在桌面端右上方略空。
3. **`.seat-voice` 话语微徽章位置易压相邻元素**：呼噜猫说话时 `.seat-voice` 落在猫耳与猫头鹰之间，看山说话时落在头顶偏左接近门框。
4. **按钮主次层级不够清晰**：入座首屏底栏的「开聊 · 听呼噜猫说」与下方文本输入栏同为浅色描边胶囊，主次不够分明。
5. **消息区滚动硬切**：`.room-flow` 消息滚出顶部或靠近底部时生硬截断。
6. **未连热榜时的试读卡片朴素**：`.sample-shelf` 仅是一段提示加两行窄按钮，缺少编辑室小册子的排版仪式感。

---

## 二、项目叙事升级规格

### 2.1 首页 Hero 叙事立骨 & 编辑室试读小册（`src/app/page.tsx`、`src/app/reading-room.css`）
1. **保留精确标识与按钮**：
   - `<h1>` 保持 `看山伴读<span>，</span><br className="mobile-break" />慢慢翻。`
   - 保留 `认识四位伙伴` 按钮精确名称。
2. **更有穿透力的陪伴叙事副文案**：
   - 将 `.shelf-hero > div > p` 改为：
     > 在这儿刷知乎。刷完心乱了，就来窗边问它们——<br className="desktop-break" />它亲眼看着你刚翻过哪些帖子，开口时不用从头解释。
3. **四声部围巾色导览条 `.hero-voices`**：
   - 置于 Hero 主文与「认识四位伙伴」之间或上方轻巧一行（`display: flex; flex-wrap: wrap; gap: 8px 14px;`），用四色围巾圆点展示同一句话的四个声部：
     - 呼噜猫（豆绿 `#628365`）· 先接情绪
     - 猫头鹰（淡紫 `#7a638e`）· 核对原句
     - 护短柴犬（靛蓝 `#4d6487`）· 替你站边
     - 刘看山（朱红 `#b2493b`）· 递掌控卡
   - 在桌面和手机端均保持轻巧透气，不抢 `h1` 风头。
4. **编辑室试读小册（`.sample-shelf`）**：
   - 优化无热榜时的 `.sample-shelf`：添加暖调虚线页眉与更舒展的行距，每一项包裹在带序号条目的版式内，**但 `<button>` 元素内部的 accessible text 必须严格保持为 `{t.title}`**（即 `一页笔记，什么时候才算读完？` 与 `两张书签，留下两种读法`），序号 `01` / `02` 放在 `<button>` 外的装饰容器（`aria-hidden="true"`）中，确保 `verify_companion.py` 中 `btn(p, "一页笔记，什么时候才算读完？")` 等 `exact=True` 断言 100% 命中。

### 2.2 阅读页去重、圆章头像与窗沿静默微低语（`QuestionDetail.tsx`、`AnswerCard.tsx`、`KanshanDock.tsx`）
1. **消除重复标题（`QuestionDetail.tsx`、`AnswerCard.tsx`）**：
   - `QuestionDetail` 向 `<AnswerCard>` 传入 `questionTitle={title}`；
   - `AnswerCard` 接收可选 prop `questionTitle?: string`，当 `item.title && index >= 0 && item.title !== questionTitle` 时才渲染卡片内 `<h3>` 标题，避免与顶部问题卡片上下重复。
2. **温润宣纸印章头像（`AnswerCard.tsx`）**：
   - 当无 `item.authorAvatar` 时（例如试读文章或无头像作者），将冰冷的 `bg-slate-200` 占位圆替换为暖宣纸印章圆徽（`bg-[#ecefe3] border border-[#cad4c3] text-[#365e4e] text-[12px] font-semibold`），内显 `item.author.trim().slice(0, 1) || "读"`。
   - 微调 `SelectablePassage` 下方「逐句挑选」与「阅读全文」之间的间距节奏，使操作更从容。
3. **窗沿静默微低语（`KanshanDock.tsx`、`reading-room.css`）**：
   - 当 `count > 0 && !invited` 时，在 `.window-dock` 中 `.window-pet` 上方渲染轻盈小纸签：
     `<p className="dock-whisper" aria-hidden="true" onClick={wake}>刚记下 {count} 篇，想聊点我</p>`
   - **严格禁令**：
     - 绝不能使用 `.cat-note` 类名（`.cat-note` 仅留给呼噜猫 5 分钟后触发的主动便签，保证 `verify_companion.py` 的 `assert not p.locator(".cat-note").count()` 稳定通过）；
     - 绝不显示任何文章标题、原文摘录或私有内容；
     - 绝不更改 `<button className="window-pet" aria-label="打开毛茸茸小屋">` 的可访问名称。

### 2.3 入座与群聊同桌衔接、自然断句与消除断头绿条（`AnimalStage.tsx`、`CabinModal.tsx`、`listening-desk.css`、`ThoughtShelf.module.css`、`reading-room.css`）
1. **入座与群聊同一张水彩圆桌（`AnimalStage.tsx`、`reading-room.css`）**：
   - `Entrance` 组件中的 `.room-table` 由旧扁桌 `art.table` 切换为 `art.roundTable`（**保留 `art.table` 在 `src/lib/art.ts` 的导出不删任何旧图**）。
   - 校准 `.gather-scene` 中 `.room-table`、`room-host`、`arr-cat`、`arr-owl`、`arr-dog` 的位置与缩放比例，使入座结束后过渡到 `.table-ensemble` 时圆桌透视与大小保持连贯。
2. **自然句末收口（`CabinModal.tsx`）**：
   - 新增辅助函数 `leadSentence(text: string, fallback: string)`：
     ```ts
     function leadSentence(text: string, fallback: string): string {
       const clean = text.trim().replace(/\s+/g, " ");
       if (!clean) return fallback;
       const match = clean.match(/^.{6,58}?[。！？!?]/);
       if (match) return match[0];
       const chars = [...clean];
       return chars.length > 56 ? chars.slice(0, 56).join("") + "……" : clean;
     }
     ```
   - 替代原 `.gather-note` 中的 `.slice(0, 76)` 硬截断，让看山抄下的第一句话语义完整、像真人在纸上写下的摘录；并为 `.gather-note p` 加上微弱书签左侧细线或引号装饰。
3. **彻底消除首屏底部“断头绿条”并统一桌边工具纸感（`listening-desk.css`、`ThoughtShelf.module.css`、`reading-room.css`）**：
   - `ListeningDesk`（`.listening-desk`）：移除刺眼的 `border-inline-start: 3px solid var(--leaf)` 与厚重灰绿矩形底 `var(--pale)`；改为轻盈融于小屋宣纸的**淡米细框便签卡片**（`background: #f6f4ea; border: 1px dashed #cfd5c3; border-radius: 10px; padding: 10px 12px;`）；当没有 `topic` 时展示更紧凑的单行/双行小栏。**所有现有按钮（`让伙伴挑新闻`、`听点科技的`、`再听一句`、`换一题`、`连续旁听`、`接回上一题`、`我来出题`）与 `aria-label="旁听话题"` 必须保留并可直接点击。**
   - `ThoughtShelf`（`ThoughtShelf.module.css`）：使 `.panel` 与屋内容器色调统一（`border-block: 1px dashed #d8d9cb; padding: 9px 2px;`），收紧头部高度与胶囊按钮 `记个念头`，不再像僵硬的技术表单栏；保留全部 `aria-expanded`、`input` 和按钮文案不变。
4. **拉清底栏主次层级（`CabinModal.tsx`、`reading-room.css`）**：
   - 在 `CabinModal.tsx` 中，给高优先行动按钮「开聊 · 听呼噜猫说」与「接过看山的掌控卡」在 `.room-continue` 上增加 `.is-primary` 类名（温润森绿实底 `#365e4e` + 奶油白字 `#fffef7`），与下方白色输入栏区分出清晰的视觉主次；「听下一句」与「跳过入场」保持柔和浅绿纸感底。

### 2.4 掌控卡信笺化、落章印记与手账小猫插图（`ControlCard.tsx`、`CatJournalDrawer.tsx`、`CabinModal.tsx`、`page.tsx`、`reading-room.css`）
1. **掌控卡仪式感（`ControlCard.tsx`、`CabinModal.tsx`、`page.tsx`）**：
   - `ControlCard` 增加可选 props `onOpenJournal?: () => void`（仅 `page.tsx` 通过 `CabinModal` 传入切换到手账抽屉，`/trial` 不传）。
   - `.decision-paper` 顶部眉栏改为左右分布：`刘看山的手写卡` + 右侧英文印签 `3 MIN CARD`；加入细腻信笺横纹肌理与底部署名行 `陪你一起，刘看山`（倾斜暖棕手写感）。
   - 当 `room.committed` 为 `true` 时：
     - 保留主按钮文本 `"已收进猫咖手账"` 与 `disabled` 状态（严格满足 `verify_companion.py`）；
     - 卡片右上角盖一枚精致微倾圆章 `<span className="committed-stamp" aria-hidden="true">已落章</span>`（带 `stamp-settle` 动效）；
     - 若传入 `onOpenJournal`，在按钮旁显示轻巧的链接按钮 `翻开猫咖手账 →`（点击关闭小屋并打开手账抽屉）。
2. **猫咖手账小猫插图（`CatJournalDrawer.tsx`、`reading-room.css`）**：
   - 根据 `JournalEntry.catBadgeTheme` 映射到 `art` 中既有的小猫插图（`compass_orange` → `art.resting.purr_cat`、`cocoa_ragdoll` → `art.sleeping`、`goggles_calico` / `cyber_gpu` → `art.portrait.purr_cat`，零新素材增加），在每张 `.journal-entry` 右上角渲染轻倾 `-6deg` 的手绘小猫印记 `<img className="journal-cat" src={...} alt="" aria-hidden="true" />`，还原 V6.1 故事板第 8 格的温度感。
   - 在副标题区域展示收录统计，例如 `{entries.length ? '已收录 ' + entries.length + ' 张 · 只收下你亲自拍板的卡片。' : '只收下你亲自拍板的卡片。一起读过的原帖，也会夹在卡片里。'}`。

### 2.5 伙伴名册围巾色点与角色温度（`PartnerGuide.tsx`、`reading-room.css`）
- 在 `PartnerGuide.tsx` 中给每位伙伴增加围巾颜色点及展示框角色底晕 `data-speaker={s}`，补充一句性格小注脚，同时**严格保留**全部 4 个伙伴 Tab 按钮名、12 个动作按钮名及 `img` 的 `alt={`${names[s]}：${profile.poses[n][0]}`}` 不变（保证 `verify_companion.py` line 75-87 通过）。

---

## 三、前端风格与微工艺审美升级规格

### 3.1 屋顶外壳与窗沿暖宣纸校色（解决马卡龙粉蓝撞色）
1. **`CabinModal.tsx` + `reading-room.css`**：
   - 将原本直接挂在 `.cabin-paper` 上的 `style={{ backgroundImage: ... }}` 拆出为第一个子元素：
     `<div className="cabin-shell-bg" aria-hidden="true" style={{ backgroundImage: \`url("${art.shell}"), url("${art.clouds}")\` }} />`
   - `.cabin-shell-bg` 设置：
     ```css
     .cabin-shell-bg {
       position: absolute;
       inset: 0;
       z-index: 0;
       pointer-events: none;
       background-size: 100% 100%;
       background-repeat: no-repeat;
       filter: sepia(0.22) saturate(0.72) hue-rotate(-6deg) brightness(1.01);
     }
     ```
   - 保持 `.roof-words` 为 `z-index: 2`（维持 `position: absolute`），并将 `.room-title, .room-context, .room-scene, .thread-bar, .room-flow, .room-footer` 设为 `position: relative; z-index: 1;`，`.cabin-paper::before` 设为 `z-index: 1`。
   - **视觉预期**：顶部 `blank.webp` 的冷粉蓝调柔和退为暖杏宣纸色调，与室内水彩木屋、`room.webp` 及纸面网页浑然一体，同时绝不改变内部任何人物插画与文本对比度。
2. **`KanshanDock.tsx` / `reading-room.css` 窗沿校色**：
   - 给 `.pet-rail` 增加 `filter: sepia(0.26) saturate(0.68) brightness(1.02);` 让窗沿条融入书页底部。

### 3.2 现代出版物中文衬线字体升级（`reading-room.css`）
- 更新 `:root` 变量：
  `--serif: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STZhongsong", "STSong", Georgia, serif;`
  让标题、书签摘录、掌控卡手写标题摆脱粗硬点阵宋体 `SimSun`，呈现温润书卷气。

### 3.3 `.seat-voice` 话语微徽章避让后排面部（`reading-room.css`）
- 精确校准四个座位 `.seat-voice` 相对位置，避免遮挡后排猫头鹰或看山轮廓：
  - `purr_cat`：`top: 6%; left: 2%; right: auto;`
  - `owl`：`top: 2%; right: -2%; left: auto;`
  - `kanshan`：`top: 2%; left: -2%; right: auto;`
  - `shiba`：`top: 6%; right: 2%; left: auto;`
- 确保所有状态下：非活跃座位 `.seat-voice` 的 computed `opacity` 严格为 `0`，活跃座位严格为 `1`（满足 `verify_group_chat.py` line 75-78）。

### 3.4 群聊流上下边缘柔雾渐隐（`reading-room.css`）
- 为 `.room-flow` 添加平滑渐隐遮罩：
  ```css
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 10px, #000 calc(100% - 8px), transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0, #000 10px, #000 calc(100% - 8px), transparent 100%);
  ```

---

## 四、不可突破的测试与隐私边界红线

1. **禁止使用 `.cat-note` 类名于非主动便签元素**（`verify_companion.py` line 109 硬断言）。
2. **所有测试依赖的按钮 `exact=True` 文本、角色 `alt`、`.room-context` / `.thread-count` / `.evidence-card` / `.journal-entry` 选择器必须保持兼容**。
3. **离线试聊 `/trial` 与 `docs/reader-trial/window-seat.zip`** 绝不引入 `storage.ts` 或 API 调用，且必须通过 `verify_trial.py` 全部检查。
4. **保持 `.pose-talk` 过渡断言**：正常动效 `transitionDuration >= 0.6s`，`prefers-reduced-motion: reduce` 下 `transitionProperty === "none"`。
5. **不得修改或删除 `assets/`、`docs/visual-target-v6.1/`、已有归档原图与 `F:\AI解决方案\AI生成工艺检索` 任何文件**。

---

## 五、本轮验收与视觉对比要求

在 `D:\fluffy-roundtable` 全部修改完成后：
1. 运行 `npm run typecheck`、`npm run test:companion`、`npm run build`、`npm run pack:trial`。
2. 起临时生产预览端口（如 `3123`，避开正在运行的 `3100`，并在验完后关闭临时进程）运行全部 Playwright 回归：
   - `scripts/verify_group_chat.py --base http://127.0.0.1:<port> --shots docs/group-chat`
   - `scripts/verify_companion.py --channel msedge --base http://127.0.0.1:<port>`
   - `scripts/verify_trial.py --channel msedge --zip docs/reader-trial/window-seat.zip --base http://127.0.0.1:<port>`
   - `scripts/verify_intent.py --base http://127.0.0.1:<port>`
   - `scripts/verify_proposal.py --base http://127.0.0.1:<port>`
   - `scripts/verify_cabin_layout.py --base http://127.0.0.1:<port> --shots tmp/cabin-art-direction`
3. 刷新 `docs/group-chat/handoff.gif` 并输出第二轮实机对比截图至 `D:\fluffy-roundtable\tmp\review-v2\`，目检确认：
   - 屋顶 `cabin-shell-bg` 与桌面、墙面色温统一无硬边；
   - 入座首屏无断头绿条，摘录自然收句；
   - `.seat-voice` 不遮挡后排伙伴面部；
   - 掌控卡落章、手账小猫、Hero 四声部与窗沿微低语均清晰和谐。
