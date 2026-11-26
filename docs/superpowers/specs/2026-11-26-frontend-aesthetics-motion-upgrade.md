# 毛茸茸圆桌 · 前端审美与叙事动效升级方案

> 日期：2026-11-26  
> 适用仓库：`D:\fluffy-roundtable`（当前分支 `feat/pet-model-dialogue`，基线提交 `e1d07c4`）  
> 目标范围：正式首页 `/`、窗边试聊 `/trial`、离线试聊包 `docs/reader-trial/window-seat.zip` 共用同一套小屋视觉与动效系统；**零破坏既有业务数据流、隐私边界、三条台词红线与全部回归测试**。

---

## 一、现状审阅与核心问题定位

### 1.1 现役版本（`e1d07c4`）的视觉与动效短板

1. **群聊舞台“一字排开证件照”**：
   - 进入对话后，`.room-scene.at-table` 被压扁至 `clamp(82px, 14.5dvh, 124px)`（窄屏仅 `72px–95px`），四位伙伴沿水平线等大排开（`left: 8% / 28% / 48% / 68%`）卡在一条高度仅 `24%` 的扁桌板之后，失去「围坐圆桌」的纵深感与亲密感。
   - 入场全景（猫头鹰落圆窗、看山居中、猫狗分立左右）切换到群聊态时，四位伙伴瞬移站军姿，破坏了 V6.1 建立的“同一间水彩木屋”的空间连续性。
2. **`window-table-v2` 离线草稿的方向与工艺短板**：
   - **值得吸收**：提出「读者是圆桌第五席」的前后错落座次，以及将冰冷蓝灰 `.room-context` 改为温润纸面细线眉条。
   - **必须规避的拼贴硬伤**：
     - `perspective-table.webp` 由旧扁桌像素暴力纵向拉伸制成，木纹发虚、桌腿比例失调；
     - `reader-notebook.webp` 为 PIL 多边形平涂块，与水彩纸纹手绘角色质感严重割裂；
     - 刘看山（`z-index: 3`）覆盖桌沿像坐在桌面上，而猫头鹰（`z-index: 1`）被桌沿切得只剩半颗头，空间穿帮；
     - 去掉了非发言角色微退景和柔光层次，仅靠 `translateY(-1px)` 与角落漂浮的方框图标 `.seat-voice`，导致“谁在说话”的瞬时辨识度变弱。
3. **V6.1 叙事动效的灵魂缺失**：
   - `docs/visual-target-v6.1/source/assets/桌宠/wake0.webp`–`wake6.webp`（看山“停笔抬头”7 帧序列）已在仓库中，却未接入 `KanshanDock.tsx`；点窗沿时看山无抬头回应，弹窗直接弹出。
   - 弹窗打开缺少 `::backdrop` 渐入与内容微交错节奏；四伙伴在圆桌上处于完全静止贴图态，缺少性格微表演、错峰自然呼吸与“点名递话”时的座次应答反馈。
   - 掌控卡 (`ControlCard`) 与拍板入账缺少纸卡展开与落章确认仪式感；抽屉（`ReadingNotebook` / `PartnerGuide` / `CatJournalDrawer`）切 Tab 与切换动作立绘硬闪无过渡。
4. **阅读页与小屋的色彩断层**：
   - `HotFeedList.tsx` 仍残留高饱和亮橙 `#FF6B35`、冷蓝 `bg-sky-50` 等通用社区色；`AnswerCard.tsx` 仍残留旧暗夜篝火主题的 `ember-400` 样式，`globals.css` 残留未使用的暗夜篝火类。

---

## 二、新增已核验水彩素材（增量添加，不改旧图）

严格遵守 `HANDOVER.md` 的**素材保留约定**：绝不删除、覆盖或移动 `assets/` 与 `docs/visual-target-v6.1/` 中任何原有素材。

1. **新绘水彩透视圆桌**：
   - 路径：`assets/cabin-v2/round-table-watercolor.webp`（`920×474`，透明通道已提取并去白边）
   - 质感：与 `room.webp` 和四位伙伴一致的蜂蜜橡木水彩晕染、左中窗光亮面、暖棕彩铅柔线与四条真实透视木腿。
   - 合图构图参考：`tmp/cabin-art-direction/v3-composite-check.png`（已实景核验融合度）。
