import type { Turn } from "./companion";
import { sampleItems } from "./reading-samples.ts";

/** A reader's own saved line, not a copy of the room, a passage or a decision card. */
export type ReaderThought = { id: string; text: string; createdAt: number; sourceUrl?: string };
export const MAX_THOUGHT_LENGTH = 80;
export const MAX_THOUGHTS = 30;

/** Count Unicode code points; never truncate a reader's words to make them fit. */
export function thoughtText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (
    text.length > 2 * MAX_THOUGHT_LENGTH ||
    [...text].length > MAX_THOUGHT_LENGTH ||
    /[\x00-\x1f\x7f-\x9f\u2028\u2029]/u.test(text) ||
    !/[^\s\p{Cf}]/u.test(text)
  )
    return null;
  return text;
}

const sampleUrls = new Set(sampleItems.map((item) => item.url));

/** Reading destinations only: no redirectors, search, tracking query or chat URL. */
export function thoughtSourceUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return;
  if (sampleUrls.has(value)) return value;
  if (!/^https?:\/\//i.test(value) || /[\s\\\x00-\x1f\x7f]/u.test(value)) return;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.port) return;
    const path = url.pathname.replace(/\/$/, "");
    if (url.hostname === "zhuanlan.zhihu.com" && /^\/p\/[1-9]\d*$/.test(path))
      return `https://zhuanlan.zhihu.com${path}`;
    if (
      (url.hostname === "www.zhihu.com" || url.hostname === "zhihu.com") &&
      /^\/(?:question\/[1-9]\d*(?:\/answer\/[1-9]\d*)?|(?:answer|pin)\/[1-9]\d*)$/.test(path)
    )
      return `https://www.zhihu.com${path}`;
  } catch {
    // An unusable link is optional; it must not cost the reader their note.
  }
}

export function validateReaderThought(raw: unknown): ReaderThought | null {
  if (!raw || typeof raw !== "object") return null;
  const { id, text, createdAt, sourceUrl } = raw as Partial<ReaderThought>;
  const line = thoughtText(text);
  if (
    typeof id !== "string" ||
    !/^[\w-]{1,80}$/.test(id) ||
    !line ||
    typeof createdAt !== "number" ||
    !Number.isSafeInteger(createdAt) ||
    createdAt < 0
  )
    return null;
  const url = thoughtSourceUrl(sourceUrl);
  return { id, text: line, createdAt, ...(url ? { sourceUrl: url } : {}) };
}

export function validateReaderThoughts(raw: unknown): ReaderThought[] {
  const list: ReaderThought[] = [];
  if (!Array.isArray(raw)) return list;
  for (const value of raw) {
    const thought = validateReaderThought(value);
    if (thought && !list.some((t) => t.id === thought.id)) list.push(thought);
    if (list.length === MAX_THOUGHTS) break;
  }
  return list;
}

export function saveReaderThought(
  existing: readonly ReaderThought[] | undefined,
  candidate: ReaderThought,
): ReaderThought[] {
  const list = validateReaderThoughts(existing);
  const thought = validateReaderThought(candidate);
  if (!thought || list.length >= MAX_THOUGHTS || list.some((t) => t.id === thought.id)) return list;
  return [thought, ...list];
}

export function removeReaderThought(
  existing: readonly ReaderThought[] | undefined,
  id: string,
): ReaderThought[] {
  return validateReaderThoughts(existing).filter((t) => t.id !== id);
}

/** Only on an explicit request for the attached article. [] is intentional: never fall back to recent reading. */
export function readingContextForThought<T extends { url: string }>(
  thought: ReaderThought,
  available: readonly T[],
): T[] {
  const url = thoughtSourceUrl(thought.sourceUrl);
  if (!url) return [];
  const exact = available.find((item) => thoughtSourceUrl(item.url) === url);
  return exact ? [{ ...exact, url }] : [];
}

/** Called when the reader asks to use their words; never substitute an older line that happens to fit. */
export function lastReaderWords(
  turns: readonly Pick<Turn, "speaker" | "kind" | "text">[],
): string | null {
  return thoughtText(
    turns.findLast((turn) => turn?.speaker === "user" && turn.kind === "typed")?.text,
  );
}
