import assert from "node:assert/strict";
import test from "node:test";
import * as listening from "../src/lib/listening-topics.ts";

const intent = (text, atDesk = false) => listening.readListeningIntent(text, atDesk);

test("pick one story, take one turn, and consent to continuous listening are different requests", () => {
  for (const text of ["你们挑新闻", "你们挑一条新闻聊聊，我听着。", "帮我挑个话题吧"]) {
    assert.deepEqual(intent(text), { kind: "hot" }, text);
  }
  for (const text of ["继续聊我听着", "你们接着聊，我听着。", "你们继续，我旁听就好"]) {
    assert.deepEqual(intent(text), { kind: "listen" }, text);
  }
  for (const [text, kind] of [
    ["没兴趣", "next"],
    ["换一条吧", "next"],
    ["还是聊上一题", "back"],
    ["再听一句", "step"],
    ["先停一下", "stop"],
  ]) {
    assert.deepEqual(intent(text, true), { kind }, text);
    assert.equal(intent(text), null, text);
  }
});

test("only a short public scope is a search; a reader's question and hearsay stay local", () => {
  assert.deepEqual(intent("聊点科技的"), { kind: "scope", query: "科技" });
  assert.deepEqual(intent("聊点天文新闻吧"), { kind: "scope", query: "天文" });
  assert.deepEqual(intent("聊聊公共图书馆该不该晚点关门？"), {
    kind: "reader",
    title: "公共图书馆该不该晚点关门？",
  });
  assert.deepEqual(intent("我来出题：为什么海水是咸的？"), {
    kind: "reader",
    title: "为什么海水是咸的？",
  });
  assert.deepEqual(intent("我听说，市图书馆想延长开放时间"), {
    kind: "rumor",
    title: "市图书馆想延长开放时间",
  });
});

test("an interruption belongs to the reader, even at the listening desk", () => {
  for (const text of [
    "今晚想睡了",
    "我对这个岗位没兴趣",
    "我听说我爸住院了",
    "我听说老板要裁员，我很慌",
    "我听说室友打算搬走",
    "我听说图书馆要裁员，我担心明天轮到我",
    "聊聊我的工作吧",
    "聊点我和同事闹矛盾的",
    "聊聊我听说的那件私事",
    "聊点科技的，其实我只想吐槽",
    "你们挑新闻这几个字怎么翻译？",
    "先别挑新闻，陪我坐会儿",
    "我女儿说‘继续聊我听着’",
    "我听着",
    "继续加班真的好累",
    "我想去，给我打打气吧",
  ])
    assert.equal(intent(text, true), null, text);
});

// Invented fixtures, never network requests. Order is deliberately unrelated to the IDs.
const library = {
  id: "h9",
  title: "图书馆该不该晚点关门？",
  summary: "阅览室正在征集晚间开放时段的意见。",
  url: "https://www.zhihu.com/question/91",
};
const chip = {
  id: "h1",
  title: "怎样比较两款芯片？",
  summary: "测试者给两款芯片安排了同一个任务。",
  url: "https://www.zhihu.com/question/12",
};
const board = [library, chip];
const sciPost = {
  id: "s",
  title: "小芯片怎么散热？",
  contentText: "作者把温度计放在两块散热片旁边。",
  url: "https://zhuanlan.zhihu.com/p/42",
  voteUpCount: 1314,
  comments: [],
};

test("use the live list in received order; samples, duplicates and made-up source links don't get seats", () => {
  assert.deepEqual(listening.hotTopics(board, false), []);
  const items = listening.hotTopics(
    [
      library,
      { ...chip, origin: "sample" },
      { ...library, id: "duplicate" },
      chip,
      { id: "empty", title: "", summary: "not a title" },
      { title: "没有原帖链接", url: "https://www.zhihu.com" },
      { title: "外链不是知乎原帖", url: "https://www.zhihu.com.fake.test/question/1" },
      { title: "不能点击脚本", url: "javascript:void(0)" },
    ],
    true,
  );
  assert.deepEqual(
    items.map((x) => x.title),
    [library.title, chip.title, "没有原帖链接", "外链不是知乎原帖", "不能点击脚本"],
  );
  assert.equal(items[0].url, library.url);
  assert.equal(items[0].excerpt, library.summary);
  assert.ok(items.slice(2).every((x) => !x.url));
});

