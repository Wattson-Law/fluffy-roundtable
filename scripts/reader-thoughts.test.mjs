import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildSync, transformSync } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as thoughts from "../src/lib/reader-thoughts.ts";

const first = { id: "note-1", text: "想再弄清楚末班车时间", createdAt: 100 };
const second = { id: "note-2", text: "怎么问第二遍？", createdAt: 200 };

test("an explicit save keeps just the reader's line, independent of any chat, passage or decision", () => {
  const saved = thoughts.saveReaderThought(undefined, {
    ...first,
    text: `  ${first.text}  `,
    excerpt: "整段原文",
    roomKey: "夹签原句",
    turns: ["私人聊天"],
    draft: "未确认的输入",
    microAction: "替读者拍板",
  });
  assert.deepEqual(saved, [first]);
  const before = Object.freeze(saved);
  assert.deepEqual(thoughts.saveReaderThought(before, second), [second, first]);
  assert.deepEqual(before, [first]);
});

test("a legacy or damaged shelf restores only distinct, visible, short single-line thoughts", () => {
  assert.deepEqual(thoughts.validateReaderThoughts(undefined), []);
  assert.deepEqual(thoughts.validateReaderThoughts({ threads: [first] }), []);
  const emoji = { ...second, text: "🌱".repeat(80) };
  const bad = [
    null,
    7,
    { ...first, id: "" },
    { ...first, id: "x".repeat(200) },
    { ...first, createdAt: NaN },
    { ...first, createdAt: -1 },
    { ...first, createdAt: "100" },
    ...[null, " ", "\u200b", "前\n后", "前\u2028后", "前\0后", "🌱".repeat(81)].map((text) => ({
      ...first,
      text,
    })),
  ];
  const raw = [
    ...bad,
    { ...first, draft: "不要恢复", bookmark: { excerpt: "不公开" } },
    { ...first, text: "重放旧编号不能覆盖原话" },
    emoji,
  ];
  assert.deepEqual(thoughts.validateReaderThoughts(raw), [first, emoji]);
  for (const row of bad) assert.deepEqual(thoughts.saveReaderThought([second], row), [second]);
  assert.deepEqual(thoughts.saveReaderThought([first], { ...first, text: "改写" }), [first]);
});

test("a full shelf refuses a new line without evicting an old one; removing one frees just that spot", () => {
  const full = Object.freeze(Array.from({ length: 30 }, (_, i) => ({ ...first, id: `kept-${i}` })));
  assert.deepEqual(thoughts.saveReaderThought(full, second), full);
  assert.deepEqual(thoughts.validateReaderThoughts([null, ...full, second]), full);
  assert.deepEqual(thoughts.removeReaderThought(undefined, "never-saved"), []);
  assert.deepEqual(thoughts.removeReaderThought(full, "not-here"), full);
  const rest = thoughts.removeReaderThought(full, full[0].id);
  assert.deepEqual(thoughts.saveReaderThought(rest, second), [second, ...full.slice(1)]);
  assert.equal(full.length, 30);
});

const answer = "https://www.zhihu.com/question/12/answer/34";
const sample = "/?sample=two-bookmarks";
test("only the canonical article address or an actual bundled sample survives a local round trip", () => {
  for (const [given, expected] of [
    [`${answer}?utm_source=private#reader`, answer],
    ["http://zhihu.com/question/12/answer/34/", answer],
    ["https://zhuanlan.zhihu.com/p/123", "https://zhuanlan.zhihu.com/p/123"],
    [sample, sample],
  ]) {
    const row = { ...first, sourceUrl: given, sourceBody: "不能夹带正文" };
    assert.deepEqual(thoughts.saveReaderThought(undefined, row), [
      { ...first, sourceUrl: expected },
    ]);
    assert.deepEqual(thoughts.validateReaderThoughts([row]), [{ ...first, sourceUrl: expected }]);
  }
});
test("an unavailable, forged or unsafe source is dropped without losing the person's thought", () => {
  for (const sourceUrl of [
    null,
    4,
    "javascript:alert(1)",
    "data:text/html,test",
    "//www.zhihu.com/question/12",
    "https://www.zhihu.com",
    "https://evil.test/question/12",
    "https://www.zhihu.com.evil.test/question/12",
    "https://www.zhihu.com@evil.test/question/12",
    "https://user@www.zhihu.com/question/12",
    "https://www.zhihu.com:1234/question/12",
    "https://link.zhihu.com/?target=outside",
    "https://www.zhihu.com/redirect?target=outside",
    "https://www.zhihu.com/search?q=12",
    "https:\\www.zhihu.com\\question\\12",
    "/?sample=not-in-the-book",
    `${sample}&next=outside`,
    "/trial",
    "/api/roundtable/chat",
  ]) {
    const row = { ...first, sourceUrl };
    assert.deepEqual(thoughts.validateReaderThoughts([row]), [first], String(sourceUrl));
    assert.deepEqual(thoughts.saveReaderThought([], row), [first], String(sourceUrl));
  }
});

