/**
 * 毛茸茸圆桌 · 全链路冒烟
 * 验证：真实 API 数据、防幻觉逐字溯源、三条台词红线、自适应模式、降级兜底。
 * 用法：node scripts/smoke.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? "http://localhost:3100";

let pass = 0;
let fail = 0;
const ok = (c, msg, extra = "") => {
  if (c) {
    pass++;
    console.log(`  ✓ ${msg}${extra ? ` ${extra}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${msg}${extra ? ` ${extra}` : ""}`);
  }
};
const j = async (path, init) => {
  const r = await fetch(BASE + path, init);
  return { status: r.status, body: await r.json() };
};
const norm = (s) => String(s ?? "").replace(/\s+/g, "");

console.log(`\n🔥 毛茸茸圆桌 · 全链路冒烟 @ ${BASE}\n`);

/* ---------- 1. 真实知乎数据 ---------- */
console.log("[1] 真实知乎 API 数据");
let hotItems = [];
{
  const q = await j("/api/zhihu/quota");
  ok(q.status === 200, "GET /api/zhihu/quota 200");
  ok(q.body.live === true, "额度接口连通（真实 Key 生效）", q.body.note?.slice(0, 60));
  const search = q.body.items?.find((i) => i.apiId === "zhihu_search");
  ok(search && search.total === 5000, "zhihu_search 额度 5000/天", `剩余 ${search?.remaining}`);

  const h = await j("/api/zhihu/hot?limit=30");
  hotItems = h.body.items ?? [];
  ok(h.status === 200 && !h.body.degraded, "GET /api/zhihu/hot 返回真实热榜");
  ok(hotItems.length >= 20, "热榜条数 >= 20", `${hotItems.length} 条`);
  ok(
    hotItems.every((i) => i.title && i.url.startsWith("https://www.zhihu.com")),
    "每条热榜均有真实标题与知乎原帖链接",
  );
  ok(hotItems.some((i) => i.summary?.length > 20), "热榜含真实摘要正文");

  const h2 = await j("/api/zhihu/hot?limit=30");
  ok(h2.body.cacheHit === true, "热榜命中 15 分钟服务端缓存（防爆仓）");
}

/* ---------- 2. 站内搜索：真实回答阅读流 ---------- */
console.log("\n[2] 站内搜索（模拟知乎真实回答流）");
let answers = [];
{
  const s = await j(`/api/zhihu/search?q=${encodeURIComponent("生化环材转行AI")}&count=10`);
  answers = s.body.items ?? [];
  ok(s.status === 200 && !s.body.degraded, "GET /api/zhihu/search 成功");
  ok(answers.length >= 5, "返回多篇真实回答", `${answers.length} 篇`);
  ok(
    answers.some((a) => a.contentText.length > 200),
    "ContentText 含大段真实回答正文",
    `最长 ${Math.max(...answers.map((a) => a.contentText.length))} 字`,
  );
  ok(answers.every((a) => a.author && a.url), "每篇均有真实作者与原帖链接");
  ok(answers.some((a) => a.authoritylevel >= 3), "含高权威度（Lv.3+）回答");
  ok(answers.some((a) => a.voteUpCount > 0), "含真实赞同数");
  ok(answers.some((a) => a.comments.length > 0), "CommentInfoList 精选评论可用");

  const bad = await j("/api/zhihu/search?q=");
  ok(bad.status === 400, "空查询返回 400（不浪费额度）");
}