2. **复用已存未接入的看山抬头帧**：
   - 路径：`docs/visual-target-v6.1/source/assets/桌宠/wake0.webp` 至 `wake6.webp`（7 帧）。
3. **`src/lib/art.ts` 增量导出**：
   - 新增 `roundTable: roundTable.src`（指向 `../../assets/cabin-v2/round-table-watercolor.webp`）；
   - 新增 `wake: [wake0, wake1, wake2, wake3, wake4, wake5, wake6].map((i) => i.src)`；
   - 保持原有 `art.table`、`art.ink`、`art.resting`、`art.portrait`、`art.entry`、`art.actions` 全部字段不变，确保 `pack_trial.mjs` 自动内联为 `data:image/webp;base64,...`。

---

## 三、视觉与空间构图升级规格

### 3.1 「窗边第五席」真圆桌舞台（`AnimalStage.tsx` + `reading-room.css`）

1. **画幅高度与自适应比例**：
   - 桌面 `.room-scene.at-table`：`height: clamp(154px, 24dvh, 212px);`（圆角 `12px`，`background-size: cover; background-position: center 58%;`）。
   - 窄屏 `@media (max-width: 600px)`：`.room-scene.at-table { height: clamp(122px, min(43vw, 23dvh), 168px); }`。
   - 矮屏 `@media (max-height: 650px)`：`.room-scene.at-table { height: clamp(104px, 20dvh, 146px); }`。
   - 极矮屏 / 软键盘弹起 `@media (max-height: 500px)`：`.room-scene.at-table { height: clamp(78px, 17dvh, 108px); }`；确保 `.room-flow` 在 390×435 键盘视口下 `clientHeight >= 70px` 且底部输入框完全可见。
2. **统一窗光气氛层**：
   - `.room-scene.at-table::before` 叠加一层极克制的左窗斜射暖光（`radial-gradient(ellipse 62% 72% at 22% 28%, rgba(255, 250, 233, 0.28), transparent 72%)`）和底部极轻柔暖边过渡，避免木地板与聊天区割裂。
3. **五层透视座次与桌具定位（严格保留固定 4 个 `.bench-seat` 节点，key 顺序不变）**：
   - **Layer 0（桌底落地影 `.table-ensemble::before`）**：柔和椭圆暖棕投影（`left: 17%; bottom: 2.5%; width: 66%; height: 16%; background: radial-gradient(ellipse, rgba(92, 68, 41, 0.24), transparent 72%); z-index: 0; pointer-events: none;`）。
   - **Layer 1（后排左 · 考据猫头鹰 `data-speaker="owl"`, `z-index: 1`）**：
     `left: 25.5%; bottom: 42.5%; width: 20.5%; height: 50%;` — 完整露出圆眼镜、淡紫围巾与胸前滴纹，自然坐于圆桌左后弧后方，绝不切头。
   - **Layer 2（水彩透视圆桌 `.bench-table`, `z-index: 2`, `src={art.roundTable}`）**：
     `left: 22.5%; bottom: 5.5%; width: 55%; height: 56%; object-fit: contain; object-position: center bottom; pointer-events: none;` — 桌面中央与前弧自然留白，为读者留出「第五席」；**不放程序绘制的多边形假本子**。
   - **Layer 3（后排右 · 刘看山 `data-speaker="kanshan"`, `z-index: 3`）**：
     `left: 47.8%; bottom: 43%; width: 21%; height: 49%;` — 看山原立绘自带的绿面摊开手写本稳稳平落在圆桌右后半桌面内，本子底部配轻微桌面接触投影（通过 `filter: drop-shadow(0 3px 4px rgba(86, 62, 36, 0.18))` 实现，与桌面融为一体），不悬空出桌沿也不遮挡柴犬耳朵。
   - **Layer 4（前排左右 · 呼噜猫 & 护短柴犬, `z-index: 4`）**：
     - `purr_cat`：`left: 4.5%; bottom: 7%; width: 26.5%; height: 60%;`
     - `shiba`：`left: 69.5%; bottom: 7.5%; width: 26%; height: 58%;`
     - 前排两只底部配柔和落地椭圆影（`.bench-seat:is([data-speaker="purr_cat"], [data-speaker="shiba"])::after`），前排比后排约大 20%–25%，形成自然景深，且在 360px 窄屏与桌面下四只角色的视觉中心都能被 `elementFromPoint` 独立命中。
