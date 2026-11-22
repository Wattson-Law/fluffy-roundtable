import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyBook,
  startThread,
  withResult,
  nextLine,
  say,
  catCheckIn,
  dismissNote,
  IDLE_MS,
  DAY,
  shapeRoles,
  setNotes,
  selectComment,
} from "../src/lib/companion.ts";
import { getHistory, getTrail, pushTrail, clearTrail } from "../src/lib/storage.ts";
const at = 1_800_000_000_000;
const item = (n) => ({
  id: `${n}`,
  title: `读到第${n}篇`,
  url: `https://zhuanlan.zhihu.com/p/${n}`,
  author: "作者",
  contentText: "原文中写了三个周末。",
  comments: ["我走的是另一条路。"],
  commentCount: 1,
  authoritylevel: 1,
  voteUpCount: 3,
  readAt: at,
});
const key = item(1).url;
const owl = {
  speaker: "owl",
  mood: "glasses",
  text: "我回到原文看了一遍。",
  quoteRef: { sourceTag: "READ_0", excerpt: "三个周末", sourceUrl: key },
};
const script = [
  { speaker: "purr_cat", mood: "warm", text: "你的话我听着呢。" },
  owl,
  { speaker: "shiba", mood: "happy", text: "这是另一种实际经验。" },
  { speaker: "kanshan", mood: "calm", text: "我把线索放在卡片上。" },
];
const result = {
  topicTitle: "和选择有关的一篇",
  mode: "topic_digest",
  radar: {},
  dialogues: script,
  curatedSources: [],
  meta: { trailCount: 1 },
  controlCard: { oneLineTakeaway: "先分清两种说法。", microAction: "抄下一句原文。" },
};
const fresh = () => withResult(startThread(emptyBook(), key, [item(1)], at), key, result);
const active = () =>
  say(nextLine(fresh(), key, at), key, "我还在比较两个选择，拿不定主意。", at + 1);