/* ---------- 3. 圆桌分析主流水线 ---------- */
console.log("\n[3] 圆桌分析（readingTrail → 四小只剧本）");
const trail = answers.slice(0, 3).map((a) => ({
  id: a.id,
  title: a.title,
  contentText: a.contentText.slice(0, 1500),
  url: a.url,
  author: a.author,
  authoritylevel: a.authoritylevel,
  voteUpCount: a.voteUpCount,
  comments: a.comments.slice(0, 4),
  fromQuestion: "生化环材转行AI",
  readAt: Date.now(),
}));
let result = null;
{
  const t0 = Date.now();
  const r = await j("/api/roundtable/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trail, topicHint: "生化环材天坑专业想转行学 AI，不知道从哪开始" }),
  });
  const ms = Date.now() - t0;
  result = r.body;
  ok(r.status === 200, "POST /api/roundtable/analyze 200", `${ms}ms`);
  ok(
    ["anti_anxiety", "decision_debate", "topic_digest"].includes(result.mode),
    "自适应模式识别成功",
    result.mode,
  );
  ok(result.dialogues?.length >= 5, "四小只台词 >= 5 条", `${result.dialogues?.length} 条`);
  ok(typeof result.radar?.drynessScore === "number", "情绪与水分雷达三项齐全");
  ok(Boolean(result.controlCard?.oneLineTakeaway), "生成 3 分钟最小掌控卡");
  ok(Boolean(result.controlCard?.catBadgeName), "解锁主题小猫", result.controlCard?.catBadgeName);
  ok(result.meta?.trailCount === 3, "元信息回报已读篇数");

  const speakers = result.dialogues.map((d) => d.speaker);
  ok(speakers[0] === "purr_cat", "第一个开口的是呼噜猫（先接住情绪）", speakers[0]);
  ok(speakers.includes("owl"), "猫头鹰参与拆解");
  ok(speakers.includes("shiba"), "柴犬参与护短指路");
  ok(speakers.at(-1) === "kanshan", "刘看山最后收口");
  ok(new Set(speakers).size === 4, "四只小动物全部登场");
}

/* ---------- 4. 防幻觉：逐字溯源硬校验 ---------- */
console.log("\n[4] 防幻觉：引用必须逐字来自真实 API 原文");
{
  const srcBlob = norm(
    trail.map((t) => `${t.title}。${t.contentText}${t.comments.join("")}`).join(""),
  );
  const quoted = result.dialogues.filter((d) => d.quoteRef);
  ok(quoted.length > 0, "存在带原文引用的台词", `${quoted.length} 条`);

  const readQuotes = quoted.filter((d) => d.quoteRef.sourceTag.startsWith("READ_"));
  ok(
    readQuotes.every((d) => srcBlob.includes(norm(d.quoteRef.excerpt))),
    "READ_x 引文逐字命中用户已读原文（零编造）",
    `${readQuotes.length} 条校验`,
  );
  ok(
    quoted.every((d) => d.quoteRef.sourceUrl?.startsWith("http")),
    "每条引用均由服务端回填真实 URL",
  );
  ok(
    quoted.every((d) => d.quoteRef.sourceAuthor && d.quoteRef.sourceTitle),
    "每条引用均带真实作者与标题",
  );

  const trailUrls = new Set(trail.map((t) => t.url));
  ok(result.curatedSources?.length >= 1, "柴犬端出可溯源好帖", `${result.curatedSources?.length} 篇`);
  ok(
    result.curatedSources.every((s) => !trailUrls.has(s.url)),
    "推荐帖均为新内容（不重复用户已读）",
  );
  ok(
    result.curatedSources.every(
      (s) => s.url.startsWith("http") && s.author && s.title && s.why,
    ),
    "每篇推荐帖带真实链接/作者/标题/推荐理由",
  );
  ok(
    result.curatedSources.every((s) => s.voteUpCount >= 0 && s.excerpt.length > 10),
    "推荐帖含真实赞同数与原文摘录",
  );
}

/* ---------- 5. 三条台词红线 ---------- */
console.log("\n[5] 三条不可触碰的台词红线");
{
  const all = result.dialogues.map((d) => d.text).join("\n");
  ok(
    !/(写得烂|写得差|毫无价值|没有价值|垃圾回答|质量差)/.test(all),
    "红线1：绝不贬低任何知乎回答",
  );
  const cat = result.dialogues.find((d) => d.speaker === "purr_cat");
  ok(
    !/(不过|但是|你可以|建议你|应该先)/.test(cat.text),
    "红线2：呼噜猫首句零建议、零说教",
  );
  ok(
    !/(剩下的都没问题|其他都没问题)/.test(all),
    "红线3：不承诺「剩下的都没问题」",
  );
  ok(
    result.dialogues.every((d) => d.text.length <= 160),
    "每条台词简短口语（<=160 字）",
  );
  ok(
    result.dialogues.every((d) =>
      ["warm", "glasses", "angry_protect", "calm", "happy"].includes(d.mood),
    ),
    "微表情字段合法（驱动立绘切换）",
  );
}

