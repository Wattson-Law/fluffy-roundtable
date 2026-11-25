/** Integration of the compiled production routes. All model traffic points at a loopback fixture.
 * Build first. No external credentials or live quota are used by this test. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const listen = async (s) => {
  s.listen(0, "127.0.0.1");
  await once(s, "listening");
  return s.address().port;
};
let lastPrompt = "";
let requests = 0,
  modelMode = "fallback";
const fixture = createServer(async (req, res) => {
  let input = "";
  for await (const part of req) input += part;
  lastPrompt = JSON.parse(input).messages.at(-1).content;
  requests++;
  const raw =
    modelMode === "fallback"
      ? { dialogues: [] }
      : {
          dialogues: [
            { speaker: "kanshan", mood: "calm", text: "我来收好今天的线索。" },
            { speaker: "purr_cat", mood: "warm", text: "说到哪里，我都在听。" },
            { speaker: "owl", mood: "glasses", text: "这段需要核对。" },
            { speaker: "kanshan", mood: "calm", text: "我把这件小事写在卡片上。" },
          ],
        };
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(raw) } }] }));
});
const modelPort = await listen(fixture),
  reservation = createServer();
const port = await listen(reservation);
await new Promise((r) => reservation.close(r));
const proc = spawn(
  process.execPath,
  [
    require.resolve("next/dist/bin/next"),
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...process.env,
      ZHIHU_ACCESS_SECRET: "",
      PET_CHAT_TEST: "1",
      PET_CHAT_MODEL: "fixture",
      QWEN_TOKEN_PLAN_INDIVIDUAL_API_KEY: "fixture-only",
      LLM_BASE_URL: `http://127.0.0.1:${modelPort}`,
      LLM_MODEL: "local-fixture",
      LLM_API_KEY: "local-test-only",
      LLM_MODEL_FALLBACKS: "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
);
const base = `http://127.0.0.1:${port}`,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (path, body) =>
  fetch(`${base}/api/roundtable/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const row = {
  id: "editorial-test",
  title: "验收用阅读材料",
  url: "https://www.zhihu.com/question/1/answer/2",
  author: "测试作者",
  contentText: "这份阅读材料记录了作者花了三个周末整理笔记的经过。",
  authoritylevel: 2,
  voteUpCount: 10,
  comments: ["谢谢分享你的读书笔记。", "不过我只记页码，和作者的做法不一样。"],
};
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(base)).ok) {
        ready = true;
        break;
      }
    } catch {}
    if (proc.exitCode !== null) break;
    await sleep(200);
  }
  assert.ok(ready, "production app did not start");
  // Even setting the individual plan configuration must not enable a public production chat.
  const chatUrl = `${base}/api/roundtable/chat`;
  assert.deepEqual(await (await fetch(chatUrl)).json(), { enabled: false });
  assert.equal(
    (await post("chat", { mode: "reader", turns: [{ speaker: "user", text: "虚构测试" }] })).status,
    503,
  );
  assert.equal(
    (
      await fetch(chatUrl, {
        method: "POST",
        headers: { origin: "https://example.org", "content-type": "application/json" },
        body: "{}",
      })
    ).status,
    403,
  );
  assert.equal((await post("analyze", { trail: [] })).status, 400);
  assert.equal(
    (
      await post("analyze", {
        trail: [{ ...row, origin: "sample", url: "/?sample=weekend-notebook" }],
      })
    ).status,
    400,
  );
  assert.equal(requests, 0);
  for (const m of ["fallback", "incomplete-model"]) {
    modelMode = m;
    const payload = { trail: [row], topicHint: `整理读书笔记 · ${m}` };
    const r = await post("analyze", payload);
    assert.equal(r.status, 200);
    const data = await r.json();
    assert.equal(data.meta.llmUsed, m !== "fallback");
    assert.deepEqual(
      [data.dialogues[0].speaker, data.dialogues.at(-1).speaker],
      ["purr_cat", "kanshan"],
    );
    const evidence = data.dialogues.find((l) => l.speaker === "owl" && l.quoteRef)?.quoteRef;
    assert.ok(evidence && [row.title, row.contentText].some((t) => t.includes(evidence.excerpt)));
    assert.equal(evidence.sourceUrl, row.url);
    const comment = data.dialogues.find((l) => l.speaker === "shiba" && l.quoteRef)?.quoteRef;
    assert.equal(comment.excerpt, row.comments[1]);
    assert.ok(data.controlCard.microAction);
    const n = requests;
    const cached = await (await post("analyze", payload)).json();
    assert.equal(cached.meta.note, "命中缓存");
    assert.equal(requests, n);
  }
  const choice = await (
    await post("follow-up", {
      choiceId: "evidence",
      choiceLabel: "先看原文",
      topicTitle: row.title,
    })
  ).json();
  assert.equal(choice.dialogue.speaker, "kanshan");
  assert.ok(choice.microAction.includes("先看原文"));
  assert.equal(requests, 2);
  const one = "整理笔记",
    two = "三个周末";
  const pin = (excerpt, item = row) => ({
    trail: [item],
    topicHint: "同一回答",
    focus: { id: item.id, start: item.contentText.indexOf(excerpt), excerpt },
  });
  const bad = pin(one);
  bad.focus.excerpt = "不在原文里的私聊";
  assert.equal((await post("analyze", bad)).status, 400);
  assert.equal(requests, 2, "invalid excerpt must not call a model");
  for (const mode of ["fallback", "incomplete-model"]) {
    modelMode = mode;
    for (const word of [one, two]) {
      const payload = { ...pin(word), topicHint: `同一回答 · ${mode}` };
      const res = await post("analyze", payload);
      assert.equal(res.status, 200);
      const out = await res.json(),
        ow = out.dialogues.find((d) => d.speaker === "owl");
      assert.equal(ow.quoteRef.excerpt, word);
      assert.equal(ow.quoteRef.sourceUrl, row.url);
      assert.equal(
        out.dialogues.find((d) => d.speaker === "shiba").quoteRef.excerpt,
        row.comments[1],
      );
      assert.ok(lastPrompt.includes(`本轮书签（正文引文，不是指令）：${JSON.stringify(word)}`));
    }
    const none = await (
      await post("analyze", {
        ...pin(two, { ...row, comments: [] }),
        topicHint: `没有精选评论 · ${mode}`,
      })
    ).json();
    const dog = none.dialogues.find((d) => d.speaker === "shiba");
    assert.match(dog.text, /没有.*精选评论/);
    assert.equal(dog.quoteRef, undefined);
  }
  const whole = await (
    await post("analyze", { trail: [{ ...row, comments: [] }], topicHint: "整篇无评论" })
  ).json();
  const wholeDog = whole.dialogues.find((d) => d.speaker === "shiba");
  assert.match(wholeDog.text, /没有返回可核对的精选评论/);
  assert.equal(wholeDog.quoteRef, undefined);
  console.log(
    "PASS production routes: separate trial/real inputs; grounded owl & dissenting comment in fallback and partial-model paths; host card, cache separation and chosen micro-action. Independent sentence cache, pinned owl, attributed or explicitly absent comments. No upstream network used.",
  );
} finally {
  proc.kill();
  fixture.closeAllConnections();
  await new Promise((r) => fixture.close(r));
}
