/** Real chat route behind a temporary loopback HTTP adapter; upstream fetch is ONLY an in-memory fixture.
 * Normal and burst phases are bounded, fixed workloads. No credentials, public targets or live provider calls. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { performance } from "node:perf_hooks";
import { build } from "esbuild";

Object.assign(process.env, {
  NODE_ENV: "development",
  PET_CHAT_TEST: "1",
  PET_CHAT_MODEL: "pressure-fixture",
  QWEN_TOKEN_PLAN_INDIVIDUAL_API_KEY: "fixture-only",
});
const js = await build({
  entryPoints: ["src/app/api/roundtable/chat/route.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  plugins: [
    {
      name: "unit-server-boundary",
      setup(b) {
        b.onResolve({ filter: /^server-only$/ }, () => ({
          path: "boundary",
          namespace: "test",
        }));
        b.onLoad({ filter: /.*/, namespace: "test" }, () => ({
          contents: "export {};",
        }));
      },
    },
  ],
});
const localFetch = globalThis.fetch;
let active = 0,
  peak = 0,
  forwarded = 0;
globalThis.fetch = async (url, opt) => {
  assert.equal(
    url,
    "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions",
  );
  assert.equal(opt.headers.Authorization, "Bearer fixture-only");
  const sent = JSON.parse(opt.body);
  const v = JSON.parse(sent.messages.at(-1).content);
  const turns = v.同桌近况;
  const s = turns[0].text;
  peak = Math.max(peak, ++active);
  forwarded++;
  try {
    await new Promise((r) => setTimeout(r, 12)); // deterministic simulated service time, not an AI benchmark
    if (s.includes("限额")) return Response.json({}, { status: 429 });
    if (s.includes("超时")) throw new DOMException("fixture", "TimeoutError");
    const reply =
      turns.length > 1
        ? { speaker: "owl", text: "接：" + s }
        : { speaker: "shiba", text: "答：" + s };
    if (v.桌上原句)
      reply.evidence = s.includes("错句")
        ? "不是这篇原文。"
        : s.includes("没写")
          ? null
          : v.桌上原句.excerpt;
    return Response.json({
      choices: [{ message: { content: JSON.stringify(reply) } }],
    });
  } finally {
    active--;
  }
};
const route = await import(
  "data:text/javascript;base64," +
    Buffer.from(js.outputFiles[0].contents).toString("base64")
);
const http = createServer(async (req, res) => {
  try {
    const parts = [];
    for await (const part of req) parts.push(part);
    const r = await route.POST(
      new Request("http://" + req.headers.host + "/api/roundtable/chat", {
        method: "POST",
        headers: req.headers,
        body: Buffer.concat(parts),
      }),
    );
    res.writeHead(r.status, { "content-type": "application/json" });
    res.end(await r.text());
  } catch {
    res.writeHead(500);
    res.end("{}");
  }
});
http.listen(0, "127.0.0.1");
await once(http, "listening");
const base = `http://127.0.0.1:${http.address().port}/api/roundtable/chat`;
const send = async (pkt) =>
  localFetch(base, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(pkt),
  });
function example(i) {
  const n = i % 8,
    tag = `第${i}桌`,
    fact = "狗狗，刚读那篇用了哪两种颜色？";
  const text =
    tag + "，" +
    [
      "狗狗，我想走走。",
      "狗狗，谈谈不同意见。",
      fact,
      fact + "没写",
      fact + "错句",
      "狗狗，模拟限额",
      "狗狗，模拟超时",
      fact,
    ][n];
  const pkt = {
    mode: n === 1 ? "handoff" : "reader",
    turns: [{ speaker: "user", text }],
  };
  if (n === 1) pkt.turns.push({ speaker: "shiba", text: "同桌先说的。" });
  if (n >= 2 && n <= 4)
    pkt.reading = { title: tag, excerpt: tag + "夹了一绿一蓝两张书签。" };
  return { n, pkt, text };
}
async function phase(name, total, parallel) {
  peak = 0;
  forwarded = 0;
  const ms = [],
    counts = {};
  let index = 0;
  const run = async () => {
    while (index < total) {
      const { n, pkt, text } = example(index++);
      const t = performance.now();
      const res = await send(pkt);
      const j = await res.json();
      ms.push(performance.now() - t);
      if (j.error === "busy") {
        assert.equal(res.status, 429);
        counts.busy = (counts.busy ?? 0) + 1;
        continue;
      }
      const expected = [200, 200, 200, 200, 502, 429, 504, 422][n];
      assert.equal(res.status, expected, JSON.stringify(j));
      const named = [
        "reader",
        "handoff",
        "quote",
        "abstain",
        "ungrounded",
        "limited",
        "timeout",
        "no_reading",
      ][n];
      counts[named] = (counts[named] ?? 0) + 1;
      if (n === 0 || n === 1)
        assert.equal(j.reply.text, (n ? "接：" : "答：") + text);
      if (n === 2) assert.ok(j.reply.text.includes(pkt.reading.excerpt));
      if (n === 3) assert.match(j.reply.text, /没|不能/);
      if (n >= 4) assert.equal(j.error, named);
    }
  };
  const start = performance.now();
  await Promise.all(Array.from({ length: parallel }, run));
  ms.sort((a, b) => a - b);
  const pct = (n) => +ms[Math.ceil(n * total) - 1].toFixed(1);
  console.log(
    JSON.stringify({
      name,
      total,
      parallel,
      peakUpstream: peak,
      fixtureCalls: forwarded,
      counts,
      p50ms: pct(0.5),
      p95ms: pct(0.95),
      seconds: +((performance.now() - start) / 1000).toFixed(2),
    }),
  );
  assert.equal(active, 0);
  assert.ok(peak <= 4, `upstream peak ${peak}, allowed 4`);
  assert.equal(
    Object.values(counts).reduce((a, b) => a + b, 0),
    total,
  );
  if (parallel <= 4) assert.equal(counts.busy ?? 0, 0);
  else assert.ok(counts.busy > 0 && forwarded > 0);
}
try {
  await (await send(example(0).pkt)).text();
  await phase("steady", 160, 4);
  await phase("burst", 320, 16);
  await phase("recovered", 16, 4);
} finally {
  globalThis.fetch = localFetch;
  await new Promise((r) => http.close(r));
}
