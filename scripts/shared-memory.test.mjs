import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyBook,
  startThread,
  startSpeech,
  say,
  catCheckIn,
  takeNote,
  dismissNote,
  setNotes,
  PERSONAL_ROOM,
  DAY,
  IDLE_MS,
} from "../src/lib/companion.ts";
import { sampleItems } from "../src/lib/reading-samples.ts";
const t = Date.UTC(2026, 9, 22, 5),
  ready = { visible: true, busy: false, activeKey: null };
const page = {
  ...sampleItems[0],
  readAt: t,
  title: "找工作焦虑，我已经入职了",
  contentText: "作者说：我找工作很焦虑，家里有一只猫。",
};
const born = () => startThread(emptyBook(), page.url, [page], t);
const mine = "我上个月开始找工作，最近投简历特别焦虑。";
const talk = (book, text, at = t, key = page.url) => say(book, key, text, at);
const memory = (b) => b.memories ?? [];
const last = (b, key) => b.threads.find((x) => x.key === key).turns.at(-1);
const ask = (b, key, text, at = t + 32 * DAY) => startSpeech(b, key, text, at, true);
test("reading, quoted or third-party worries, guesses and identifiers never become personal memories", () => {
  for (const text of [
    "",
    "作者写着「我最近找工作很焦虑」。",
    "我朋友说她最近找工作很焦虑。",
    "你猜我养猫吗？",
    "如果我找工作很焦虑呢？",
    "我找工作很焦虑，手机号是13800000000。",
  ]) {
    const b = text ? talk(born(), text) : born();
    assert.equal(memory(b).length, 0, text);
    assert.equal(catCheckIn(b, t + 32 * DAY, ready).pending, null, text);
  }
});
test("a dated reader statement alone can be offered a month later, never pursued or exposed outside", () => {
  const b = talk(born(), mine);
  assert.equal(memory(b).length, 1);
  assert.ok(memory(b)[0].sourceTurn && memory(b)[0].at === t);
  assert.ok(!JSON.stringify(memory(b)).includes(mine));
  for (const env of [
    { ...ready, busy: true },
    { ...ready, visible: false },
  ])
    assert.strictEqual(catCheckIn(b, t + 32 * DAY, env), b);
  assert.strictEqual(catCheckIn(b, t + IDLE_MS - 1, ready), b);
  const offer = catCheckIn(b, t + 32 * DAY, ready);
  assert.ok(offer.pending?.memoryId);
  assert.equal(
    offer.threads.reduce((s, r) => s + r.turns.length, 0),
    b.threads.reduce((s, r) => s + r.turns.length, 0),
  );
  const inside = takeNote(offer, offer.pending.key, t + 32 * DAY + 1);
  assert.match(last(inside, offer.pending.key).text, /上个月.*找工作.*最近/);
  assert.strictEqual(catCheckIn(dismissNote(offer), t + 65 * DAY, ready).pending, null);
  const reenabled = setNotes(setNotes(b, false), true);
  assert.equal(catCheckIn(reenabled, t + 32 * DAY, ready).pending, null);
});
test("four named pets share the corrected fact across rooms, but never send the private memory to the provider", () => {
  let b = talk(born(), mine);
  b = startThread(b, PERSONAL_ROOM, [], t + 1);
  b = talk(b, "我已经入职了。", t + 2, PERSONAL_ROOM);
  assert.equal(memory(b).length, 1);
  assert.match(memory(b)[0].label, /入职/);
  assert.doesNotMatch(memory(b)[0].label, /焦虑/);
  for (const [name, id] of [
    ["猫猫", "purr_cat"],
    ["猫头鹰", "owl"],
    ["狗狗", "shiba"],
    ["看山", "kanshan"],
  ]) {
    const x = ask(b, PERSONAL_ROOM, name + "，还记得我上次找工作的事吗？");
    assert.equal(x.anchor, undefined);
    const r = last(x.book, PERSONAL_ROOM);
    assert.equal(r.speaker, id);
    assert.match(r.text, /入职/);
    assert.doesNotMatch(r.text, /焦虑/);
  }
  const wrong = talk(b, "不是我，是我朋友已经入职了。", t + 3, PERSONAL_ROOM);
  assert.equal(memory(wrong).length, 0);
});
test("muting a particular subject does not erase it, forgetting does; neither becomes a new prompt and pending invites are withdrawn", () => {
  let b = talk(born(), mine);
  b = catCheckIn(b, t + DAY, ready);
  assert.ok(b.pending);
  const muted = ask(b, page.url, "以后别主动问工作。", t + DAY + 1);
  assert.equal(muted.anchor, undefined);
  assert.equal(muted.book.pending, null);
  assert.ok(muted.book.enabled);
  assert.equal(memory(muted.book).length, 1);
  assert.equal(catCheckIn(muted.book, t + 32 * DAY, ready).pending, null);
  const recalled = ask(muted.book, page.url, "猫头鹰，你记得我上次找工作的事吗？");
  assert.match(last(recalled.book, page.url).text, /找工作/);
  const forgotten = ask(recalled.book, page.url, "忘了这件事。");
  assert.equal(forgotten.anchor, undefined);
  assert.equal(memory(forgotten.book).length, 0);
  assert.ok(forgotten.book.memoryEpoch > 0);
  const unknown = ask(forgotten.book, page.url, "狗狗，还记得我上回在忙什么吗？");
  assert.doesNotMatch(last(unknown.book, page.url).text, /找工作|入职|焦虑/);
  assert.equal(catCheckIn(forgotten.book, t + 65 * DAY, ready).pending, null);
});
test("reader corrections focus on the new barrier, not the discarded guess, in both local and online paths", async () => {
  const correction = "不是怕上台，我是怕别人觉得我没读懂。";
  const b = talk(born(), correction);
  const r = last(b, page.url);
  assert.match(r.text, /没读懂/);
  assert.doesNotMatch(r.text, /上台|[？?]|先做/);
  const { requestPetReply } = await import("../src/lib/pet-model.ts");
  const first = { speaker: "purr_cat", text: "是怕上台吗？" };
  const turns = [
    { speaker: "user", text: "我想去读书会讲讲。" },
    first,
    { speaker: "user", text: correction },
  ];
  let input;
  const result = await requestPetReply(
    { mode: "reader", turns },
    { model: "fixture", key: "fixture" },
    new AbortController().signal,
    async (_, o) => {
      input = JSON.parse(o.body).messages;
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                speaker: "purr_cat",
                text: "让你在意的是别人会怎么理解，不是笔记的好坏。",
              }),
            },
          },
        ],
      });
    },
  );
  assert.ok(result);
  assert.ok(!JSON.parse(input.at(-1).content).同桌近况.some((t) => t.text === first.text));
});