test("scope search only asks the same-origin route for the short scope, and drops unrelated hits", async () => {
  let call;
  const controller = new AbortController();
  const found = await listening.searchListeningTopics(
    "科技",
    controller.signal,
    async (url, init) => {
      call = { url, init };
      return Response.json({
        degraded: false,
        items: [
          { ...library, contentText: library.summary },
          { ...sciPost, origin: "sample" },
          sciPost,
          sciPost,
        ],
      });
    },
  );
  assert.ok(call.url.startsWith("/api/zhihu/search?"));
  const q = new URL(call.url, "https://local.test");
  assert.equal(q.searchParams.get("q"), "科技");
  assert.equal(call.init.signal, controller.signal);
  assert.deepEqual(
    found.map((t) => [t.origin, t.title, t.excerpt, t.url]),
    [["search", sciPost.title, sciPost.contentText, sciPost.url]],
  );
});

test("a degraded service is not a result, and an unsafe search term never leaves the desk", async () => {
  const signal = new AbortController().signal;
  await assert.rejects(
    listening.searchListeningTopics("科技", signal, async () =>
      Response.json({ degraded: true, items: [sciPost] }),
    ),
  );
  let requests = 0;
  await assert.rejects(
    listening.searchListeningTopics("我听说老板想辞退我，我不知道怎么办", signal, async () => {
      requests++;
    }),
  );
  assert.equal(requests, 0);
});

const flush = () => new Promise((done) => setImmediate(done));
function desk(options = {}) {
  const lines = [];
  const session = listening.createListeningSession({
    getFeed: () => ({ hot: board, live: true }),
    request: () => {
      throw new Error("Unexpected request");
    },
    ...options,
    onLine: (line) => lines.push(line),
  });
  return { ...session, lines, state: session.getSnapshot };
}

test("one pick stays put; hear evidence and a partner's idea, see the next card, return to the previous one", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const d = desk();
  assert.equal(d.handleText("你们挑一条新闻聊聊，我听着"), true);
  assert.equal(d.state().topic.title, library.title);
  assert.equal(d.state().continuous, false);
  t.mock.timers.tick(120_000);
  assert.equal(d.lines.length, 1);
  d.step();
  assert.equal(d.state().activeLine.speaker, "owl");
  assert.ok(d.state().activeLine.text.includes(library.summary));
  d.step();
  assert.equal(d.state().activeLine.speaker, "shiba");
  assert.match(d.state().activeLine.text, /阅览室|自习室/u);
  assert.doesNotMatch(d.state().activeLine.text, /网友|评论说|高赞/u);
  assert.equal(d.state().hasMoreLines, false);
  assert.equal(d.state().upNext.title, chip.title);
  t.mock.timers.tick(180_000);
  assert.equal(d.lines.length, 3);
  assert.ok(d.handleText("没兴趣"));
  assert.equal(d.state().topic.url, chip.url);
  assert.ok(d.handleText("还是聊上一题"));
  assert.equal(d.state().topic.url, library.url);
  assert.equal(d.state().activeLine.topic.url, library.url);
  assert.ok(d.lines.every((l) => l.kind === "listening" && l.via === "local"));
  assert.equal(new Set(d.lines.map((l) => l.id)).size, d.lines.length);
});

test("explicit listening advances slowly through distinct stories, then ends without wrapping", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const d = desk();
  assert.ok(d.handleText("继续聊我听着"));
  t.mock.timers.tick(5_000);
  assert.equal(d.lines.length, 1);
  for (let i = 0; i < 12; i++) t.mock.timers.tick(60_000);
  assert.deepEqual([...new Set(d.lines.map((l) => l.topic.title))], [library.title, chip.title]);
  assert.equal(d.state().continuous, false);
  assert.ok(d.lines.some((l) => l.text.includes(chip.summary)));
  const count = d.lines.length;
  t.mock.timers.tick(600_000);
  d.listen(); // a finished list does not silently replay the first item
  t.mock.timers.tick(600_000);
  assert.equal(d.lines.length, count);
});

test("draft/hidden/closed rooms cannot publish a late line or automatically resume", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let visible = true;
  const d = desk({ canSpeak: () => visible });
  d.listen();
  d.stop(); // parent onDraftStart
  assert.equal(d.state().topic.title, library.title);
  t.mock.timers.tick(90_000);
  assert.equal(d.lines.length, 1);
  d.listen();
  visible = false; // even if the browser timer beats visibilitychange
  t.mock.timers.tick(90_000);
  assert.equal(d.state().continuous, false);
  assert.equal(d.lines.length, 1);
  visible = true;
  t.mock.timers.tick(90_000);
  assert.equal(d.lines.length, 1);
  d.listen();
  d.cancel(); // fold, switch tables, unmount
  t.mock.timers.tick(90_000);
  assert.equal(d.state().topic, undefined);
  assert.equal(d.state().activeLine, undefined);
  assert.equal(d.lines.length, 1);
});

