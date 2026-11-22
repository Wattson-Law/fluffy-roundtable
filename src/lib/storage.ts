"use client";
import type { JournalEntry, ReadingTrailItem, ZhihuItem } from "@/types";
import { isBookmark } from "./bookmarks.ts";
import type { Book, Room } from "./companion";

const LEGACY = "fr.readingTrail",
  HISTORY = "fr.readingHistory.v1",
  BOOK = "fr.companion.v1",
  JOURNAL = "fr.journalCats";
export const STORE_EVENT = "fluffy-library-change";
export const STORAGE_KEYS = [HISTORY, BOOK, JOURNAL, LEGACY];
const transient = new Map<string, string>();
function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  let raw = transient.get(key);
  if (raw === undefined) {
    try {
      raw = window.localStorage.getItem(key) ?? undefined;
    } catch {
      /* memory-only */
    }
  }
  if (raw === undefined) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(value);
  try {
    window.localStorage.setItem(key, raw);
    transient.delete(key);
  } catch {
    transient.set(key, raw);
  }
}
export function memoryOnly() {
  return transient.size > 0;
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
export function getHistory(): ReadingTrailItem[] {
  // Existing installs keep their five entries until their first new read; an explicit [] is never re-imported.
  const saved = read<unknown>(HISTORY, null) ?? read<unknown>(LEGACY, []);
  return Array.isArray(saved) ? saved.filter(validTrail).slice(-100) : [];
}
export const getTrail = () => {
  const h = getHistory();
  return h.filter((t) => t.origin === h.at(-1)?.origin).slice(-5);
};
export function pushTrail(item: ZhihuItem, fromQuestion?: string): ReadingTrailItem[] {
  const history = getHistory(),
    old = history.find((t) => t.url === item.url);
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
    visits: old ? (old.visits ?? 1) + 1 : 1,
  };
  if (!validTrail(row)) return history.slice(-5);
  const next = [...history.filter((t) => t.url !== row.url), row].slice(-100);
  write(HISTORY, next);
  write(LEGACY, next.filter((t) => !t.origin).slice(-5));
  notify();
  return next.filter((t) => t.origin === row.origin).slice(-5);
}
export function clearTrail() {
  write(HISTORY, []);
  write(LEGACY, []);
  notify();
}
const defaultBook = (): Book => ({
  version: 1,
  enabled: true,
  lastNudgeAt: 0,
  pending: null,
  threads: [],
});
export function getBook(): Book {
  const b = read<Book | null>(BOOK, null);
  if (b?.version !== 1 || !Array.isArray(b.threads)) return defaultBook();
  const threads = b.threads.filter(
    (t): t is Room =>
      !!t &&
      typeof t.key === "string" &&
      Array.isArray(t.context) &&
      t.context.length > 0 &&
      t.context.every(validTrail) &&
      Array.isArray(t.turns) &&
      Number.isInteger(t.cursor),
  ).map(t => t.bookmark && !isBookmark(t.bookmark) ? { ...t, bookmark: undefined } : t);
  return {
    ...defaultBook(),
    ...b,
    threads,
    pending:
      b.pending &&
      threads.some((t) => t.key === b.pending?.key && t.turns.some((m) => m.id === b.pending?.id))
        ? b.pending
        : null,
  };
}
export function updateBook(edit: (b: Book) => Book): Book {
  const old = getBook(),
    next = edit(old);
  if (next !== old) {
    write(BOOK, next);
    notify();
  }
  return next;
}
export function clearCompanion() {
  const b = getBook();
  write(BOOK, { ...defaultBook(), enabled: b.enabled });
  clearTrail();
}
export function getJournal(): JournalEntry[] {
  const v = read<JournalEntry[]>(JOURNAL, []);
  return Array.isArray(v) ? v.map(e => e.bookmark && !isBookmark(e.bookmark) ? { ...e, bookmark: undefined } : e) : [];
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
