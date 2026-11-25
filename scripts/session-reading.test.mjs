import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import * as store from "../src/lib/storage.ts";
import { emptyBook, PERSONAL_ROOM, startThread } from "../src/lib/companion.ts";

// Separate top-level documents with one shared library; no real browser profile or timeouts.
function area(entries = []) {
  const data = new Map(entries);
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}
function tab(localStorage, sessionStorage = area(), type = "navigate") {
  return Object.assign(new EventTarget(), {
    localStorage,
    sessionStorage,
    document: { visibilityState: "visible" },
    performance: { getEntriesByType: () => [{ type }] },
  });
}
const use = (page) => {
  globalThis.window = page;
};
afterEach(() => {
  delete globalThis.window;
});
const item = (id, body = `正文-${id}`) => ({
  id,
  title: `篇名-${id}`,
  url: `https://www.zhihu.com/question/1/answer/${id}`,
  author: "读者",
  contentText: body,
  comments: [`评论-${id}`],
  authoritylevel: 0,
  voteUpCount: 2,
  commentCount: 1,
});
const ids = (rows) => rows.map((r) => r.id);
const archived = { ...item("archive"), readAt: 1, visits: 24 };
const oldRoom = (key, context) => ({
  key,
  context,
  turns: [{ id: "old-turn", text: "昨天的私聊", at: 1, speaker: "user", kind: "typed" }],
  cursor: 0,
  touched: 1,
  title: "旧聊天",
});

test("a legacy shelf and old chats stay explicitly accessible but do not seed today's reading or default room", () => {
  const local = area([["fr.readingTrail", JSON.stringify([archived])]]);
  use(tab(local));
  store.updateBook(() => ({
    ...emptyBook(),
    threads: [oldRoom(PERSONAL_ROOM, []), oldRoom(archived.url, [archived])],
  }));
  assert.deepEqual(store.getHistory(), [archived]);
  assert.deepEqual(store.getTrail(), []);
  assert.deepEqual(store.pushTrail({ ...item("bad"), url: "about:blank" }), []);
  assert.equal(store.seatedRoom(), undefined);
  const personal = store.sessionRoomKey();
  assert.notEqual(personal, PERSONAL_ROOM);
  assert.ok(store.isPersonalRoomKey(personal) && store.isPersonalRoomKey(PERSONAL_ROOM));
  assert.equal(
    store.getBook().threads.find((r) => r.key === personal),
    undefined,
  );
  assert.ok(!store.isPersonalRoomKey(store.sessionRoomKey(archived.url)));
  assert.deepEqual(
    store.getBook().threads.map((t) => t.key),
    [PERSONAL_ROOM, archived.url],
  );
  assert.deepEqual(ids(store.pushTrail(item("archive", "本页确实读到的新版本"))), ["archive"]);
  assert.equal(store.getTrail()[0].contentText, "本页确实读到的新版本");
  assert.notEqual(
    store.getTrail()[0].visits,
    25,
    "the pets do not inherit lifetime reading counts",
  );
  assert.equal(store.getHistory()[0].visits, 25);
  assert.notEqual(store.sessionRoomKey(archived.url), archived.url);
});

test("two tabs share a shelf, not a reading window; hiding, folding and refreshing keep the same tab's reading", () => {
  const local = area(),
    a = tab(local),
    b = tab(local);
  use(a);
  store.pushTrail(item("a"));
  const key = store.sessionRoomKey(item("a").url);
  const room = store.updateBook((book) => startThread(book, key, store.getTrail(), 100)).threads[0];
  store.rememberSeat(room); // Only previewed, no turns yet; also covers selected passages before chat.
  a.document.visibilityState = "hidden";
  a.dispatchEvent(new Event("visibilitychange"));
  use(b);
  assert.deepEqual(ids(store.getHistory()), ["a"]);
  assert.deepEqual(store.getTrail(), []);
  assert.equal(store.seatedRoom(), undefined);
  assert.notEqual(store.sessionRoomKey(item("a").url), key);
  store.pushTrail(item("b"));
  use(a);
  a.document.visibilityState = "visible";
  a.dispatchEvent(new Event("visibilitychange"));
  assert.deepEqual(ids(store.getTrail()), ["a"]);
  assert.equal(store.seatedRoom(), key, "another tab reading is not a new read on this one");
  use(tab(local, a.sessionStorage, "reload"));
  assert.equal(store.seatedRoom(), key);
  assert.equal(store.sessionRoomKey(item("a").url), key);
  assert.deepEqual(ids(store.getTrail()), ["a"]);
  assert.doesNotMatch(
    [...a.sessionStorage.data.values()].join(""),
    /zhihu|篇名|正文|评论|昨天的私聊/,
  );
  store.pushTrail(item("c"));
  assert.equal(
    store.seatedRoom(),
    undefined,
    "a genuine new read, even in the same millisecond, supersedes the seat",
  );
  use(b);
  assert.deepEqual(ids(store.getTrail()), ["b"]);
  use(tab(local)); // old tab closed; a fresh visit must not inherit even a session-scoped room
  assert.deepEqual(store.getTrail(), []);
  assert.equal(store.seatedRoom(), undefined);
  assert.deepEqual(ids(store.getHistory()), ["a", "b", "c"]);
  assert.ok(store.getBook().threads.some((r) => r.key === key));
});

