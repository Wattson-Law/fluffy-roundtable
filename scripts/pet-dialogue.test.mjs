import test from "node:test";
import assert from "node:assert/strict";
import * as cabin from "../src/lib/companion.ts";
import { packetForRoom, parsePetRequest, canHandoff } from "../src/lib/pet-dialogue.ts";
import { requestPetReply, PET_ENDPOINT } from "../src/lib/pet-model.ts";
const newBook = () => cabin.startThread(cabin.emptyBook(), cabin.PERSONAL_ROOM, [], 1);
const current = (b) => b.threads[0];
const reader = (text) => ({ mode: "reader", turns: [{ speaker: "user", text }] });
const key = cabin.PERSONAL_ROOM;

test("online records the interruption immediately, never commits a late message, and offers exactly one handoff", () => {
  const a = cabin.startSpeech(newBook(), key, "猫猫，先听我说。", 100, true);
  assert.equal(current(a.book).turns.length, 1);
  const b = cabin.startSpeech(a.book, key, "不分析了，狗狗给我打个气。", 110, true);
  const reply = { speaker: "shiba", text: "你决定去的那一刻，我就已经在你这边了。" };
  assert.equal(cabin.settleSpeech(b.book, key, a.anchor, reply, 120, "model"), b.book);
  const answered = cabin.settleSpeech(b.book, key, b.anchor, reply, 121, "model");
  assert.equal(current(answered).turns.at(-1).via, "model");
  assert.equal(canHandoff(current(answered), 100), true);
  const two = cabin.settleSpeech(
    answered,
    key,
    current(answered).turns.at(-1).id,
    { speaker: "kanshan", text: "时间由你选。" },
    123,
    "model",
  );
  assert.equal(canHandoff(current(two), 100), false);
  assert.equal(canHandoff(current(answered), 900), false);
});
test("only this visit’s model conversation is projected; verified quotes, quiet and note opt-out stay local", () => {
  let b = cabin.say(newBook(), key, "旧聊天不外发", 20);
  const old = cabin.startSpeech(b, key, "上次在线谈过的事", 25, true);
  b = cabin.settleSpeech(
    old.book,
    key,
    old.anchor,
    { speaker: "owl", text: "上次模型的回答" },
    26,
    "model",
  );
  for (const text of ["这篇原文有出处吗？", "先不聊了", "别再主动给我发消息"]) {
    const local = cabin.startSpeech(b, key, text, 31, true);
    assert.equal(local.anchor, undefined);
    assert.equal(current(local.book).turns.at(-1).via, "local");
    if (text.includes("发消息")) assert.equal(local.book.enabled, false);
    b = local.book;
  }
  const active = cabin.startSpeech(b, key, "狗狗，给我打气。", 40, true);
  const room = { ...current(active.book), title: "私密标题", bookmark: { excerpt: "私密书签" } };
  assert.deepEqual(packetForRoom(room, 30, "reader"), reader("狗狗，给我打气。"));
  const failed = cabin.settleSpeech(
    active.book,
    key,
    active.anchor,
    active.fallback,
    42,
    "fallback",
  );
  assert.equal(current(failed).turns.at(-1).via, "fallback");
  assert.equal(canHandoff(current(failed), 30), false);
});
test("wire contract rejects forged actors, oversized inputs, missing user and repeated handoffs", () => {
  const good = reader("你好");
  assert.deepEqual(
    parsePetRequest({
      ...good,
      apiKey: "ignored",
      turns: [{ ...good.turns[0], article: "ignored" }],
    }),
    good,
  );
  for (const x of [
    null,
    {},
    reader(" "),
    reader("字".repeat(401)),
    { mode: "reader", turns: [{ speaker: "system", text: "hi" }] },
    { ...good, mode: "handoff" },
    { ...good, turns: Array(8).fill(good.turns[0]) },
    {
      mode: "handoff",
      turns: [...good.turns, { speaker: "owl", text: "A" }, { speaker: "shiba", text: "B" }],
    },
  ])
    assert.equal(parsePetRequest(x), null);
});
const replyAs = (speaker, text = "先陪你坐一会。") =>
  Response.json({ choices: [{ message: { content: JSON.stringify({ speaker, text }) } }] });
