import test from "node:test";
import assert from "node:assert/strict";
import { emptyBook, startThread, startSpeech, settleSpeech } from "../src/lib/companion.ts";
import { canHandoff, readingForRoom, packetForRoom } from "../src/lib/pet-dialogue.ts";
import { requestPetReply } from "../src/lib/pet-model.ts";
import { asksReadingFact } from "../src/lib/table-reading.ts";
import { sampleItems } from "../src/lib/reading-samples.ts";

const article = sampleItems.find((a) => a.id === "weekend-notebook"),
  key = article.url;
const start = () => startThread(emptyBook(), key, [{ ...article, readAt: 1 }], 1);
const reading = readingForRoom(start().threads[0]);
const vent = "这篇里抖出来几张便签？算了，我现在只想吐槽。我对着同一页看了三遍，还是烦。";
const verify = "作者从书里抖出来几张便签？我只想核对这个数字。";
const fear = "我想去读书会分享这页笔记，就是有点不敢。";
const pkt = (text, last) => ({
  mode: last ? "handoff" : "reader",
  reading,
  turns: [{ speaker: "user", text }, ...(last ? [last] : [])],
});
const canPass = (room) =>
  canHandoff(room, 0, { ids: new Set(room.turns.map((t) => t.id)), reading });
const ask = async (p, value, observe = () => {}) => {
  let messages;
  const answer = await requestPetReply(
    p,
    { key: "fixture", model: "fixture" },
    new AbortController().signal,
    async (_, options) => {
      messages = JSON.parse(options.body).messages;
      return Response.json({ choices: [{ message: { content: JSON.stringify(value) } }] });
    },
  );
  if (messages) observe(messages);
  return answer;
};
function answered(text, reply) {
  const s = startSpeech(start(), key, text, 2, true, reading);
  assert.ok(s.anchor, text);
  return settleSpeech(s.book, key, s.anchor, reply, 3, "model").threads[0];
}

test("on the same page a reader can take back a factual question, or come back to it", async () => {
  assert.equal(asksReadingFact(vent, true), false);
  const free = startSpeech(start(), key, vent, 2, true); // should work WITHOUT sending the page
  assert.ok(free.anchor);
  assert.equal(packetForRoom(free.book.threads[0], 0, "reader").reading, undefined);
  assert.deepEqual(
    await ask(pkt(vent), { speaker: "purr_cat", text: "看了三遍还烦，嗯，我听着。" }),
    { speaker: "purr_cat", text: "看了三遍还烦，嗯，我听着。" },
  );
  for (const text of [
    verify,
    "刚才我想吐槽。现在只问文章：作者抖出了几张便签？",
    "我有点烦，但这次想知道文中谁去领了便签。",
  ])
    assert.equal(asksReadingFact(text, true), true, text);
  const local = startSpeech(start(), key, "只想核对带「满页箭头」的那句。", 5, true, reading);
  assert.equal(local.anchor, undefined);
  assert.match(local.book.threads[0].turns.at(-1).quoteRef.excerpt, /满页箭头/);
});

test("a verified fact is finished; neither a visible invitation nor a direct handoff calls a second model", async () => {
  const first = {
    speaker: "owl",
    text: "能核对的是这一句：「周六收拾桌子，我从书里抖出来三张便签。」",
  };
  assert.equal(canPass(answered(verify, first)), false);
  let calls = 0;
  assert.equal(
    await ask(pkt(verify, first), { speaker: "shiba", evidence: reading.excerpt }, () => calls++),
    null,
  );
  assert.equal(calls, 0);
  assert.match(
    (await ask(pkt(verify), { speaker: "owl", evidence: "周六收拾桌子，我从书里抖出来三张便签。" }))
      .text,
    /三张/,
  );
});

test("already willing is not asking for a plan; wait for the reader if the first pet has asked a question", async () => {
  const first = { speaker: "purr_cat", text: "你是想去的。哪一刻最让你犹豫？" };
  await assert.rejects(
    ask(pkt(fear), { speaker: "shiba", text: "那我给你列个计划。" }),
    /invalid_reply|off_intent/,
  );
  assert.equal(canPass(answered(fear, first)), false);
  let calls = 0;
  assert.equal(await ask(pkt(fear, first), {}, () => calls++), null);
  assert.equal(calls, 0);
  assert.equal(canPass(answered(fear, { ...first, text: "想去和不敢，可以同时是真的。" })), true);
  assert.equal(
    (await ask(pkt("猫头鹰，我想去读书会，就是有点不敢。"), { ...first, speaker: "owl" })).speaker,
    "owl",
  );
});

test("a voluntary second voice can listen or yield, without turning it into a task or a repeated speech", async () => {
  const first = { speaker: "purr_cat", text: "翻来翻去还是那一页，听着真让人烦。" };
  const p = pkt(vent, first);
  assert.equal(canPass(answered(vent, first)), true);
  const good = { speaker: "shiba", text: "你不用在我这儿交读书笔记，抱怨两句也行。" };
  assert.deepEqual(await ask(p, good), good);
  for (const value of [
    { pass: true },
    { ...good, text: "你可以先列三条计划。" },
    { ...good, text: "你最怕的是哪一步？" },
    { ...good, text: first.text },
  ])
    assert.equal(await ask(p, value), null);
  await assert.rejects(ask(pkt(vent), { pass: true }), /invalid_reply/);
  await assert.rejects(ask(p, { pass: true, speaker: "owl", text: "又说了一句" }), /invalid_reply/);
  await assert.rejects(ask(p, { ...good, speaker: "purr_cat" }), /invalid_reply/);
  const action = { speaker: "shiba", text: "你可以先挑一句最想分享的笔记。" };
  assert.deepEqual(
    await ask(
      pkt("现在我想试一下，能给我一个小建议吗？", {
        speaker: "owl",
        text: "可以从你熟悉的东西开始。",
      }),
      action,
    ),
    action,
  );
});