test("an opener's copied sessionStorage is not a read or a room selection in the new tab", () => {
  const local = area(),
    opener = tab(local);
  use(opener);
  store.pushTrail(item("opener"));
  const first = store.sessionRoomKey();
  const opened = tab(local, area(opener.sessionStorage.data));
  opened.opener = opener;
  use(opened);
  assert.deepEqual(store.getTrail(), []);
  assert.notEqual(store.sessionRoomKey(), first);
  use(opener);
  assert.deepEqual(ids(store.getTrail()), ["opener"]);
});

test("cross-tab clear revokes even a folded room and a re-read of the same URL before the hidden tab wakes", () => {
  for (const reset of [
    () => store.clearTrail(),
    () => store.clearCompanion(),
    (local) => local.data.clear(),
  ]) {
    const local = area(),
      a = tab(local),
      b = tab(local);
    use(a);
    store.pushTrail(item("same", "清空前的内容"));
    const key = store.sessionRoomKey(item("same").url);
    const r = store.updateBook((book) => startThread(book, key, store.getTrail(), 33)).threads[0];
    store.rememberSeat(r);
    use(b);
    reset(local);
    store.pushTrail(item("same", "只有另一个标签读过的新内容"));
    use(a); // No storage event delivered yet (background tab).
    assert.deepEqual(store.getTrail(), []);
    assert.equal(store.seatedRoom(), undefined);
    assert.notEqual(store.sessionRoomKey(item("same").url), key);
    assert.equal(store.getHistory()[0].contentText, "只有另一个标签读过的新内容");
    use(tab(local, a.sessionStorage, "reload"));
    assert.deepEqual(store.getTrail(), []);
  }
});

test("rereading a URL in another tab cannot substitute unpublished material, questions or comments on this table", () => {
  const local = area(),
    a = tab(local),
    b = tab(local);
  use(a);
  store.pushTrail(item("same"), "A 的问题");
  use(b);
  store.pushTrail({ ...item("same", "仅在 B 打开"), comments: ["B 的评论"] }, "B 的问题");
  use(a);
  assert.doesNotMatch(JSON.stringify(store.getTrail()), /仅在 B|B 的/);
  use(tab(local, a.sessionStorage, "reload"));
  assert.doesNotMatch(JSON.stringify(store.getTrail()), /仅在 B|B 的/);
  assert.match(JSON.stringify(store.getHistory()), /仅在 B/);
});

test("denied storage stays document-local; merely reading never writes conversations, thoughts, journal or independent trial data", () => {
  const denied = new Proxy(
    {},
    {
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    },
  );
  for (const [local, session] of [
    [denied, area()],
    [area(), denied],
    [denied, denied],
  ]) {
    const a = tab(local, session),
      b = tab(local);
    use(a);
    assert.doesNotThrow(() => store.pushTrail(item("private")));
    assert.deepEqual(ids(store.getTrail()), ["private"]);
    assert.equal(store.memoryOnly(), true);
    assert.deepEqual(store.getBook().threads, []);
    use(b);
    assert.deepEqual(store.getTrail(), []);
    use(a);
    assert.deepEqual(ids(store.getTrail()), ["private"]);
    store.clearCompanion();
    assert.deepEqual(store.getTrail(), []);
  }
  const other = [
    ["independent.reader", "unrelated"],
    ["fr.journalCats", "[]"],
  ];
  const local = area(other),
    session = area([["independent.tab", "untouched"]]);
  use(tab(local, session));
  store.pushTrail(item("just-read"));
  assert.equal(local.getItem("fr.companion.v1"), null);
  store.clearCompanion();
  for (const [key, value] of other) assert.equal(local.getItem(key), value);
  assert.equal(session.getItem("independent.tab"), "untouched");
  const clean = tab(local, session, "reload");
  use(clean);
  assert.deepEqual(store.getTrail(), []);
});

