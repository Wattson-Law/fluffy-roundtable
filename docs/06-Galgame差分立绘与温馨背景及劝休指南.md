# 毛茸茸圆桌 · 差分立绘、温馨背景方案与劝休新功能指南

> 配合仓库内的视觉互动演示原型 [`prototypes/fluffy-roundtable-galgame-v1.html`](../prototypes/fluffy-roundtable-galgame-v1.html) 一起使用（已采用去品牌词与纯净视觉描写，适合各类生图工具直接执行）。

---

## 一、什么“对话框背景”最有温馨感？（3 套不抢戏、零叠字方案）

做暖心陪伴类对话框背景的黄金构图公式：**「冷色调窗外夜色（反衬安全感） + 暖黄色小光源（壁炉 / 台灯 / 串灯） + 柔和景深微虚化 + 底部压暗承接对话框」**。

下面 3 套纯室内风景提示词专注于家具与光影氛围，生成后可直接作为圆桌对话框舞台底图：

### 方案 A（主推）：深夜壁炉茶屋室内景
* **中文提示词**：
  > 温暖治愈系 2D 手绘水彩室内风景插画，16:9 横版，空无一人的安静木屋茶室视角。左侧是一扇弧形实木格子窗，窗外可以看到深蓝色星空与轻轻飘落的雪花，冷色调夜景反衬出室内的极度温暖。画面正中偏后是一座小巧圆润的石头壁炉，里面跳动着柔和温暖的橘黄色小火苗。屋顶垂下一盏蜜糖色的纸质暖光小吊灯，把桌面照得暖洋洋的。前景是一张低矮温润的原木矮桌，桌上放着两只冒着细腻白气的小陶瓷茶杯和一本合上的布面笔记本。画面中景带柔和虚化景深，下方区域色彩安静柔和、干净留白。
* **English Prompt**：
  > Warm cozy 2D hand-painted watercolor room interior illustration, 16:9 landscape, calm empty woodland tea cabin scene viewed across a low oak wooden table. On the left, an arched wooden window reveals a peaceful deep blue starry winter night sky with gentle snowflakes outside. In the center background, a small rounded stone fireplace glows softly with gentle amber flames. Overhead hangs a warm honey-amber paper lantern casting soft golden light. On the foreground wooden table sit two steaming ceramic tea mugs and a closed cloth-bound journal. Soft dreamy bokeh depth-of-field, uncluttered gentle warm tones along the bottom area.

### 方案 B（猫咖氛围）：雨夜木质咖啡馆窗台
* **中文提示词**：
  > 温暖治愈系 2D 手绘水彩室内风景插画，16:9 横版，夜晚安静的木质小咖啡馆窗边一角，画面里只有静物景致。大大的温润木框玻璃窗外是柔和微虚化的城市暖黄灯火与细雨景色，窗沿挂着一串暖白色小串灯。木质吧台上摆着一盏发光的复古暖黄蘑菇小台灯，灯旁有一杯拉花热拿铁和一盆小绿植。整体水彩笔触温润柔和，下方留出舒缓安宁的暗暖色调区域。
* **English Prompt**：
  > Cozy 2D hand-painted watercolor interior illustration, 16:9 landscape, peaceful empty corner of a wooden cafe by a large window on a rainy night. Outside the wood-framed window are soft out-of-focus warm amber city lights and gentle rain droplets. Delicate warm string lights drape along the top window frame. On the wooden counter glows a cute vintage amber mushroom desk lamp beside a steaming latte cup and a small potted plant. Soft painterly watercolor texture with calm, dark-warm shading across the lower section.

### 方案 C（营地氛围）：森林星空暖灯帐篷
* **中文提示词**：
  > 温暖治愈系 2D 手绘水彩风景插画，16:9 横版，从舒适柔软的米色帆布露营帐篷内部向外望去的平静夜景，画面仅有景物陈设。帐篷敞开的门帘上挂着一串发着暖金光的圆灯泡串灯，帐篷顶挂着一盏暖橘色露营小提灯，地面两侧铺着柔软的针织抱枕与毛毯。远处门外是安静的深绿松树森林剪影和点点金色萤火虫微光。中央与下方构图干净舒朗。
