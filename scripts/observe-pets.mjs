// Opt-in test only: these are invented scenarios, never browser/chat data. Run against a local server.
import assert from "node:assert/strict";
const base = new URL(process.argv[2] || "http://127.0.0.1:3100");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname));
const url = new URL("/api/roundtable/chat", base);
const get = await fetch(url);
assert.equal(get.status, 200, "missing cabin chat route");
const status = await get.json();
assert.equal(status.enabled, true, "local pet model test is disabled");
console.log("模型:", status.model);
let turns = [];
async function line(text, who) {
  if (text) turns.push({ speaker: "user", text });
  let slice = turns.slice(-7);
  slice = slice.slice(slice.findIndex((t) => t.speaker === "user"));
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: text ? "reader" : "handoff", turns: slice }),
  });
  const result = await r.json();
  assert.equal(r.status, 200, JSON.stringify(result));
  if (result.source === "reader_floor") {
    assert.equal(text, null, "Only the invited second pet may pass.");
    assert.equal(result.reply, undefined);
    console.log("〔另一位把话头留给读者，没有新气泡〕");
    return;
  }
  assert.equal(result.source, "model");
  assert.equal(result.model, status.model);
  if (who) assert.equal(result.reply.speaker, who);
  else assert.notEqual(result.reply.speaker, turns.at(-1)?.speaker);
  console.log(
    (text || "〔读者点「听另一位接话」〕") + "\n" + result.reply.speaker + "：" + result.reply.text,
  );
  turns.push(result.reply);
}
await line("猫猫，我已经报名周六的修钟课了。刚才在教室门口站了好久。今天先听我说。", "purr_cat");
await line("猫头鹰，我想去。我怕再问一遍，师傅会嫌我慢。哪些是我知道的，哪些只是我猜的？", "owl");
await line("狗狗，不分析了。我决定去上课，现在只想你给我打个气。", "shiba");
await line("看山，把刚才弄清的那件事留一句，什么时候进门我自己定。", "kanshan");
turns = [];
await line("狗狗，镇上只有一间阅览室，六点就关门，晚班的人赶不上。你觉得改哪一点最有用？", "shiba");
await line(null);

turns = [];
await line(
  "我想学这门手艺，可一想到第一天要跟一屋子陌生人说话就发怵。先听我说，不用给办法。",
  "purr_cat",
);
await line("现在我想练一句。刚才没听清，又不好意思问第二遍，能陪我试试怎么说吗？", "shiba");