test("when the original chat is deleted or evicted, explicit reading context is that source alone or []", () => {
  const note = { ...first, sourceUrl: answer };
  const original = { id: "shared-id", title: "同名文章", url: answer };
  const other = { ...original, url: "https://www.zhihu.com/question/12/answer/35" };
  assert.deepEqual(thoughts.readingContextForThought(note, [other]), []);
  assert.deepEqual(thoughts.readingContextForThought(first, [original, other]), []);
  assert.deepEqual(
    thoughts.readingContextForThought({ ...first, sourceUrl: "invalid" }, [{ url: "invalid" }]),
    [],
  );
  assert.deepEqual(
    thoughts.readingContextForThought(note, [{ ...original, url: `${answer}?tracking=1` }, other]),
    [original],
  );
  assert.deepEqual(
    thoughts.readingContextForThought({ ...first, sourceUrl: sample }, [{ url: sample }, other]),
    [{ url: sample }],
  );
  assert.deepEqual(thoughts.validateReaderThoughts([note]), [note]); // No room required to reopen the line itself.
});

test("offering one's own last words excludes pets and menu choices and never rewrites a long reply", () => {
  const pet = { speaker: "purr_cat", kind: "reply", text: "我替你写的总结" };
  const choice = { speaker: "user", kind: "choice", text: "菜单默认台词" };
  const spoken = { speaker: "user", kind: "typed", text: "我还没想好，先放一放。" };
  assert.equal(thoughts.lastReaderWords([pet, choice, { ...pet, kind: "typed" }]), null);
  assert.equal(thoughts.lastReaderWords([spoken, choice, pet]), spoken.text);
  assert.equal(thoughts.lastReaderWords([spoken, { ...spoken, text: "长".repeat(81) }]), null);
  assert.equal(thoughts.lastReaderWords([{ ...spoken, text: "第一段\n第二段" }]), null);
});

// Node strips TypeScript but not JSX. Transform this client component in memory, without starting Next.
async function loadShelf() {
  const hook = registerHooks({
    load(url, context, next) {
      if (url.endsWith("/ThoughtShelf.tsx")) {
        const { code } = transformSync(readFileSync(new URL(url), "utf8"), {
          loader: "tsx",
          jsx: "automatic",
        });
        return { format: "module", shortCircuit: true, source: code };
      }
      if (url.endsWith("/ThoughtShelf.module.css"))
        return { format: "module", shortCircuit: true, source: "export default {}" };
      return next(url, context);
    },
  });
  try {
    return (await import("../src/components/companion/ThoughtShelf.tsx")).ThoughtShelf;
  } finally {
    hook.deregister();
  }
}

test("the cabin is opt-in; the closed shelf renders just the saved thought, with no source, chat or delete action yet", async () => {
  const Shelf = await loadShelf();
  const unexpected = () => assert.fail("rendering is never consent");
  const saved = [{ ...first, sourceUrl: answer, excerpt: "绝不展示整段引用", draft: "未保存草稿" }];
  const room = { key: "room-1", turns: [{ speaker: "user", kind: "typed", text: "上一次的私聊" }] };
  const cabin = renderToStaticMarkup(
    createElement(Shelf, { mode: "cabin", room, thoughts: saved, onSave: unexpected }),
  );
  assert.match(cabin, /上次想到这儿/);
  assert.doesNotMatch(
    cabin,
    /<input|上一次的私聊|想再弄清楚末班车时间|绝不展示整段引用|未保存草稿/,
  );
  const shelf = renderToStaticMarkup(
    createElement(Shelf, {
      mode: "shelf",
      thoughts: saved,
      onRemove: unexpected,
      onDiscuss: unexpected,
    }),
  );
  assert.match(shelf, /想再弄清楚末班车时间/);
  assert.match(shelf, /aria-expanded="false"/);
  assert.doesNotMatch(shelf, /<input|href=|继续聊|删除这个念头|绝不展示整段引用|未保存草稿/);
});

// Optional offline interaction test, using the same Python Playwright as the project browser checks:
// node scripts/reader-thoughts.test.mjs --browser=msedge
const channel = process.argv
  .find((arg) => arg.startsWith("--browser="))
  ?.slice("--browser=".length);