test("a scoped request stays scoped when skipping; late replies after a replacement, stop or cancel are inert", async () => {
  const pending = [];
  const d = desk({
    request: (url, init) =>
      new Promise((resolve) => pending.push({ url, signal: init.signal, resolve })),
  });
  const answer = (n) => pending[n].resolve(Response.json({ degraded: false, items: [sciPost] }));
  d.handleText("聊点科技的");
  d.handleText("聊点天文的");
  assert.ok(pending[0].signal.aborted);
  answer(0);
  await flush();
  assert.equal(d.lines.length, 0);
  answer(1); // a chip hit isn't an astronomy hit
  await flush();
  assert.match(d.state().notice, /没.*天文/u);
  assert.equal(d.state().topic, undefined);
  d.handleText("聊点科技的");
  d.stop();
  assert.ok(pending[2].signal.aborted);
  answer(2);
  await flush();
  assert.equal(d.lines.length, 0);
  d.handleText("聊点科技的");
  d.cancel();
  answer(3);
  await flush();
  assert.equal(d.lines.length, 0);
  assert.equal(d.state().notice, "");
  d.handleText("聊点科技的");
  answer(4);
  await flush();
  assert.equal(d.state().topic.url, sciPost.url);
  d.handleText("没兴趣");
  assert.match(d.state().notice, /科技/u);
  assert.equal(d.state().upNext, undefined);
  assert.equal(d.lines.length, 1); // never backfill with an unscoped hot item
});

test("no live hot list is honest; bring a topic locally, and treat a rumor as hypothetical, not a search or a fact", () => {
  const sent = [];
  const d = desk({
    getFeed: () => ({ hot: board, live: false }),
    request: (url) => {
      sent.push(url);
    },
  });
  d.pickHot();
  assert.equal(d.state().topic, undefined);
  assert.match(d.state().notice, /没.*热榜/u);
  assert.equal(d.lines.length, 0);
  assert.ok(d.handleText("聊聊公共图书馆该不该晚点关门？"));
  assert.equal(d.state().topic.origin, "reader");
  assert.ok(d.handleText("我听说市图书馆要延长开放时间"));
  assert.equal(d.state().topic.origin, "rumor");
  assert.match(d.state().activeLine.text, /假设|未核实|未经证实/u);
  assert.equal(d.state().topic.url, undefined);
  d.step();
  assert.match(d.state().activeLine.text, /如果|假如|要是/u);
  assert.equal(d.handleText("我听说图书馆要裁员，我很慌"), false);
  assert.equal(d.state().activeLine, undefined);
  assert.deepEqual(sent, []);
});

test("rejecting the only remaining card yields the floor instead of resuming the rejected story", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const d = desk({ getFeed: () => ({ hot: [library], live: true }) });
  d.listen();
  assert.ok(d.handleText("这个没兴趣，换一条吧"));
  assert.equal(d.state().activeLine, undefined);
  assert.match(d.state().notice, /没有下一条/u);
  d.listen();
  t.mock.timers.tick(180_000);
  assert.equal(d.lines.length, 1);
});

test("local listening turns can be saved distinctly from the reader's normal chat replies", () => {
  const d = desk();
  d.pickHot();
  assert.equal(d.lines[0].kind, "listening");
  assert.equal(d.lines[0].via, "local");
  assert.deepEqual(intent("你们聊点科技的吧"), { kind: "scope", query: "科技" });
  assert.deepEqual(intent("我听说火星上发现了水"), { kind: "rumor", title: "火星上发现了水" });
  assert.equal(intent("我听说火星上发现了水，可我这几天特别难受"), null);
});

test("a skip before search returns cancels it, and a request for a missing previous card does not let the timer talk", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal, finish;
  const d = desk({
    request: (_, init) =>
      new Promise((resolve) => {
        signal = init.signal;
        finish = resolve;
      }),
  });
  d.handleText("聊点科技的");
  assert.ok(d.handleText("没兴趣"));
  assert.ok(signal.aborted);
  finish(Response.json({ degraded: false, items: [sciPost] }));
  await flush();
  assert.equal(d.lines.length, 0);
  d.pickHot();
  d.listen();
  d.handleText("还是聊上一题");
  assert.match(d.state().notice, /还没.*上一题/u);
  t.mock.timers.tick(60_000);
  assert.equal(d.lines.length, 1);
});

