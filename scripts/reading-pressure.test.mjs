import test from "node:test";
import assert from "node:assert/strict";
import * as cabin from "../src/lib/companion.ts";
import * as wire from "../src/lib/pet-dialogue.ts";
import { requestPetReply } from "../src/lib/pet-model.ts";

const row = (name, body) => ({
  id: name,
  url: "/?sample=" + name,
  title: name,
  origin: "sample",
  author: "试读",
  contentText: body,
  comments: ["私有评论"],
  readAt: 1,
});
const old = row("old", "上一篇不该发送。");
const cur = row(
  "now",
  "桌上有两张纸。绿纸留给同意的句子，蓝纸留给想再想的句子。第三句不应发送。\n另一段不应发送。",
);
const key = cur.url;
const init = () => cabin.startThread(cabin.emptyBook(), key, [old, cur], 1);
const q = "狗狗，刚读那篇用了哪两种颜色？分别拿来做什么？";
const src = {
  title: "now",
  excerpt: "桌上有两张纸。绿纸留给同意的句子，蓝纸留给想再想的句子。",
};
const room = (b) => b.threads.find((r) => r.key === key);
const response = (value) =>
  Response.json({ choices: [{ message: { content: JSON.stringify(value) } }] });

test("preview is at most two actual sentences from the current source, pinned clips never expand", () => {
  const r = room(init());
  assert.deepEqual(wire.readingForRoom(r), src);
  assert.deepEqual(
    wire.readingForRoom({
      ...r,
      bookmark: {
        sourceId: cur.id,
        url: key,
        excerpt: "蓝纸留给想再想的句子。",
      },
    }),
    { title: "now", excerpt: "蓝纸留给想再想的句子。" },
  );
  assert.equal(
    wire.readingForRoom({
      ...r,
      bookmark: { sourceId: old.id, url: old.url, excerpt: "上一篇" },
    }),
    null,
  );
  assert.equal(wire.readingForRoom({ ...r, context: [row("x", "  ")] }), null);
  const long = wire.readingForRoom({
    ...r,
    context: [row("书".repeat(120), "🐈".repeat(200) + "。")],
  });
  assert.ok([...long.excerpt].length <= 160 && !long.excerpt.includes("�"));
});

test("unshared reading question stays local; granting only adds the displayed title and excerpt", () => {
  const a = cabin.startSpeech(init(), key, q, 2, true);
  assert.equal(a.anchor, undefined);
  assert.equal(room(a.book).turns.at(-1).via, "local");
  const b = cabin.startSpeech(a.book, key, q, 3, true, src);
  assert.ok(b.anchor);
  const r = room(b.book),
    ids = new Set([b.anchor]);
  const pkt = wire.packetForRoom(r, 0, "reader", { ids, reading: src });
  assert.deepEqual(pkt, {
    mode: "reader",
    turns: [{ speaker: "user", text: q }],
    reading: src,
  });
  assert.deepEqual(
    wire.parsePetRequest({
      ...pkt,
      reading: { ...src, url: key, author: "不发" },
    }),
    pkt,
  );
  assert.equal(
    wire.parsePetRequest({
      ...pkt,
      reading: { ...src, excerpt: "字".repeat(161) },
    }),
    null,
  );
  assert.equal(
    wire.packetForRoom(r, 0, "reader", {
      ids,
      reading: { ...src, title: "old" },
    })?.reading,
    undefined,
  );
  assert.equal(wire.packetForRoom(r, 0, "reader", { ids: new Set() }), null);
});