test("pure support omits the page and earlier article-only answers even when the reader has shared it", async () => {
  const oldUser = { speaker: "user", text: "猫头鹰，作者从书里抖出来几张便签？" };
  const oldAnswer = {
    speaker: "owl",
    text: "能核对的是这一句：「周六收拾桌子，我从书里抖出来三张便签。」",
  };
  const first = { speaker: "purr_cat", text: "看了三遍还是烦，嗯，我听着。" };
  const p = {
    mode: "reader",
    reading,
    turns: [
      { speaker: "user", text: "今天下班有点晚。" },
      { speaker: "kanshan", text: "窗边给你留个座。" },
      oldUser,
      oldAnswer,
      { speaker: "user", text: vent },
    ],
  };
  await ask(p, first, (m) => {
    const prompt = JSON.parse(m.at(-1).content);
    assert.equal(prompt.桌上原句, undefined);
    assert.deepEqual(prompt.同桌近况, [...p.turns.slice(0, 2), p.turns.at(-1)]);
  });
  await ask({ ...p, mode: "handoff", turns: [...p.turns, first] }, { pass: true }, (m) => {
    const prompt = JSON.parse(m.at(-1).content);
    assert.equal(prompt.桌上原句, undefined);
    assert.deepEqual(prompt.同桌近况.at(-1), first);
    assert.ok(!m.at(-1).content.includes("三张便签"));
  });
  const room = answered(vent, first);
  const scope = { ids: new Set(room.turns.map((t) => t.id)), reading };
  assert.equal(packetForRoom(room, 0, "handoff", scope).reading, undefined);
  const explicitlyUsing = "猫猫，用这段原文安慰我一下。";
  await ask(pkt(explicitlyUsing), { speaker: "purr_cat", text: "这句读起来挺温柔。" }, (m) =>
    assert.deepEqual(JSON.parse(m.at(-1).content).桌上原句, reading),
  );
});

test("asking what advice the author gave is not asking the pets to give advice", () => {
  for (const s of [
    "作者建议先做什么？",
    "文中的老师给了大家什么建议？",
    "故事里的同学安慰的是谁？",
    "我只想知道作者建议先做什么。",
    "帮我看看故事里的同学安慰的是谁。",
  ])
    assert.equal(asksReadingFact(s, true), true, s);
});

test("a comfort request cannot silently restore withdrawn material or turn into homework", async () => {
  const first = { speaker: "purr_cat", text: "我听着。" };
  for (const text of ["猫猫，别用这段原文安慰我。", "用这段原文安慰我。算了，我现在只想吐槽。"]) {
    await ask(pkt(text), first, (m) =>
      assert.equal(JSON.parse(m.at(-1).content).桌上原句, undefined),
    );
  }
  const noGrant = {
    mode: "reader",
    turns: [{ speaker: "user", text: "猫猫，用这段原文安慰我一下。" }],
  };
  await ask(noGrant, first, (m) => assert.equal(JSON.parse(m.at(-1).content).桌上原句, undefined));
  const task = { speaker: "purr_cat", text: "我知道了，你可以先列三条计划。" };
  await assert.rejects(ask(pkt(vent), task), /off_intent/);
});

test("sharing is not inferred from describing a past use of the passage; a scared reader is not assigned homework", async () => {
  const cat = { speaker: "purr_cat", text: "你慢慢说，我听着。" };
  await ask(pkt("猫猫，我昨天用这段原文做了张卡。今天只想有人听。"), cat, (m) =>
    assert.equal(JSON.parse(m.at(-1).content).桌上原句, undefined),
  );
  await ask(pkt("猫猫，可以结合刚才的原句，给我打打气吗？"), cat, (m) =>
    assert.deepEqual(JSON.parse(m.at(-1).content).桌上原句, reading),
  );
  await assert.rejects(ask(pkt(fear), { ...cat, text: "你可以先列一个分享提纲。" }), /off_intent/);
});

test("the host leaves a closing thought, not an invitation to start another round", async () => {
  const words = "看山，把刚才弄清的那件事留一句就好。";
  const last = { speaker: "kanshan", text: "是不是去分享，还是你自己定。" };
  assert.equal(canPass(answered(words, last)), false);
  let calls = 0;
  assert.equal(await ask(pkt(words, last), {}, () => calls++), null);
  assert.equal(calls, 0);
  assert.equal(canPass(answered("看山，我想在书签上留一句给明天的自己。", last)), true);
});

test("pinning an article never sends it with grocery errands or bedtime, directly or echoed in older model answers", async () => {
  const { materialForTurn } = await import("../src/lib/pet-turn-plan.ts");
  const history = [
    { speaker: "user", text: "这篇里有几张便签？" },
    { speaker: "owl", text: reading.excerpt },
  ];
  for (const text of ["帮我列一份明天买菜的清单。", "今晚想睡了。"]) {
    const p = materialForTurn({
      mode: "reader",
      reading,
      turns: [...history, { speaker: "user", text }],
    });
    assert.deepEqual(p, { mode: "reader", turns: [{ speaker: "user", text }] });
  }
  const night = startSpeech(start(), key, "今晚想睡了。", 8, true, reading);
  assert.equal(night.anchor, undefined);
  assert.match(night.book.threads[0].turns.at(-1).text, /晚安/);
});
