"use client";
import type { JournalEntry, ReadingTrailItem, ZhihuItem } from "@/types";
import { isBookmark } from "./bookmarks.ts";
import type { Book, Room } from "./companion.ts";
import { normalizeMemories } from "./shared-memory.ts";
import { validateReaderThoughts } from "./reader-thoughts.ts";
import {
  clearSession,
  freshSession,
  isOpaqueId,
  isPersonalRoomKey,
  loadSession,
  opaqueId,
  recordGrant,
  saveSession,
  scopedRoomKey,
  sessionInMemory,
  type ReadingSession,
} from "./session-reading.ts";
export { isPersonalRoomKey } from "./session-reading.ts";

const LEGACY = "fr.readingTrail",
  HISTORY = "fr.readingHistory.v1",
  BOOK = "fr.companion.v1",
  JOURNAL = "fr.journalCats",
  EPOCH = "fr.readingEpoch.v1";
export const STORE_EVENT = "fluffy-library-change";
export const STORAGE_KEYS = [HISTORY, BOOK, JOURNAL, LEGACY, EPOCH];
// Quota/security failures may only shadow this document. A clear in a different tab
// retires its shadow too, even if the page was suspended and missed the storage event.
const documents = new WeakMap<Window, { epoch?: string | null; values: Map<string, string> }>();
function shadow() {
  let state = documents.get(window);
  if (!state) {
    state = { values: new Map() };
    documents.set(window, state);
  }
  try {
    const epoch = window.localStorage.getItem(EPOCH);
    if (state.epoch !== epoch) state.values.clear();
    state.epoch = epoch;
  } catch {
    /* Without access, only this document's own writes are available. */
  }
  return state;
}
function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = shadow().values.get(key) ?? window.localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown, revoke = false) {
  if (typeof window === "undefined") return;
  const state = shadow(),
    raw = JSON.stringify(value);
  try {
    window.localStorage.setItem(key, raw);
    if (key === EPOCH) state.epoch = raw;
    state.values.delete(key);
  } catch {
    // A full store often permits deletion. Never leave yesterday's data accessible to
    // another tab just because writing the (much smaller) reset value failed.
    if (revoke) {
      try {
        window.localStorage.removeItem(key);
        if (key === EPOCH) state.epoch = null;
        window.localStorage.setItem(key, raw);
        if (key === EPOCH) state.epoch = raw;
        state.values.delete(key);
        return;
      } catch {
        /* fully blocked: retain only the document-local reset */
      }
    }
    state.values.set(key, raw);
  }
}
export function memoryOnly() {
  return typeof window !== "undefined" && (shadow().values.size > 0 || sessionInMemory());
}
function notify() {
  if (typeof window !== "undefined") window.dispatchEvent?.(new Event(STORE_EVENT));
}
function validTrail(v: unknown): v is ReadingTrailItem {
  const t = v as ReadingTrailItem;
  return (
    !!t &&
    typeof t.url === "string" &&
    (/^https?:\/\//i.test(t.url) ||
      (t.origin === "sample" && /^\/\?sample=[a-z0-9-]+$/.test(t.url))) &&
    typeof t.title === "string" &&
    typeof t.contentText === "string" &&
    Array.isArray(t.comments) &&
    Number.isFinite(t.readAt)
  );
}
// The library holds the article once. A read grant names the actual version seen,
// not its URL, history position, a timestamp shared by two tabs, or its visit count.
type SavedRow = ReadingTrailItem & { readRef?: string };
function historyRows(allowLegacy = true): SavedRow[] {
  const saved = read<unknown>(HISTORY, null) ?? (allowLegacy ? read<unknown>(LEGACY, []) : []);
  return Array.isArray(saved) ? saved.filter(validTrail).slice(-100) : [];
}
function publicRow({ readRef: _ref, ...row }: SavedRow): ReadingTrailItem {
  return row;
}
export const getHistory = () => historyRows().map(publicRow);
function epoch() {
  const value = read<unknown>(EPOCH, null);
  return isOpaqueId(value) ? value : null;
}
function currentSession() {
  return loadSession(epoch());
}
function ensureSession(): ReadingSession {
  const current = epoch(),
    active = loadSession(current);
  if (active) return active;
  const session = freshSession(current ?? opaqueId());
  if (!current) write(EPOCH, session.epoch);
  saveSession(session);
  return session;
}
/** For new personal, article and passage rooms. Only an explicit chat resume uses its stored key. */
export const sessionRoomKey = (materialKey?: string) =>
  scopedRoomKey(ensureSession().scope, materialKey);