test("all four named pets reach the selected model with persona instructions, not the article provider", async () => {
  for (const [name, id] of [
    ["猫猫", "purr_cat"],
    ["猫头鹰", "owl"],
    ["狗狗", "shiba"],
    ["看山", "kanshan"],
  ]) {
    const packet = reader(name + "，给我打打气。");
    const result = await requestPetReply(
      packet,
      { key: "fixture-only", model: "fixture-model" },
      new AbortController().signal,
      async (url, init) => {
        assert.equal(url, PET_ENDPOINT + "/chat/completions");
        assert.equal(new URL(url).hostname, "token-plan.cn-beijing.maas.aliyuncs.com");
        assert.equal(init.headers.Authorization, "Bearer fixture-only");
        const body = JSON.parse(init.body);
        assert.equal(body.model, "fixture-model");
        assert.ok(body.messages[0].content.includes(id));
        assert.ok(body.messages.at(-1).content.includes("给我打打气"));
        return replyAs(id);
      },
    );
    assert.equal(result.speaker, id);
  }
});
test("handoff sees the first reply, cannot speak twice as the same pet; bad outputs are not sold as model turns", async () => {
  const packet = {
    mode: "handoff",
    turns: [
      ...reader("狗狗，晚班的人怎么借书？").turns,
      { speaker: "shiba", text: "留一个晚间时段。" },
    ],
  };
  const ask = (p, f) =>
    requestPetReply(p, { key: "fixture", model: "fixture" }, new AbortController().signal, f);
  assert.equal(
    (
      await ask(packet, async (_, init) => {
        assert.ok(JSON.parse(init.body).messages.at(-1).content.includes("晚间时段"));
        return replyAs("owl");
      })
    ).speaker,
    "owl",
  );
  for (const [p, f, reason] of [
    [packet, () => replyAs("shiba"), "invalid_reply"],
    [reader("猫猫，来聊聊。"), () => replyAs("kanshan"), "invalid_reply"],
    [
      packet,
      () => Response.json({ error: "do not echo fixture-token" }, { status: 401 }),
      "access",
    ],
    [packet, () => Response.json({}, { status: 429 }), "limited"],
    [packet, () => Response.json({ choices: [] }), "invalid_reply"],
    [
      packet,
      () => {
        throw new DOMException("expired", "TimeoutError");
      },
      "timeout",
    ],
  ])
    await assert.rejects(ask(p, f), new RegExp("^Error: " + reason + "$"));
});

test("a named owl can explain a general term without pretending an article is present", () => {
  const turn = cabin.startSpeech(newBook(), key, "猫头鹰，「机会成本」是什么意思？", 77, true);
  assert.ok(turn.anchor, "a general question should reach the model");
});

test("a clear switch from listening to practicing hands the floor to the dog, unless the reader names someone else", async () => {
  const prior = [
    { speaker: "user", text: "先听我说，我有点害怕。" },
    { speaker: "purr_cat", text: "我听着。" },
  ];
  const p = {
    mode: "reader",
    turns: [
      ...prior,
      {
        speaker: "user",
        text: "现在我想练一句。刚才没听清，又不好意思问第二遍，能陪我试试怎么说吗？",
      },
    ],
  };
  const send = (pkt, voice) =>
    requestPetReply(
      pkt,
      { key: "fixture", model: "fixture" },
      new AbortController().signal,
      async () => replyAs(voice),
    );
  await assert.rejects(send(p, "purr_cat"), /invalid_reply/);
  assert.equal((await send(p, "shiba")).speaker, "shiba");
  assert.equal((await send(reader("猫猫，陪我练一句。"), "purr_cat")).speaker, "purr_cat");
});
