import test from "node:test";
import assert from "node:assert/strict";
import * as cabin from "../src/lib/companion.ts";
const at = 1_800_000_000_000;
function page(id, contentText) {
  return {
    id,
    title: id,
    url: `https://www.zhihu.com/question/1/answer/${id}`,
    readAt: at,
    author: "试验作者",
    authoritylevel: 0,
    voteUpCount: 0,
    comments: [],
    contentText,
  };
}
const old = page("1", "这里说的将就是薪水。"),
  here = page("2", "作者说：「别将就。」后面没有解释。"),
  key = here.url;
const intro = {
  dialogues: [
    { speaker: "purr_cat", text: "旧开场" },
    {
      speaker: "owl",
      text: "旧原文",
      quoteRef: {
        sourceTag: "READ_0",
        sourceUrl: old.url,
        excerpt: old.contentText,
      },
    },
    { speaker: "shiba", text: "旧分析" },
  ],
  curatedSources: [],
};
const book = () =>
  cabin.withResult(cabin.startThread(cabin.emptyBook(), key, [old, here], at), key, intro);
function exchange(b, ...lines) {
  return lines.reduce((state, text, i) => cabin.say(state, key, text, at + i + 1), b);
}
const last = (b) => b.threads.find((t) => t.key === key).turns.at(-1);
const questions = (text) => (text.match(/[？?]/g) ?? []).length;

test("A: quoted terms are grounded in this article, or openly missing; never substitute another read", () => {
  const r = last(exchange(book(), "这篇说的『将就』指什么？"));
  assert.equal(r.speaker, "owl");
  assert.equal(r.quoteRef?.sourceUrl, key);
  assert.ok(here.contentText.includes(r.quoteRef.excerpt));
  assert.match(r.text, /分不清|看不出|没.*(解释|交代|定义)|不够/);
  const absent = last(exchange(book(), "文中的『薪水』是什么意思？"));
  assert.equal(absent.quoteRef, undefined);
  assert.match(absent.text, /没|找不到|不够/);
});
test("A–D: analysis yields to willingness, one warm question, concrete obstacle and then just encouragement", () => {
  let b = exchange(book(), "能帮我分析一下利弊吗？");
  assert.equal(last(b).speaker, "owl");
  b = exchange(b, "我想去，就是心里有点打鼓。");
  assert.equal(last(b).speaker, "purr_cat");
  assert.match(last(b).text, /想去|想试/);
  assert.equal(questions(last(b).text), 1);
  assert.doesNotMatch(last(b).text, /利弊|失败/);
  b = exchange(b, "我怕没听懂师傅教的，又不敢问第二遍。");
  assert.equal(last(b).speaker, "shiba");
  assert.match(last(b).text, /再问|问一次|练/);
  assert.doesNotMatch(last(b).text, /为什么|最[怕担]/);
  b = exchange(b, "不用练。我已经想好了，给我打打气吧。");
  assert.equal(last(b).speaker, "shiba");
  assert.match(last(b).text, /相信|支持/);
  assert.doesNotMatch(last(b).text, /利弊|要不要|练|师傅|哥|[？?]/);
  assert.equal(
    cabin.nextLine(b, key, at + 10),
    b,
    "old article lines cannot come back via nextLine",
  );
});
test("direct D/E/F and explicit named support do not require preceding scenes", () => {
  for (const [name, who] of [
    ["猫猫", "purr_cat"],
    ["猫头鹰", "owl"],
    ["狗狗", "shiba"],
    ["看山", "kanshan"],
  ]) {
    const r = last(exchange(book(), `${name}，我已经决定了，不用分析，想听你给我加个油。`));
    assert.equal(r.speaker, who);
    assert.match(r.text, /信|支持|陪|站在你|为你/);
    assert.doesNotMatch(r.text, /[？?]|利弊|评论/);
    assert.equal(r.quoteRef, undefined);
  }
  const e = exchange(book(), "我想去，给我打打气吧。就是他们十点下班，我回家的末班车九点半。");
  assert.match(last(e).text, /支持|相信/);
  assert.match(last(e).text, /回家|末班车/);
  assert.match(last(e).text, /想|愿意/);
  assert.doesNotMatch(last(e).text, /查班表|查路线|建议|[？?]/);
  const f = last(exchange(e, "别光鼓励我。明天我能先做什么？"));
  assert.match(f.text, /班表|下班|末班车/);
  assert.doesNotMatch(f.text, /相信你|利弊/);
  assert.match(last(exchange(book(), "明天我能先做什么？")).text, /先/);
});
test("uncertainty is not permission to probe; corrections and topic changes replace stale assumptions", () => {
  const fear = exchange(book(), "我挺想试试，但我有点怕。");
  const unknown = last(exchange(fear, "说不上来。"));
  assert.equal(questions(unknown.text), 0);
  assert.doesNotMatch(unknown.text, /失败|没车/);
  const correction = exchange(fear, "不是怕学不会，是我怕晚上没车回家。");
  assert.match(last(correction).text, /回家|车/);
  assert.doesNotMatch(last(correction).text, /学不会|胆小/);
  const newTopic = last(exchange(correction, "换件事。我想学画，给我加油吧。"));
  assert.doesNotMatch(newTopic.text, /车|师傅/);
  assert.doesNotMatch(last(exchange(fear, "我不想去了，只想说说。")).text, /你是想去|去试试|[？?]/);
});
test("an offer is not action: saying yes rehearses once, declining does not start the exercise", () => {
  const offer = exchange(book(), "没听清对方说的话，我不敢再问。");
  assert.doesNotMatch(last(offer).text, /「|“/);
  assert.match(last(exchange(offer, "好啊，试试。")).text, /再说一次|再讲一遍|再说一遍/);
  assert.doesNotMatch(last(exchange(offer, "不用了，听我说就好。")).text, /再说一遍|[？?]/);
});
test("no article, no analysis dependency and no fabricated source; a restored room is still reader-led", () => {
  const k = cabin.PERSONAL_ROOM;
  let b = cabin.startThread(cabin.emptyBook(), k, [], at);
  b = cabin.say(b, k, "没读文章，原文在哪？", at + 1);
  assert.equal(b.threads.length, 1);
  assert.deepEqual(b.threads[0].context, []);
  const reply = b.threads[0].turns.at(-1);
  assert.equal(reply.speaker, "owl");
  assert.equal(reply.quoteRef, undefined);
  const restored = JSON.parse(JSON.stringify(exchange(book(), "不用分析，给我点鼓励。")));
  assert.equal(cabin.nextLine(restored, key, at + 10), restored);
});
test("a folded room receives an invitation, not another transcript line; claiming twice speaks once", () => {
  const b = exchange(book(), "比较两个选择时我拿不定主意");
  const before = b.threads[0].turns.length;
  const offered = cabin.catCheckIn(b, at + cabin.IDLE_MS + 10, {
    visible: true,
    busy: false,
    activeKey: null,
  });
  assert.equal(offered.threads[0].turns.length, before);
  assert.ok(offered.pending);
  const opened = cabin.takeNote(offered, key, at + cabin.IDLE_MS + 20);
  assert.equal(opened.pending, null);
  assert.equal(opened.threads[0].turns.length, before + 1);
  assert.equal(last(opened).kind, "note");
  assert.match(last(opened).text, /选择/);
  assert.equal(cabin.takeNote(opened, key, at + cabin.IDLE_MS + 30), opened);
  assert.equal(cabin.dismissNote(offered).threads[0].turns.length, before);
});