if (channel)
  test("editing is a boolean lease until close; preview, source, discuss and delete stay separate", () => {
    const root = fileURLToPath(new URL("../", import.meta.url));
    const { outputFiles } = buildSync({
      absWorkingDir: root,
      bundle: true,
      write: false,
      outdir: "unused-in-memory",
      jsx: "automatic",
      define: { "process.env.NODE_ENV": '"development"' },
      stdin: {
        resolveDir: root,
        loader: "jsx",
        contents: `
      import { StrictMode } from "react";
      import { createRoot } from "react-dom/client";
      import { ThoughtShelf } from "./src/components/companion/ThoughtShelf";
      const root = createRoot(document.querySelector("main"));
      const log = window.log = { flags: [], saved: [], discussed: [], removed: [] };
      let list = [], mode = "cabin", key = "first";
      window.draw = (m = mode, k = key) => {
        mode = m; key = k;
        root.render(<StrictMode><ThoughtShelf mode={mode} thoughts={list}
          room={{key, turns: [{speaker:"user", kind:"typed", text:"想问第二遍"}]}}
          source={{title:"试读册", url:"/?sample=two-bookmarks"}}
          onEditingChange={(...args) => log.flags.push(args)}
          onSave={t => { if (window.refuse) return false; log.saved.push(t); list = [t, ...list]; window.draw(); return true; }}
          onDiscuss={t => log.discussed.push(t)}
          onRemove={id => { log.removed.push(id); list = list.filter(t => t.id !== id); window.draw(); }}
        /></StrictMode>);
      };
      window.draw();`,
      },
    });
    const run = spawnSync(
      "python",
      [
        "-X",
        "utf8",
        "-c",
        `
import json, sys
from playwright.sync_api import sync_playwright, expect
files = json.load(sys.stdin)
with sync_playwright() as pw, pw.chromium.launch(channel=sys.argv[1]) as browser:
    p = browser.new_page(viewport={"width": 360, "height": 700}); requests = []; errors = []
    p.route("**/*", lambda r: r.abort()); p.on("request", lambda r: requests.append(r.url)); p.on("pageerror", lambda e: errors.append(str(e)))
    p.set_content('<main style="width:260px" lang="zh-CN"></main>')
    for f in files:
        if f['css']: p.add_style_tag(content=f['text'])
        else: p.add_script_tag(content=f['text'])
    button = lambda name: p.get_by_role('button', name=name, exact=True)
    flags = lambda: p.evaluate('log.flags')
    field = p.get_by_role('textbox', name='念头或短标题')
    button('记个念头').click(); expect(field).to_be_focused(); assert flags() == [[True]], flags()
    button('用上一句自己的话').click(); expect(field).to_have_value('想问第二遍'); expect(field).to_be_focused()
    field.press('Tab'); p.evaluate('window.draw()'); button('保存念头').focus(); assert flags() == [[True]]
    p.evaluate('window.refuse = true'); button('保存念头').click(); expect(field).to_be_visible(); assert flags() == [[True]]
    button('取消，不保存').click(); expect(field).to_have_count(0); assert flags() == [[True], [False]]
    button('记个念头').click(); field.fill('不会带到另一间'); p.evaluate("draw('cabin', 'second')")
    expect(field).to_have_count(0); assert flags() == [[True], [False]] * 2
    button('记个念头').click(); expect(field).to_have_value(''); field.fill('不保存的草稿'); p.evaluate("draw('shelf')")
    expect(field).to_have_count(0); assert flags() == [[True], [False]] * 3 and not p.evaluate('log.saved')
    p.evaluate("draw('cabin')"); button('记个念头').click(); field.fill('🌱' * 81); expect(button('保存念头')).to_be_disabled()
    field.fill('🌱' * 80); expect(p.get_by_role('checkbox')).not_to_be_checked(); p.get_by_role('checkbox').check()
    p.evaluate('window.refuse = false'); button('保存念头').click(); expect(field).to_have_count(0); assert flags() == [[True], [False]] * 4
    p.evaluate("draw('shelf')"); row = button('🌱' * 80); expect(row).to_have_attribute('aria-expanded','false'); expect(p.get_by_role('link')).to_have_count(0)
    assert row.evaluate('e => e.firstElementChild.scrollWidth > e.firstElementChild.clientWidth'); row.press('Enter')
    expect(row).to_have_attribute('aria-expanded','true'); assert row.evaluate('e => e.firstElementChild.scrollWidth === e.firstElementChild.clientWidth')
    expect(p.get_by_role('link',name='回看本地试读（新窗口）')).to_have_attribute('href','/?sample=two-bookmarks')
    assert not p.evaluate('log.discussed'); button('继续聊这个念头').click(); assert p.evaluate('log.discussed') == p.evaluate('log.saved')
    button('删除这个念头').click(); button('取消删除').click(); expect(button('删除这个念头')).to_be_focused(); assert not p.evaluate('log.removed')
    button('删除这个念头').click(); button('确认删除').click(); expect(row).to_have_count(0); expect(p.get_by_role('heading',name='上次想到这儿')).to_be_focused()
    assert p.evaluate('log.removed') == [p.evaluate('log.saved[0].id')] and not requests and not errors, (requests, errors)
`,
        channel,
      ],
      {
        input: JSON.stringify(
          outputFiles.map((f) => ({ css: f.path.endsWith(".css"), text: f.text })),
        ),
        encoding: "utf8",
        windowsHide: true,
        timeout: 60_000,
      },
    );
    assert.ifError(run.error);
    assert.equal(run.status, 0, run.stderr || run.stdout);
  });