/* ---------- 6. 自适应模式 ---------- */
console.log("\n[6] 三种自适应模式（§3.2）");
{
  const mk = (title, text) => [
    {
      id: "x1",
      title,
      contentText: text,
      url: "https://www.zhihu.com/answer/x1",
      author: "测试",
      authoritylevel: 2,
      voteUpCount: 10,
      comments: [],
      readAt: Date.now(),
    },
  ];

  const anx = await j("/api/roundtable/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trail: mk(
        "三个月零基础上岸",
        "很多人都在焦虑被裁员，35岁危机就在眼前，太难了。想要完整路线图的同学私信我领取资料，训练营名额有限。",
      ),
      topicHint: "我很焦虑要不要转行",
    }),
  });
  ok(anx.body.mode === "anti_anxiety", "焦虑+卖课 → 脱水拆解模式", anx.body.mode);
  ok(anx.body.radar.adRiskScore > 0, "引流嫌疑被识破（焦虑值低也拦得住）", `adRisk=${anx.body.radar.adRiskScore}`);

  const dec = await j("/api/roundtable/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trail: mk(
        "去深圳还是留老家，到底该怎么选",
        "两种选择各有利弊，值不值得去要看个人情况。2026年深圳岗位数据显示薪资中位数约 25k。",
      ),
      topicHint: "去深圳还是留老家怎么选",
    }),
  });
  ok(dec.body.mode === "decision_debate", "对比取舍 → 正反决策模式", dec.body.mode);
  ok(Boolean(dec.body.followUpQuestion?.choices?.length), "决策模式生成追问芯片");

  const dig = await j("/api/roundtable/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trail: mk(
        "如何看待某品牌洗发水事件",
        "11月10日官方回应称经核实未销售过该产品，记者已向相关部门求证。",
      ),
      topicHint: "如何看待这个热点事件",
    }),
  });
  ok(dig.body.mode === "topic_digest", "热点事件 → 速览模式", dig.body.mode);
}

/* ---------- 7. 追问与缓存 ---------- */
console.log("\n[7] 决策追问与结果缓存");
{
  const f = await j("/api/roundtable/follow-up", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ choiceId: "short_term", choiceLabel: "一年内的现金流", topicTitle: "t" }),
  });
  ok(f.status === 200, "POST /api/roundtable/follow-up 200");
  ok(f.body.dialogue?.speaker === "kanshan", "刘看山给出定制拍板");
  ok(Boolean(f.body.microAction), "追问后更新微动作");

  const f2 = await j("/api/roundtable/follow-up", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ choiceId: "long_term", choiceLabel: "三年后的复利", topicTitle: "t" }),
  });
  ok(f2.body.dialogue.text !== f.body.dialogue.text, "两种取舍给出不同建议");

  const t0 = Date.now();
  const again = await j("/api/roundtable/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trail, topicHint: "生化环材天坑专业想转行学 AI，不知道从哪开始" }),
  });
  ok(Date.now() - t0 < 600, "相同轨迹命中圆桌缓存（秒出）", `${Date.now() - t0}ms`);
  ok(again.body.meta.note === "命中缓存", "缓存标记正确");
}

/* ---------- 8. 边界与降级 ---------- */
console.log("\n[8] 边界保护与优雅降级");
{
  const empty = await j("/api/roundtable/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trail: [] }),
  });
  ok(empty.status === 400, "空轨迹返回 400");
  ok(/先去刷/.test(empty.body.message), "空轨迹文案温柔引导", `「${empty.body.message}」`);

  ok(
    typeof result.meta.llmUsed === "boolean" && typeof result.meta.degraded === "boolean",
    "meta 含 LLM 使用与降级标记",
    `llmUsed=${result.meta.llmUsed} degraded=${result.meta.degraded}`,
  );
  const flat = JSON.stringify(result);
  ok(!/example\.com|fake|mock|假数据/.test(flat), "结果中无任何伪造占位数据");
}

console.log(`\n${"─".repeat(58)}`);
console.log(`  通过 ${pass} · 失败 ${fail}`);
console.log(`${"─".repeat(58)}\n`);
process.exit(fail > 0 ? 1 : 0);