test("a refusal is not an action request, and acknowledging a difficulty is not consent to a plan", () => {
  for (const text of ["先别告诉我该怎么做。", "不用再分析利弊，能夸我两句吗？"]) {
    const r = last(exchange(book(), text));
    assert.doesNotMatch(r.text, /先挑|两件事|什么在吸引|利弊|付出代价/);
  }
  assert.match(
    last(exchange(book(), "其实我有点怵，能不能替我加把劲？")).text,
    /相信|支持|在你这边/,
  );
  const a = exchange(book(), "我怕考试考不好", "嗯");
  assert.doesNotMatch(last(a).text, /先挑|先记|先在明天/);
});
test("another person's feelings and a new project do not inherit my commute or willingness", () => {
  const t = exchange(book(), "我想去，可晚上没车回家。");
  const third = last(exchange(t, "是我朋友担心，我是替她问的。"));
  assert.doesNotMatch(third.text, /你紧张|你是想|你心里|回家|晚了/);
  const unrelated = last(exchange(t, "我最近想学画画，能给我鼓鼓劲吗？"));
  assert.doesNotMatch(unrelated.text, /回家|没车/);
  assert.match(unrelated.text, /相信|支持|在你这边/);
});
test("a card reply prepared in another tab cannot overwrite the reader's newer exchange", () => {
  const b = cabin.nextLine(book(), key, at);
  const expected = last(b).id;
  const latest = exchange(b, "先别分析，想听句鼓励。");
  assert.equal(
    cabin.acceptChoice(
      latest,
      key,
      "旧选择",
      { text: "迟到的答复", microAction: "旧建议" },
      at + 20,
      expected,
    ),
    latest,
  );
});

test("the tab remembers its last conversation, not the article shelf; a new read or clear resets the seat", async () => {
  const storage = await import("../src/lib/storage.ts");
  const local = new Map(),
    session = new Map();
  const store = (m) => ({
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
  });
  globalThis.window = { localStorage: store(local), sessionStorage: store(session) };
  try {
    storage.pushTrail(here);
    const b = storage.updateBook(() =>
      cabin.say(
        cabin.startThread(cabin.emptyBook(), cabin.PERSONAL_ROOM, [], at),
        cabin.PERSONAL_ROOM,
        "帮我打气",
        at + 1,
      ),
    );
    storage.rememberSeat(b.threads[0]);
    assert.equal(storage.seatedRoom(), cabin.PERSONAL_ROOM);
    assert.doesNotMatch([...session.values()].join(""), /写字|打气|zhihu/);
    local.set("fr.readingHistory.v1", JSON.stringify([{ ...old, readAt: at + 500 }]));
    assert.equal(storage.seatedRoom(), undefined);
    storage.rememberSeat(b.threads[0]);
    storage.clearCompanion();
    assert.equal(storage.seatedRoom(), undefined);
    assert.equal(session.size, 0);
  } finally {
    delete globalThis.window;
  }
});