test("asked-for reminders stay local; reporting or ignoring a passage, a denial or a memory request is not a new fact", () => {
  const put = ask(born(), page.url, "帮我记住，我在准备第一次读诗会。", t);
  assert.equal(put.anchor, undefined);
  assert.equal(memory(put.book)[0].label, "我在准备第一次读诗会");
  assert.ok(catCheckIn(put.book, t + 32 * DAY, ready).pending?.memoryId);
  const no = ask(put.book, page.url, "别记这件事了。", t + 11);
  assert.equal(memory(no.book).length, 0);
  for (const text of [
    "我还没找到工作。",
    "我不再找工作了。",
    "我昨天读的文章里说我最近找工作很焦虑。",
    "我想知道作者建议怎么找工作。",
    "我想找工作吗？",
  ])
    assert.equal(memory(talk(born(), text)).length, 0, text);
  const updated = memory(talk(talk(born(), mine), "我已经找到工作了，还没入职。", t + 1));
  assert.match(updated[0].label, /找到工作/);
  assert.doesNotMatch(updated[0].label, /入职/);
});

test("the provider sees the affirmed words, not the rejected guess; an unrelated request or the user’s local transcript is never rewritten", async () => {
  const raw = "猫猫，不是怕上台，我是怕别人觉得我没读懂。";
  const b = talk(born(), raw);
  assert.equal(b.threads[0].turns.at(-2).text, raw);
  const { petMessages } = await import("../src/lib/pet-personas.ts");
  const prompt = (s) =>
    JSON.parse(
      petMessages({ mode: "reader", turns: [{ speaker: "user", text: s }] }).at(-1).content,
    );
  const projected = prompt(raw);
  assert.doesNotMatch(projected.同桌近况.at(-1).text, /上台/);
  assert.match(projected.同桌近况.at(-1).text, /怕别人觉得我没读懂/);
  const act = "不是怕上台，我是怕别人觉得我没读懂。现在给我一个建议。";
  assert.equal(prompt(act).同桌近况.at(-1).text, act);
});

test("an unknown named past subject is not an invitation to expose or erase the only known memory", () => {
  const b = talk(born(), mine);
  const unknown = ask(b, page.url, "还记得我上次搬家的事吗？");
  assert.match(last(unknown.book, page.url).text, /没有记下/);
  assert.doesNotMatch(last(unknown.book, page.url).text, /工作/);
  const keep = ask(b, page.url, "忘了我说过的搬家的事吧。");
  assert.deepEqual(memory(keep.book), memory(b));
});

test("a carried-over invite enters the current empty window, never the closed tab’s article or transcript", () => {
  const earlier = talk(born(), "今天看笔记的时候读乱了。");
  const invite = catCheckIn(earlier, t + IDLE_MS + 1, { ...ready, resumeKey: page.url });
  assert.ok(invite.pending);
  assert.equal(catCheckIn(earlier, t + IDLE_MS + 1, { ...ready, resumeKey: null }).pending, null);
  const current = takeNote(invite, page.url, t + DAY, PERSONAL_ROOM);
  const room = current.threads.find((v) => v.key === PERSONAL_ROOM);
  assert.deepEqual(room.context, []);
  assert.equal(room.turns.length, 1);
  assert.doesNotMatch(room.turns[0].text, /笔记|书签|找工作/);
  assert.equal(current.threads.find((v) => v.key === page.url).turns.length, 2);
});

test("a long-term memory never copies the article URL or the passage-bearing seat key", async () => {
  const key = "seat:an-exact-excerpt-that-belongs-to-the-article";
  const b = talk(startThread(emptyBook(), key, [page], t), mine, t, key);
  assert.doesNotMatch(JSON.stringify(memory(b)), /an-exact-excerpt|weekend-notebook/);
  const legacy = { ...memory(b)[0], sourceRoom: key };
  const { normalizeMemories } = await import("../src/lib/shared-memory.ts");
  assert.equal(normalizeMemories([legacy])[0].sourceRoom, undefined);
});

test("a reader-chosen memory can be retrieved by its unambiguous subject without quoting the full note", () => {
  const b = ask(born(), page.url, "帮我记住，我在准备第一次读诗会。", t).book;
  const result = ask(b, page.url, "狗狗，还记得我上次读诗会的事吗？");
  assert.equal(result.anchor, undefined);
  assert.match(last(result.book, page.url).text, /准备第一次读诗会/);
  const many = ask(b, page.url, "帮我记住，我在准备第二次读诗会。", t + 7).book;
  assert.doesNotMatch(
    last(ask(many, page.url, "还记得我的读诗会吗？").book, page.url).text,
    /第一次|第二次/,
  );
});
