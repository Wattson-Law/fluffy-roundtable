// Small optional real-model observation, synthetic texts only. Never used for load.
import assert from "node:assert/strict";
if (!process.argv.includes("--live")) {
  console.log("Explicit --live required for two metered synthetic conversations.");
  process.exit(0);
}
const url = "http://127.0.0.1:3100/api/roundtable/chat";
const status = await (await fetch(url)).json();
assert.equal(status.enabled, true);
async function send(turns) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "reader", turns }),
  });
  const obj = await res.json();
  assert.equal(res.status, 200, obj.error);
  assert.equal(obj.source, "model");
  return obj.reply;
}
const correction = await send([
  { speaker: "user", text: "我想去读书会分享笔记，又有点不敢。" },
  { speaker: "purr_cat", text: "是不是怕上台时忘了要讲什么？" },
  { speaker: "user", text: "猫猫，不是怕上台，我是怕别人觉得我没读懂。" },
]);
console.log(status.model, correction.speaker, correction.text);
assert.equal(correction.speaker, "purr_cat");
assert.doesNotMatch(correction.text, /上台|忘词|列.{0,2}提纲|[？?]/);
const request = await send([
  {
    speaker: "user",
    text: "狗狗，我决定去学修钟了，给我打打气吧。只是下课时已经十点，回家的末班车九点半。",
  },
]);
console.log(status.model, request.speaker, request.text);
assert.equal(request.speaker, "shiba");
assert.doesNotMatch(request.text, /你可以先|不如先|哥看好你|打车|叫车|叫辆车/);