4. **一眼看清“谁在说话”的克制聚焦系统**：
   - **倾听态（`data-active="false"`）**：`filter: saturate(0.87) brightness(0.98);` 温和退后半步，仍清晰可亲，不发灰变脏。
   - **发言态（`data-active="true"`）**：
     - `filter: saturate(1.03) brightness(1.02);` + 角色专属柔暖背后晕染（`.bench-seat::before` 使用 `--seat-glow` CSS 变量：猫暖杏 `#fff3d6cc`、猫头鹰淡紫暖白 `#f4ecfbcc`、柴犬暖阳琥珀 `#ffefd1cc`、看山宣纸暖光 `#fff6ebcc`）。
     - 略微前倾强调（`transform: translateY(-3px) scale(1.045)`，保证前后排错落高度不被破坏）。
   - **重设计 `.seat-voice` 话语微徽章**：
     - 保留 `.seat-voice` 类名及 `opacity: 0 -> 1`（满足 `verify_group_chat.py` 断言），将原先的裸 SVG 框升级为温润的**奶油宣纸圆角小话泡徽章**（内含精致微图标或 14px 柔和描边、浅森绿/角色色边框、柔和阴影 `0 2px 6px rgba(64, 52, 34, 0.16)`）；
     - 定位避开边缘裁切与左侧书堆：`owl` 与 `purr_cat` 置于头侧偏右上（`top: 3%; right: 2%;`），`kanshan` 与 `shiba` 置于头侧偏左上（`top: 3%; left: 2%; right: auto;`）。
   - **左上角 `.scene-label` 胶囊**：
     - 温润磨砂纸感胶囊（`background: rgba(255, 253, 246, 0.92); backdrop-filter: blur(6px); border: 1px solid rgba(114, 134, 110, 0.24); box-shadow: 0 2px 8px rgba(58, 49, 34, 0.08);`）。
     - 在 `RoomScene` 根元素或 `.scene-label` 上标记 `data-speaker={speaker ?? "gather"}`，让小圆点按角色变色（猫 `#648466`、猫头鹰 `#7c668d`、柴犬 `#b46e38`、看山 `#b2493b`、读者倾听态 `#4f785c` 带柔和呼吸环）。

### 3.2 小屋纸面外壳、眉条、气泡与输入栏调和

1. **屋顶外壳与标题排印**：
   - 保持 `.room-dialog` 舒展尺寸：桌面 `width: min(504px, calc(100vw - 16px)); height: min(748px, 94dvh);`；窄屏 `≤600px` 为 `width: min(444px, calc(100vw - 10px)); height: min(706px, 92dvh);`（始终满足 `dialog.bounding_box()` 在视口边界内）。
   - 保留 `art.shell` 和 `art.clouds`，在 `.cabin-paper` 内部背景顶部增加一层极淡暖宣纸柔光渐变，使顶部粉蓝屋檐过渡到室内暖米色更顺滑，不再显得“两代风格拼接”。
   - `.room-title h2` 采用温润深墨棕 `#31352d`、`letter-spacing: 0.1em`；关闭按钮 `.icon-b` 悬停时柔和着色并轻旋 `90deg`（减少动态时不旋转）。
2. **书签式 `.room-context` 眉条**：
   - 告别冰冷工业灰蓝 `#e9eef4`：改为透明/极淡暖米纸条（`background: rgba(246, 243, 233, 0.72); border: 1px solid rgba(212, 214, 200, 0.7); border-radius: 9px; padding: 6px 11px; min-height: 33px;`），图标与标签采用温润森绿/墨褐，与下方水彩舞台色调完全统一。
3. **群聊流与气泡质感**：
   - `.thread-bar` 精简清爽，底线柔和 `#e2e4d8`。
   - 伙伴气泡 `.message-bubble`：`background: #fdfbf5; border: 1px solid #e6dfd0; box-shadow: 0 1px 3px rgba(72, 58, 34, 0.05); border-radius: 4px 15px 15px 15px; padding: 8px 12px; line-height: 1.62;`。
   - 读者气泡 `[data-speaker="user"] .message-bubble`：`background: #e6efe3; color: #284234; border-color: #cedcc9; border-radius: 15px 4px 15px 15px;`。
   - 头像 `.message-face`：加 1.5px 柔润边框与轻微悬停上浮反馈（`@media (hover: hover)`），提示“点头像递话”的可交互性。
   - `.chat-compose`：最小高度 `44px`，聚焦时呈现柔和森绿环光；发送按钮可用态呈现饱满森绿 `#365e4e` 并有轻快按压微弹。