test("pending memories can point to an existing personal room without its original turn; ordinary vouchers still need that exact room and turn", () => {
  const local = area();
  use(tab(local));
  const memory = {
    id: "work",
    topic: "work",
    label: "在找工作",
    at: 44,
    sourceRoom: "evicted",
    sourceTurn: "lost",
  };
  const personal = { ...oldRoom(PERSONAL_ROOM, []), turns: [] };
  const base = {
    ...emptyBook(),
    threads: [personal, oldRoom(archived.url, [archived])],
    memories: [memory],
    mutedMemoryTopics: ["pet"],
    memoryEpoch: 41,
    thoughts: [],
    futureFlag: true,
  };
  const read = (pending, extra) => {
    local.setItem("fr.companion.v1", JSON.stringify({ ...base, ...extra, pending }));
    return store.getBook();
  };
  const note = { key: PERSONAL_ROOM, id: "lost", memoryId: "work" };
  const restored = read(note);
  assert.deepEqual(restored.pending, note);
  const { sourceRoom: _obsoleteArticleKey, ...minimal } = memory;
  assert.deepEqual(restored.memories, [minimal]);
  assert.deepEqual(restored.mutedMemoryTopics, ["pet"]);
  assert.equal(restored.memoryEpoch, 41);
  assert.deepEqual(restored.thoughts, []);
  assert.equal(restored.futureFlag, true);
  assert.equal(read({ ...note, key: "absent" }).pending, null);
  assert.equal(read(note, { memories: [] }).pending, null);
  assert.equal(read(note, { memories: [{ ...memory, label: "我的病历" }] }).pending, null);
  assert.equal(read({ key: PERSONAL_ROOM, id: "old-turn" }).pending, null);
  const legacy = { key: archived.url, id: "old-turn" };
  assert.deepEqual(read(legacy).pending, legacy);
});

test("a late fold after another tab clears reading cannot re-authorize its archived room", () => {
  const local = area(),
    a = tab(local),
    b = tab(local);
  use(a);
  store.pushTrail(item("fold"));
  const key = store.sessionRoomKey(item("fold").url);
  const stale = store.updateBook((book) => startThread(book, key, store.getTrail(), 101))
    .threads[0];
  store.rememberSeat(stale);
  use(b);
  store.clearTrail(); // the shelf retains the chat but no tab retains this reading grant
  use(a);
  store.rememberSeat(stale);
  assert.equal(store.seatedRoom(), undefined);
  assert.ok(store.getBook().threads.some((t) => t.key === key));
});

test("an unrelated tab never opens library bodies on an automatic trail lookup; a quota-only shadow cannot outlive a shared clear", () => {
  const local = area(),
    a = tab(local),
    other = tab(local);
  use(a);
  store.pushTrail(item("one"));
  const original = local.getItem,
    opened = new Set();
  local.getItem = (k) => {
    opened.add(k);
    return original(k);
  };
  use(other);
  assert.deepEqual(store.getTrail(), []);
  assert.ok(
    !["fr.readingHistory.v1", "fr.readingTrail", "fr.companion.v1", "fr.journalCats"].some((k) =>
      opened.has(k),
    ),
  );
  use(a);
  a.localStorage = {
    ...local,
    setItem() {
      throw new Error("quota exceeded");
    },
  };
  store.pushTrail(item("volatile"));
  assert.deepEqual(ids(store.getTrail()), ["one", "volatile"]);
  use(other);
  store.clearCompanion();
  store.pushTrail(item("other"));
  use(a);
  assert.deepEqual(store.getTrail(), []);
  assert.deepEqual(ids(store.getHistory()), ["other"]);
});

test("thoughts are validated on read without rewriting old saves or altering unrelated book fields", () => {
  const local = area();
  use(tab(local));
  const thought = { id: "mine", text: "想学这门手艺", createdAt: 5 };
  const raw = JSON.stringify({
    ...emptyBook(),
    thoughts: [null, { ...thought, sourceUrl: "javascript:bad", privateExtra: true }, thought],
    independentField: { untouched: true },
  });
  local.setItem("fr.companion.v1", raw);
  assert.deepEqual(store.getBook().thoughts, [thought]);
  assert.deepEqual(store.getBook().independentField, { untouched: true });
  assert.equal(local.getItem("fr.companion.v1"), raw);
});