* **English Prompt**：
  > Cozy 2D storybook watercolor landscape illustration, 16:9 widescreen, peaceful view looking out from inside a warm cream canvas camping tent at night with scenery only. Warm golden globe string lights hang across the tent opening alongside an amber camp lantern overhead. Soft knitted cushions and folded wool blankets sit neatly along the left and right edges. Outside in the distance stand dark pine forest silhouettes with tiny glowing fireflies. Clean open central space and calm lower area.

---

## 二、4 只小动物的“同位置三表情微动作差分表”提示词

为了让圆桌对话切换立绘时不出现跳帧闪烁，生成差分时务必上传对应角色的定妆图作为参考，并锁死身体大小、机位和脚底基准线，只变化五官与小爪子微动作（背景全部为纯净 `#FFFFFF`）：

### 1. 小白狐（红围巾）3 态动作差分
```text
16:9 horizontal 3-pose expression sheet on a clean solid pure white background (#FFFFFF). Soft 2D watercolor storybook illustration of the same cute plump white arctic fox with a small black oval nose, black arms, black feet, and a red knitted scarf with tassels. Three matching full-body poses aligned side-by-side at identical size and ground level:
(1) Left: calmly looking down with a gentle smile while holding a tiny open notebook;
(2) Center: looking forward cheerfully with bright round eyes, raising one paw in a friendly wave;
(3) Right: happy smiling curved eyes, gently holding a closed notebook in a warm goodnight gesture.
```

### 2. 小橘猫（浅豆绿围巾）3 态动作差分
```text
16:9 horizontal 3-pose expression sheet on a clean solid pure white background (#FFFFFF). Soft 2D watercolor storybook illustration of the same chubby golden-orange tabby cat wearing a pale sage-green knitted scarf. Keep body proportions, size, and alignment identical across three side-by-side poses:
(1) Left: peaceful squinting smile holding a warm beige ceramic tea mug with both paws;
(2) Center: tilting head slightly to one side with gentle caring round eyes, listening attentively;
(3) Right: joyful big cheerful smile raising the warm tea mug slightly in encouragement.
```

### 3. 小猫头鹰（大圆眼镜 · 浅紫围巾）3 态动作差分
```text
16:9 horizontal 3-pose expression sheet on a clean solid pure white background (#FFFFFF). Soft 2D watercolor storybook illustration of the same plump cocoa-brown owl wearing oversized round thin-rimmed glasses and a pale lavender knitted scarf. Keep body proportions, size, and ground alignment identical across three side-by-side poses:
(1) Left: calm thoughtful gaze behind round spectacles with wings tucked neatly;
(2) Center: raising one wing excitedly while holding a tiny wooden pointer twig as if finding an important clue;
(3) Right: gentle warm smiling eyes nodding softly in reassurance.
```

### 4. 小柴犬（雾霾蓝围巾）3 态动作差分
```text
16:9 horizontal 3-pose expression sheet on a clean solid pure white background (#FFFFFF). Soft 2D watercolor storybook illustration of the same plump golden-tan Shiba Inu puppy with small cream eyebrow dots and a slate-blue knitted scarf. Keep body proportions, size, and ground alignment identical across three side-by-side poses:
(1) Left: sitting politely facing forward with bright friendly eyes and a happy "w" smile;
(2) Center: leaning forward eagerly with puffed cheeks and both front paws raised cheerfully to defend and support a friend;
(3) Right: relaxed happy expression with a big warm smile and tail curled up joyfully.
```

---

## 三、「刘看山侧边栏浏览统计 & 劝休播报」新功能实现规范

1. **真实计时器**：监听 `document.visibilityState === "visible"`，仅在活跃阅读时每秒 `+1` 并持久化到 `sessionStorage`；格式化输出为 `"XX 分 XX 秒"`。
2. **篇数与知识点统计**：用户点击展开热榜/搜索条目后将 `{ id, title, tag }` 去重计入 `visitedPosts`，自动聚合出现频次最高的 `1~2` 个主题标签。
3. **打开侧边栏刘看山第一句话**：
   > 「主人，你已经浏览了 `{visitedPosts.length}` 个帖子，花费时间 `{formattedDuration}`，获得了关于「`{topTopics}`」的大量知识，**关闭手机休息一下吧**。」
4. **双分支按钮**：
   - **「听刘看山的，关掉屏幕去休息」**：切入柔光护眼晚安小屋界面（可随时唤醒返回）；
   - **「还是有点乱？打开圆桌聊聊」**：平滑切入 4 只动物换差分陪聊的视觉剧场。