### 3.3 主阅读页与侧边抽屉色系统一

1. **`HotFeedList.tsx`**：
   - 前三名热榜序号从刺眼荧光橙 `text-[#FF6B35]` 改为温润朱砂陶红 `text-[#b5553b]`（呼应刘看山红围巾）。
   - `TAG_STYLE` 全面纳入低饱和水彩纸色调：
     - `人生选择`：`bg-[#faf1df] text-[#845a28] border-[#e7d4b1]`
     - `科技`：`bg-[#eaf1ef] text-[#355e58] border-[#c9dcd8]`
     - `情感`：`bg-[#f8ecec] text-[#8d4c52] border-[#e4c9cc]`
     - `热点`：`bg-[#eff0e8] text-[#596459] border-[#d9ddd0]`
   - 卡片悬停增加极克制的 `translateY(-1px)` 轻浮与柔和纸影。
2. **`AnswerCard.tsx` 与 `globals.css`**：
   - 将“看山已记下”徽章及已读卡片高亮从旧暗夜篝火遗留的 `ember-400` 统一为暖麦穗书签色（已读边框 `border-[#d9c496]` + 柔光影 `shadow-[0_0_0_1px_rgba(217,196,150,0.38)]`，徽章 `bg-[#f6ebd0] text-[#7c5a26]`）。
   - 清理 `globals.css` 中不再被任何组件引用的旧暗夜篝火死样式（`.cabin-bg`、`.cabin-ember-glow`、`.bigscreen`、`.paper-card`、`.cabin-panel`、`.scroll-thin-warm`），保留 `.zh-*`、`mark.evidence`、`.scroll-thin` 与 `prefers-reduced-motion`。

---

## 四、叙事动效与微交互升级规格

### 4.1 窗沿看山“停笔抬头”响应（`KanshanDock.tsx`）

1. **接入 `art.wake` 7 帧序列**：
   - 待机态保持 `art.ink`（0→5→0）书写节奏；hover `.window-pet` 时看山轻微迎上 `translateY(-2px)`、胶囊轻亮。
   - 点击 `.window-pet` 时：
     - 若 `reduced` 为真，直接同步调用 `onOpen()`（零延迟）。
     - 若正常动效，进入 `waking` 状态（防连点），以 ~28ms/帧快速播完 `art.wake[0..6]`（总计 ~196ms，完整呈现“停笔 → 抬头看你”），完成后立即调用 `onOpen()`；卸载时清理定时器。
     - 抬头瞬间给 `.pet-rail` 叠加一圈极轻的暖金涟漪微闪（呼应 V6.1 `#dock:before`），强化“他听见了”的温暖触达。
2. **呼噜猫主动便签入场**：
   - `.cat-note` 增加 `cat-note-arrive`（280ms `cubic-bezier(0.22, 1, 0.36, 1)`，从右下轻柔浮现并带 `scale(0.96) -> 1`）。

### 4.2 小屋开合、遮罩与内容微交错（`CabinModal.tsx` + `reading-room.css`）

1. **遮罩淡入**：`.room-dialog::backdrop` 和 `.shelf-dialog::backdrop` 增加 `240ms` 淡入动画，消除背景骤黑的生硬感。
2. **弹簧阻尼展开**：
   - `open-from-window` 调整为 `0.54s cubic-bezier(0.22, 1, 0.36, 1) both`，从右下窗沿方向优雅舒展到原位（带微弱过冲阻尼，不夸张弹跳）。
   - `fold-to-window` 保持 `0.32s cubic-bezier(0.45, 0, 0.7, 0.35) both`（同步 `CabinModal.tsx` 关闭定时 `320ms`）。
3. **屋内微交错显现**：
   - 仅在小屋外壳刚打开时，`.room-context`、`RoomScene`、`.room-flow`、`.room-footer` 享有 `40ms / 80ms / 120ms` 的轻微透明度与 `4px` 位移交错，迅速收敛，绝不阻塞点击与输入。

### 4.3 圆桌角色“活感”与专属微表演（`AnimalStage.tsx` + `reading-room.css`）

1. **入场 → 圆桌丝滑转场**：
   - `.room-scene` 高度过渡使用 `0.68s cubic-bezier(0.22, 1, 0.36, 1)`，`.gather-scene` 与 `.table-ensemble` 使用柔和叠化，避免视觉跳切。