test("factual speech is extracted from the displayed passage, not unsupported model prose", async () => {
  const p = {
    mode: "reader",
    turns: [{ speaker: "user", text: q }],
    reading: src,
  };
  const ask = (extra, packet = p) =>
    requestPetReply(
      packet,
      { key: "fixture", model: "stub" },
      new AbortController().signal,
      async (_, req) => {
        assert.deepEqual(JSON.parse(JSON.parse(req.body).messages.at(-1).content).桌上原句, src);
        return response({
          speaker: "shiba",
          text: "朱砂红用于圈注。",
          ...extra,
        });
      },
    );
  const line = "绿纸留给同意的句子，蓝纸留给想再想的句子。";
  assert.ok((await ask({ evidence: line })).text.includes(line));
  for (const evidence of ["朱砂红。", "。"]) await assert.rejects(ask({ evidence }), /ungrounded/);
  assert.match((await ask({ evidence: null })).text, /没|不够|不能/);
  let hit = false;
  await assert.rejects(
    requestPetReply(
      { ...p, reading: undefined },
      { key: "fixture", model: "stub" },
      new AbortController().signal,
      async () => {
        hit = true;
        return response({});
      },
    ),
    /no_reading/,
  );
  assert.equal(hit, false);
});

import { leavesReading } from "../src/lib/turn-intent.ts";
import { asksReadingFact } from "../src/lib/table-reading.ts";
test("other reading topics: actor, time, argument and object vs a request for emotional support", () => {
  for (const question of [
    "文中是谁提议延长开放时间的？",
    "这篇故事里的活动什么时候开始？",
    "刚看的那篇主要讲了啥？",
    "作者用了什么工具？",
  ])
    assert.ok(asksReadingFact(question, true), question);
  for (const question of [
    "刚读完有点难过，陪我坐会儿。",
    "如果只标自己同意的段落，你怎么看？",
    "我决定了只是有点害怕。",
  ])
    assert.equal(asksReadingFact(question, true), false);
  assert.ok(leavesReading("咱们聊点别的吧。"));
  assert.ok(leavesReading("先不谈这篇了。"));
  assert.equal(leavesReading("我不想换个话题，还想聊书签。"), false);
});
test("explicit source lookup still finds a later sentence, not the preview of the opening", () => {
  const r = row("detail", "开头无关。还是开头。\n陶老师在礼堂发了青纸。");
  const b = cabin.startThread(cabin.emptyBook(), r.url, [r], 1);
  const s = cabin.startSpeech(
    b,
    r.url,
    "猫头鹰，列出原文里「陶老师」用了什么工具的那句。",
    7,
    true,
  );
  assert.equal(s.anchor, undefined);
  assert.match(s.book.threads[0].turns.at(-1).quoteRef.excerpt, /陶老师/);
});

test("short follow-up factual questions use the article without treating personal questions as recall", () => {
  for (const question of [
    "那场活动定在几点？",
    "他后来去了哪里？",
    "一共办了几场？",
    "分别是什么时候？",
  ]) {
    assert.equal(asksReadingFact(question, true), true, question);
    assert.equal(asksReadingFact(question, false), false, question);
  }
  for (const question of [
    "你觉得这篇文章哪一点最有趣？",
    "我周末该选哪几种颜色穿？",
    "我几点出门比较好？",
  ]) {
    assert.equal(asksReadingFact(question, true), false, question);
  }
});

test("ending this article is not ending the reader’s next conversation", () => {
  const next = "这篇先不聊了，我想聊聊面试。";
  for (const text of [next, "原文别发给模型。", "先别把这段发给伙伴。"])
    assert.ok(leavesReading(text), text);
  for (const text of ["先别撤下原句。", "我不想聊聊别的。"])
    assert.equal(leavesReading(text), false, text);
  const muteExcerpt = cabin.startSpeech(init(), key, "先别把这段发给伙伴。", 8, true, src);
  assert.equal(muteExcerpt.anchor, undefined);
  assert.match(room(muteExcerpt.book).turns.at(-1).text, /不再带|撤下/);
  assert.ok(cabin.startSpeech(init(), key, next, 9, true).anchor, "the new topic can have a reply");
  assert.equal(cabin.startSpeech(init(), key, "今天先不聊了，晚安。", 9, true).anchor, undefined);
});