const ready = { visible: true, busy: false, activeKey: null };
test("reading migrates legacy entries; keeps history beyond five, deduplicates revisits and survives blocked storage", () => {
  const map = new Map([["fr.readingTrail", JSON.stringify([item(0)])]]);
  globalThis.window = {
    localStorage: { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) },
  };
  assert.equal(getHistory()[0].url, item(0).url);
  for (let i = 1; i <= 7; i++) pushTrail(item(i), "阅读书架");
  pushTrail(item(2), "重读");
  assert.deepEqual(
    getTrail().map((x) => x.id),
    ["4", "5", "6", "7", "2"],
  );
  assert.equal(getHistory().length, 8);
  assert.equal(getHistory().at(-1).visits, 2);
  clearTrail();
  assert.equal(getHistory().length, 0);
  assert.equal(getTrail().length, 0);
  window.localStorage = {
    getItem: () => {
      throw Error("denied");
    },
    setItem: () => {
      throw Error("denied");
    },
  };
  pushTrail(item(9));
  assert.equal(getTrail()[0].id, "9");
  window.localStorage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
  clearTrail();
  delete globalThis.window;
});
test("next line only advances on request; same thread resumes and new articles are separate", () => {
  let b = nextLine(fresh(), key, at);
  assert.equal(b.threads[0].cursor, 1);
  b = startThread(b, key, [item(1)], at);
  assert.equal(b.threads[0].turns.length, 1);
  b = startThread(b, item(2).url, [item(2)], at);
  assert.equal(b.threads.find((t) => t.key === item(2).url).turns.length, 0);
});
test("only a real typed exchange can prompt a single, contextual cat note after a wait", () => {
  assert.equal(catCheckIn(nextLine(fresh(), key, at), at + DAY, ready).pending, null);
  const b = active();
  assert.equal(catCheckIn(b, at + IDLE_MS - 1, ready), b);
  const sent = catCheckIn(b, at + IDLE_MS + 5, ready);
  assert.equal(sent.threads[0].turns.at(-1).speaker, "purr_cat");
  assert.match(sent.threads[0].turns.at(-1).text, /选择|两条路/);
  assert.ok(sent.pending);
  const read = dismissNote(JSON.parse(JSON.stringify(sent)));
  assert.equal(catCheckIn(read, at + 2 * DAY, ready), read);
});
test("no intrusion for hidden tabs, typing, another room, opt-out, private subjects, daily cooldown or old conversations", () => {
  const b = active();
  for (const env of [
    { ...ready, visible: false },
    { ...ready, busy: true },
    { ...ready, activeKey: "other" },
  ])
    assert.equal(catCheckIn(b, at + IDLE_MS + 5, env), b);
  for (const text of ["先不聊了", "请不要再提醒我", "我的身份证是123456789"]) {
    const s = say(b, key, text, at + 2);
    assert.equal(catCheckIn(s, at + DAY, ready), s);
  }
  assert.equal(catCheckIn(b, at + 9 * DAY, ready), b);
  const s = catCheckIn(b, at + IDLE_MS + 5, ready);
  const t = say(s, key, "我还想聊一聊", at + IDLE_MS + 8);
  assert.equal(catCheckIn(t, at + IDLE_MS * 3, ready), t);
});
test("remember earlier human context, never parrot private details or make up citations", () => {
  let b = say(active(), key, "嗯嗯", at + 9);
  b = catCheckIn(b, at + IDLE_MS + 15, ready);
  assert.match(b.threads[0].turns.at(-1).text, /选择|两条路/);
  assert.equal(
    say(active(), key, "我想看看原文证据", at + 5).threads[0].turns.at(-1).quoteRef.sourceUrl,
    key,
  );
  assert.equal(
    say(active(), key, "评论里还有别的经验吗", at + 5).threads[0].turns.at(-1).speaker,
    "shiba",
  );
  assert.equal(say(active(), key, "帮我收个尾", at + 5).threads[0].turns.at(-1).speaker, "kanshan");
});
test("model outputs cannot skip the cat opening, evidence, dog or host", () => {
  const l = shapeRoles([script[3], { ...owl, quoteRef: undefined }], script);
  assert.equal(l[0].speaker, "purr_cat");
  assert.ok(l.some((x) => x.speaker === "owl" && x.quoteRef));
  assert.ok(l.some((x) => x.speaker === "shiba"));
  assert.equal(l.at(-1).speaker, "kanshan");
});
test("reading cap is 100; editorial trials and real discussion contexts are never mixed", () => {
  const map = new Map();
  globalThis.window = {
    localStorage: { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) },
  };
  for (let i = 0; i < 103; i++) pushTrail(item(i));
  assert.equal(getHistory().length, 100);
  assert.equal(getHistory()[0].id, "3");
  const sample = { ...item("trial"), origin: "sample", url: "/?sample=two-bookmarks" };
  pushTrail(sample);
  assert.equal(getTrail().length, 1);
  assert.ok(JSON.parse(map.get("fr.readingTrail")).every((t) => !t.origin));
  pushTrail(item(100));
  assert.equal(getTrail().length, 5);
  assert.ok(getTrail().every((t) => !t.origin));
  clearTrail();
  delete globalThis.window;
});
test("mute/unmute needs fresh conversation; stop cues cannot trigger unsolicited notes", () => {
  const b = active(),
    off = setNotes(b, false),
    on = setNotes(off, true);
  assert.equal(catCheckIn(on, at + 2 * IDLE_MS, ready), on);
  const n = say(on, key, "想接着聊摄影", at + 2 * IDLE_MS + 10);
  assert.match(catCheckIn(n, at + 3 * IDLE_MS + 20, ready).threads[0].turns.at(-1).text, /拍照/);
  const no = say(b, key, "不要主动给我发消息", at + 2);
  assert.equal(no.enabled, false);
  assert.equal(catCheckIn(no, at + DAY, ready), no);
});
test("dog favors a traceable counterexample over an unrelated comment", () => {
  const c = selectComment([
    { comments: ["谢谢作者分享这篇记录。"] },
    { comments: ["不过我的出发点不一样，我用了一周。"] },
  ]);
  assert.equal(c.index, 1);
  assert.match(c.excerpt, /我的出发点不一样/);
  assert.equal(c.contrast, true);
  assert.equal(selectComment([{ comments: [] }]), undefined);
});