2. **四伙伴错峰自然呼吸（仅限 `prefers-reduced-motion: no-preference`）**：
   - 倾听态的四个 `.bench-seat` 各自拥有轻微且不同步的呼吸起伏（幅度 `1.2px` 或 `scaleY(1.008)`，周期分别为 `4.6s / 5.2s / 4.9s / 5.5s`，相位错开 `0s / -1.3s / -2.7s / -0.8s`），赋予静态手绘立绘柔和的生命感，且绝不“整齐摇晃”。
3. **发言者性格微表演（单次触发、留白读字）**：
   - 保持 `.bench-seat img` 的 `transition: opacity 0.68s ease`（**严格 ≥ 0.6s**，通过 `verify_group_chat.py` 断言；并在 `prefers-reduced-motion: reduce` 下明确 `transition: none`）。
   - 当座位变为 `data-active="true"` 时，给内部图片容器或座位本身触发**角色专属单次轻动作**（仅在切换为 active 时播 1 次，约 `720ms–820ms`，结束后稳稳停在聚焦态，不循环晃动干扰阅读）：
     - `purr_cat`：`pet-speak-cat`（轻柔微偏 `1.8deg` + 上托 `3px` 再柔落，像递来热茶）；
     - `owl`：`pet-speak-owl`（沉稳轻微颔首 `translateY(-4px) -> translateY(0) -> translateY(-2px)`，呼应推眼镜动作）；
     - `shiba`：`pet-speak-shiba`（轻快弹性微跃 `translateY(-6px) scale(1.055)` 柔落至聚焦态，呼应抬爪加油）；
     - `kanshan`：`pet-speak-kanshan`（稳重微挺身 `translateY(-3.5px) scale(1.045)`，呼应停笔抬头）。
4. **“点座位 / 点头像递话”即时应答反馈**：
   - 在 `CabinModal.tsx` 中维护轻量的 `nudgedPet: Speaker | null`（380ms 后自动清空）与 `addressedPulse: number`（或 boolean，420ms 后清空）。
   - 用户点击桌边伙伴或头像填入称呼时：
     - **不改变 `data-active`**，不发送消息，保留草稿（严格符合所有断言）；
     - 被点到的 `.bench-seat` 获得 `data-nudged="true"`，触发 360ms 轻轻“点头应答”弹性动画（`seat-nudge`）；
     - `.chat-compose` 获得 `data-addressed="true"`，边框闪过一圈 420ms 的柔暖森绿光晕，直观告诉读者“已填好称呼，请说”。
5. **等待回复 / 读者发言时的温柔倾听呼吸**：
   - 当 `speaker === "user"`（等待回复期间，`data-active="true"` 数量严格为 0）时，`.scene-label[data-speaker="user"] i` 呈现温和的呼吸光圈脉动，配合底栏状态提示，既不冒充动物发言，又消除“卡住”感。

### 4.4 群聊消息、掌控卡与侧边抽屉仪式感

1. **方向感消息入场**：
   - `.round-message[data-new="true"]` 伙伴消息从左下方微移入场（`translate(-5px, 6px) scale(0.985) -> none`, `0.32s cubic-bezier(0.22, 1, 0.36, 1)`），同时头像有轻快 `pop` 呼应；
   - `.round-message[data-speaker="user"][data-new="true"]` 读者消息从右下方轻滑入场（`translate(5px, 6px) scale(0.985) -> none`）。
2. **掌控卡展开与拍板落章动效（`ControlCard.tsx` + `reading-room.css`）**：
   - `.decision-paper` 出现时增加优雅的纸卡展开动画 `card-unfold`（`0.42s cubic-bezier(0.22, 1, 0.36, 1)`，微升+展开感），并细化顶部虚线信笺纹、看山手写署名感与暖金左侧微行动条。
   - 当 `room.committed` 为 `true` 时，为 `.decision-paper` 添加 `data-committed="true"`，按钮柔和转为已收账印记样式，并伴随一次温润的印章落印微弹（`stamp-settle`，`0.38s`），不干扰任何按钮 disabled 断言。