test("a quota-blocked but readable tab can still revoke saved reading and chats in another tab", () => {
  const shared = area(),
    a = tab(shared),
    b = tab({
      ...shared,
      setItem() {
        throw new Error("quota exceeded");
      },
    });
  use(a);
  store.pushTrail(item("quota"));
  const key = store.sessionRoomKey(item("quota").url);
  store.rememberSeat(
    store.updateBook((book) => startThread(book, key, store.getTrail(), 5)).threads[0],
  );
  use(b);
  store.clearCompanion();
  use(a);
  assert.deepEqual(store.getTrail(), []);
  assert.equal(store.seatedRoom(), undefined);
  assert.deepEqual(store.getHistory(), []);
  assert.deepEqual(store.getBook().threads, []);
});

test("an explicit clear also invalidates a pending reply's memory epoch, even for a legacy book that never had one", () => {
  const local = area();
  const a = tab(local),
    b = tab(local);
  use(a);
  store.updateBook((book) => ({ ...book, enabled: false }));
  const sentEpoch = store.getBook().memoryEpoch;
  use(b);
  store.clearCompanion();
  use(a);
  const cleared = store.getBook();
  assert.notEqual(cleared.memoryEpoch, sentEpoch);
  assert.ok(Number.isSafeInteger(cleared.memoryEpoch));
  assert.equal(cleared.enabled, false);
  const later = cleared.memoryEpoch + 60000;
  store.updateBook((book) => ({ ...book, memoryEpoch: later }));
  store.clearCompanion();
  assert.ok(
    store.getBook().memoryEpoch > later,
    "even a backwards wall clock cannot reinstate a reply",
  );
});

test("two identical published reads keep per-tab visit metadata; a late fold after a new local read cannot replace today's source", () => {
  const local = area(),
    a = tab(local),
    b = tab(local);
  use(a);
  store.pushTrail(item("same-body"));
  const first = store.getTrail();
  const k = store.sessionRoomKey(item("same-body").url);
  const stale = store.updateBook((book) => startThread(book, k, first, 10)).threads[0];
  store.rememberSeat(stale);
  use(b);
  store.pushTrail(item("same-body"));
  use(a);
  assert.deepEqual(store.getTrail(), first);
  assert.equal(store.seatedRoom(), k);
  use(tab(local, a.sessionStorage, "reload"));
  assert.deepEqual(store.getTrail(), first);
  use(a);
  store.pushTrail(item("new-local"));
  store.rememberSeat(stale);
  assert.equal(store.seatedRoom(), undefined);
});

test("the exact selected sentence survives folding without speaking; a new tab may choose that old chat explicitly, never by matching its URL", async () => {
  const { bookmarkKey, clipPassage } = await import("../src/lib/bookmarks.ts");
  const local = area(),
    a = tab(local);
  use(a);
  const source = item("clip", "同一句。同一句。");
  const mark = clipPassage(source, 4, 8);
  const [row] = store.pushTrail(source);
  const key = store.sessionRoomKey(bookmarkKey(mark));
  const room = store.updateBook((book) => startThread(book, key, [row], 9, mark)).threads[0];
  store.rememberSeat(room);
  use(tab(local, a.sessionStorage, "reload"));
  assert.equal(store.seatedRoom(), key);
  assert.deepEqual(
    store.getBook().threads.find((t) => t.key === store.seatedRoom()).bookmark,
    mark,
  );
  assert.doesNotMatch([...a.sessionStorage.data.values()].join(""), /zhihu|同一句/);
  const b = tab(local);
  use(b);
  assert.equal(store.seatedRoom(), undefined);
  assert.notEqual(store.sessionRoomKey(bookmarkKey(mark)), key);
  const chosen = store.getBook().threads.find((t) => t.key === key);
  store.rememberSeat(chosen); // explicit shelf “continue this chat”
  assert.equal(store.seatedRoom(), key);
  assert.deepEqual(store.getTrail(), []); // selecting a chat didn't silently re-read the shelf
  const personal = store.sessionRoomKey();
  const fresh = store.updateBook((book) => startThread(book, personal, [], 10)).threads[0];
  assert.deepEqual(fresh.context, []);
  assert.equal(store.getBook().threads.find((t) => t.key === personal).turns.length, 0);
});