// Explicit projection: extra shelf fields (including lifetime visits) aren't table material.
type Material = Omit<ReadingTrailItem, "readAt" | "visits">;
function material({
  origin,
  id,
  url,
  title,
  author,
  authoritylevel,
  voteUpCount,
  comments,
  contentText,
  fromQuestion,
}: Material): Material {
  return {
    origin,
    id,
    url,
    title,
    author,
    authoritylevel,
    voteUpCount,
    comments,
    contentText,
    fromQuestion,
  };
}
function resolveTrail(session: ReadingSession, rows: SavedRow[]) {
  const origin = session.grants.at(-1)?.sample;
  return session.grants
    .filter((g) => g.sample === origin)
    .slice(-5)
    .flatMap((g) => {
      const matches = rows.filter(
        (r) => r.readRef === g.ref && (r.origin === "sample") === g.sample,
      );
      return matches.length === 1
        ? [{ ...material(matches[0]), readAt: g.readAt, visits: g.visits }]
        : [];
    });
}
export function getTrail(): ReadingTrailItem[] {
  const session = currentSession();
  return session?.grants.length ? resolveTrail(session, historyRows(false)) : [];
}
export function pushTrail(item: ZhihuItem, fromQuestion?: string): ReadingTrailItem[] {
  if (
    typeof window === "undefined" ||
    typeof item?.contentText !== "string" ||
    !Array.isArray(item.comments) ||
    !item.comments.every((s) => typeof s === "string")
  )
    return getTrail();
  const row: ReadingTrailItem = {
    origin: item.origin,
    id: item.id,
    url: item.url,
    title: item.title,
    author: item.author,
    authoritylevel: item.authoritylevel,
    voteUpCount: item.voteUpCount,
    comments: item.comments.slice(0, 4).map((s) => s.slice(0, 300)),
    contentText: item.contentText.slice(0, 1500),
    fromQuestion,
    readAt: Date.now(),
  };
  if (!validTrail(row)) return getTrail();
  const session = ensureSession(),
    history = historyRows(),
    old = history.find((t) => t.url === row.url);
  const ref =
    old &&
    isOpaqueId(old.readRef) &&
    JSON.stringify(material(old)) === JSON.stringify(material(row))
      ? old.readRef
      : opaqueId();
  const stored = { ...row, visits: (old ? (old.visits ?? 1) : 0) + 1, readRef: ref };
  const next = [...history.filter((t) => t.url !== row.url), stored].slice(-100);
  const active = recordGrant(
    session,
    {
      ref,
      sample: row.origin === "sample",
      readAt: row.readAt,
      visits: (session.grants.find((g) => g.ref === old?.readRef)?.visits ?? 0) + 1,
    },
    old?.readRef,
  );
  write(HISTORY, next);
  write(
    LEGACY,
    next
      .filter((t) => !t.origin)
      .slice(-5)
      .map(publicRow),
  );
  saveSession(active);
  notify();
  return resolveTrail(active, next);
}
export function clearTrail() {
  write(EPOCH, opaqueId(), true); // revoke other tabs' grants, room keys and seats even after repopulation
  clearSession();
  write(HISTORY, [], true);
  write(LEGACY, [], true);
  notify();
}
const defaultBook = (): Book => ({
  version: 1,
  enabled: true,
  lastNudgeAt: 0,
  pending: null,
  threads: [],
});
// A delayed fold can hand back a React snapshot from before another tab cleared the
// library. Only a room issued by this document in the same generation may set a seat.
const issued = new WeakMap<Room, { document: Window; epoch: string | null; lastRead?: string }>();
function issue(book: Book): Book {
  if (typeof window !== "undefined" && book.threads.length) {
    const witness = {
      document: window,
      epoch: epoch(),
      lastRead: currentSession()?.grants.at(-1)?.ref,
    };
    for (const room of book.threads) issued.set(room, witness);
  }
  return book;
}
export function getBook(): Book {
  const b = read<Book | null>(BOOK, null);
  if (b?.version !== 1 || !Array.isArray(b.threads)) return defaultBook();
  const threads = b.threads
    .filter(
      (t): t is Room =>
        !!t &&
        typeof t.key === "string" &&
        Array.isArray(t.context) &&
        (t.context.length > 0 || isPersonalRoomKey(t.key)) &&
        t.context.every(validTrail) &&
        Array.isArray(t.turns) &&
        Number.isInteger(t.cursor),
    )
    .map((t) => (t.bookmark && !isBookmark(t.bookmark) ? { ...t, bookmark: undefined } : t));
  const memories = normalizeMemories(b.memories),
    p = b.pending;
  const room = p && threads.find((t) => t.key === p.key);
  return issue({
    ...defaultBook(),
    ...b,
    ...(b.memories !== undefined ? { memories } : {}),
    ...("thoughts" in b ? { thoughts: validateReaderThoughts(b.thoughts) } : {}),
    threads,
    pending:
      room &&
      p &&
      typeof p.id === "string" &&
      (memories.some((m) => m.id === p.memoryId) || room.turns.some((m) => m?.id === p.id))
        ? p
        : null,
  });
}
export function updateBook(edit: (b: Book) => Book): Book {
  const old = getBook(),
    next = edit(old);
  if (next !== old) {
    write(BOOK, next);
    issue(next);
    notify();
  }
  return next;
}
// Unlike a turn ID, this handle also works for an unspoken clip, survives turn
// pruning, and never writes a passage-bearing bookmark key to sessionStorage.
type SavedRoom = Room & { seatRef?: string };
export function rememberSeat(room?: Room) {
  if (room) {
    const witness = issued.get(room);
    if (
      !witness ||
      witness.document !== window ||
      witness.epoch !== epoch() ||
      witness.lastRead !== currentSession()?.grants.at(-1)?.ref
    )
      return;
  }
  const session = room ? ensureSession() : currentSession();
  if (!session) return;
  let seat: string | undefined;
  if (room)
    updateBook((b) => {
      const saved: SavedRoom | undefined = b.threads.find((t) => t.key === room.key);
      if (!saved) return b;
      seat = isOpaqueId(saved.seatRef) ? saved.seatRef : opaqueId();
      return saved.seatRef === seat
        ? b
        : { ...b, threads: b.threads.map((t) => (t === saved ? { ...t, seatRef: seat } : t)) };
    });
  saveSession({ ...session, seat });
}
export function seatedRoom(): string | undefined {
  const s = currentSession();
  if (!s?.seat) return;
  const last = s.grants.at(-1);
  if (last && historyRows(false).filter((r) => r.readRef === last.ref).length !== 1) return;
  const matches = getBook().threads.filter((r: SavedRoom) => r.seatRef === s.seat);
  return matches.length === 1 ? matches[0].key : undefined;
}
export function clearCompanion() {
  const b = getBook();
  // In-flight model replies in other tabs compare this value, including legacy `undefined`.
  const previous = Number.isSafeInteger(b.memoryEpoch) ? (b.memoryEpoch ?? 0) : 0;
  write(
    BOOK,
    { ...defaultBook(), enabled: b.enabled, memoryEpoch: Math.max(Date.now(), previous + 1) },
    true,
  );
  clearTrail();
}
export function getJournal(): JournalEntry[] {
  const v = read<JournalEntry[]>(JOURNAL, []);
  return Array.isArray(v)
    ? v.map((e) => (e.bookmark && !isBookmark(e.bookmark) ? { ...e, bookmark: undefined } : e))
    : [];
}
export function addJournal(
  entry: Omit<JournalEntry, "id" | "createdAt">,
  id = crypto.randomUUID() as string,
): JournalEntry[] {
  const list = getJournal();
  if (list.some((e) => e.id === id)) return list;
  const next = [{ ...entry, id, createdAt: Date.now() }, ...list].slice(0, 50);
  write(JOURNAL, next);
  notify();
  return next;
}