3. **侧边抽屉优雅切换**：
   - `PartnerGuide.tsx` 切换伙伴或动作立绘时，用 `key={`${s}-${n}`}` 驱动 200ms 柔滑淡入微升（`portrait-swap`），告别生硬闪烁。
   - `ReadingNotebook.tsx` 与 `CatJournalDrawer.tsx` 列表内容切换增加轻量 `180ms` 淡入。

---

## 五、不可突破的工程与自动化回归红线

实现时必须 100% 满足以下既有测试契约（逐项核对 `scripts/verify_*.py`）：

1. **固定座位 DOM**：`AnimalStage.tsx` 中 `seats` 维持 4 个 `.bench-seat`（`owl`, `purr_cat`, `kanshan`, `shiba`），切换发言者时 DOM 元素不卸载重建（`el === window.originalSeat`）。
2. **读者发言无假活跃**：读者刚发出消息等待模型回复期间，`data-active="true"` 计数严格为 `0`，`.room-scene` 包含文本 `听你说`。
3. **过渡属性硬断言**：
   - 非减弱动效下：`.bench-seat .pose-talk` 的 `parseFloat(getComputedStyle(el).transitionDuration) >= 0.6`。
   - `prefers-reduced-motion: reduce` 下：`.bench-seat .pose-talk` 的 `getComputedStyle(el).transitionProperty === "none"`（**特别注意**：不要在 `globals.css` 或其他地方用 `transition-duration: 0.01ms` 覆盖掉 `reading-room.css` 中的 `transition: none`！在 `reading-room.css` 的 `@media (prefers-reduced-motion: reduce)` 中明确保持 `.bench-seat img { transition: none !important; }` 即可确保 `transitionProperty === "none"`）。
4. **话语图标透明度硬断言**：`active.locator(".seat-voice")` 计算 `opacity === "1"`，非活跃座位 `.seat-voice` 计算 `opacity === "0"`。
5. **头像同源硬断言**：`RoundThread` 中伙伴头像 `src` 必须等于同角色 `.bench-seat .pose-rest` 的 `src`。
6. **热区与布局硬断言**：
   - 桌面 (`1280×880`)、手机 (`390×844` / `360×700` / `360×640`) 及软键盘态 (`390×435`) 下：
     - `document.documentElement.scrollWidth <= innerWidth`；
     - `dialog.bounding_box()` 完全位于视口内；
     - 输入框完全可见（`y + height <= viewportHeight`）；
     - `.room-flow` 可滚动区 `clientHeight >= 70`；
     - 四个座位中心均被 `document.elementFromPoint` 命中自身；
     - 前排 `purr_cat` / `shiba` 的 `rect.top` 显著大于后排 `owl` / `kanshan`（`>= 8px` 纵深差）。
7. **离线试聊包硬约束**：
   - `npm run pack:trial` 后，`docs/reader-trial/window-seat.zip` 仅含 `window-seat.html`，无外部网络请求、无 `localStorage` 读写越权、无密钥泄露，且完整通过 `scripts/verify_trial.py` 的桌面/窄屏/BFCache 全部断言。
8. **素材零删除**：原 `assets/`、`docs/visual-target-v6.1/`、`public/` 下的原画、三视图、旧图一律保留。

---

## 六、验证清单

改造完成后必须在 `D:\fluffy-roundtable` 依次完成并记录结果：
1. `npm run typecheck`（零错误）
2. `npm run test:companion`（全部测试通过）
3. `npm run build`（生产构建通过）
4. `npm run pack:trial`（离线包重打包通过）
5. 启动本机生产预览服务器（`next start -H 127.0.0.1 -p <port>`，验证完成后务必关闭该临时进程），执行：
   - `python scripts/verify_group_chat.py --base http://127.0.0.1:<port> --shots docs/group-chat`
   - `python scripts/verify_companion.py --channel msedge --base http://127.0.0.1:<port>`
   - `python scripts/verify_trial.py --channel msedge --zip docs/reader-trial/window-seat.zip --base http://127.0.0.1:<port>`
   - `python scripts/verify_intent.py --base http://127.0.0.1:<port>`（确认脚本参数后运行）
   - 额外用 Playwright 校验：四座位前后纵深与 `elementFromPoint` 命中、`KanshanDock` 抬头动画、390×435 键盘态、并输出最新高清实机截图（首页书架、小屋桌面、小屋手机）及刷新 `docs/group-chat/handoff.gif`（如有录制脚本可同步更新），用视觉核验确认无裁切、无穿帮、无白边、无对比度瑕疵。