test("a space story is not a sports result just because both contain 球; next uses the second actual scoped hit", async () => {
  const football = {
    title: "足球联赛怎么安排？",
    contentText: "原文列出赛程。",
    url: "https://www.zhihu.com/question/6",
  };
  const hockey = {
    title: "冰球的护具怎么选？",
    contentText: "原帖在比较护具。",
    url: "https://www.zhihu.com/question/7",
  };
  const moon = {
    title: "月球探测器发回图像",
    contentText: "一张环形山的图。",
    url: "https://www.zhihu.com/question/8",
  };
  let requests = 0;
  const d = desk({
    request: async () => {
      requests++;
      return Response.json({ degraded: false, items: [moon, football, hockey] });
    },
  });
  await d.findScope("体育");
  assert.equal(d.state().topic.url, football.url);
  d.handleText("没兴趣");
  assert.equal(d.state().topic.url, hockey.url);
  assert.equal(requests, 1);
});

test("mentioning a prompt or trailing a personal disclosure is not a public topic command", () => {
  for (const text of [
    "公共话题也不是人人都感兴趣",
    "话题是不是太难了？",
    "我听说市图书馆要闭馆，最近什么都提不起劲",
    "聊点咱俩昨天吵架的",
  ]) {
    assert.equal(intent(text, true), null, text);
  }
  assert.deepEqual(intent("我听说我们市图书馆要晚点关门，你们怎么看？"), {
    kind: "rumor",
    title: "我们市图书馆要晚点关门",
  });
});

test("the reader takes the floor before the first public line; asking for evidence never verifies hearsay", () => {
  const events = [];
  const d = listening.createListeningSession({
    getFeed: () => ({ hot: [library], live: true }),
    onLine: (l) => events.push(l.text),
  });
  assert.ok(d.handleText("我听说市图书馆要延长开放时间", () => events.push("reader")));
  assert.equal(events[0], "reader");
  assert.equal(d.handleText("这件事已经证实了吗？"), true);
  assert.match(events.at(-1), /没有|未证实|未经证实/);
  assert.equal(d.getSnapshot().continuous, false);
  assert.equal(
    d.handleText("其实我只是想说说", () => events.push("private leaked")),
    false,
  );
  assert.ok(!events.includes("private leaked"));
});
test("a public turn retires article dialogue but is not a private message, memory or a prompt for the model", async () => {
  const { recordListeningTurn, emptyBook, startThread, catCheckIn, DAY } = await import(
    "../src/lib/companion.ts"
  );
  const { packetForRoom } = await import("../src/lib/pet-dialogue.ts");
  const key = "cabin:window";
  let b = startThread(emptyBook(), key, [], 100);
  b = recordListeningTurn(b, key, "user", "你们挑一条新闻聊聊，我听着。", 101);
  b = recordListeningTurn(b, key, "owl", "头条的提问不等于结论。", 102);
  const r = b.threads[0];
  assert.deepEqual(
    r.turns.map((t) => [t.speaker, t.kind]),
    [
      ["user", "listening"],
      ["owl", "listening"],
    ],
  );
  assert.ok(r.conversation);
  assert.equal(packetForRoom(r, 0, "reader"), null);
  assert.ok(!b.memories?.length);
  assert.equal(catCheckIn(b, DAY, { visible: true, busy: false, activeKey: null }).pending, null);
});

test("a follow-up about comments or opinions stays with the public story, not the private article underneath", async () => {
  const d = desk({
    request: async () =>
      Response.json({
        degraded: false,
        items: [{ ...sciPost, comments: ["这组芯片测试标出了温度。"] }],
      }),
  });
  d.pickHot();
  assert.ok(d.handleText("这条新闻的评论区怎么说？"));
  assert.match(d.lines.at(-1).text, /没有.*评论/);
  assert.ok(d.handleText("狗狗，你怎么看？"));
  assert.equal(d.lines.at(-1).speaker, "shiba");
  await d.findScope("科技");
  assert.ok(d.handleText("网友怎么说？"));
  assert.match(d.lines.at(-1).text, /这组芯片测试标出了温度/);
  assert.match(d.lines.at(-1).text, /不代表|不是所有/);
  assert.equal(d.lines.at(-1).topic.url, sciPost.url);
  assert.equal(d.handleText("网友怎么说不重要，我只想有人听。"), false);
});
