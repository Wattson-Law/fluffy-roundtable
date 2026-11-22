// Test preload ONLY: exchange the isolated server's one public search via the official CLI
// (or replay an explicitly supplied public capture). Never read, copy, or export its keychain.
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { readFile } = require("node:fs/promises");
const { isAbsolute } = require("node:path");
const run = promisify(execFile),
  env = process.env,
  original = globalThis.fetch;
let search;
async function publicEnvelope() {
  if (env.BOOKMARK_PUBLIC_CAPTURE) {
    const c = JSON.parse(await readFile(env.BOOKMARK_PUBLIC_CAPTURE, "utf8"));
    if (c.query !== env.BOOKMARK_PUBLIC_QUERY || !Array.isArray(c.items))
      throw Error("Unexpected public capture");
    return { Code: 0, Data: { Items: c.items } };
  }
  if (!isAbsolute(env.BOOKMARK_PUBLIC_CLI || "")) throw Error("Absolute official CLI required");
  const childEnv = { ...env };
  delete childEnv.ZHIHU_ACCESS_SECRET;
  const { stdout } = await run(
    env.BOOKMARK_PUBLIC_CLI,
    ["search", "zhihu", "--query", env.BOOKMARK_PUBLIC_QUERY, "--count", "10"],
    { env: childEnv, timeout: 30000, maxBuffer: 4 * 1024 * 1024, windowsHide: true },
  );
  const data = JSON.parse(stdout);
  if (data.Code !== 0 || !Array.isArray(data.Data?.Items))
    throw Error("Official public search unavailable");
  return data;
}
globalThis.fetch = async function (input, init) {
  const u = new URL(
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
  );
  if (["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)) return original(input, init);
  if (
    u.origin === "https://developer.zhihu.com" &&
    u.pathname === "/api/v1/content/zhihu_search" &&
    u.searchParams.get("Query") === env.BOOKMARK_PUBLIC_QUERY
  ) {
    search ??= publicEnvelope();
    return Response.json(await search);
  }
  // Force unrelated hot lists, recommendation searches, model and quota requests offline.
  return Response.json({ Code: -1, Message: "not part of this acceptance run" }, { status: 503 });
};
