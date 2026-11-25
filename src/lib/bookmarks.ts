import type { PassageBookmark, ReadingTrailItem, ZhihuItem } from "@/types";

export const MAX_QUOTE = 160;
const MARGIN = 160;
type Source = Pick<ZhihuItem, "id" | "title" | "author" | "url" | "origin" | "contentText">;
export type SentenceChoice = { start: number; end: number; text: string };
// DOM Ranges and String.slice use UTF-16 offsets. Never cut a surrogate pair at either edge.
const splitsPair = (s: string, i: number) =>
  i > 0 && i < s.length && /[\uDC00-\uDFFF]/.test(s[i]) && /[\uD800-\uDBFF]/.test(s[i - 1]);
const validQuote = (s: unknown): s is string =>
  typeof s === "string" &&
  !!s &&
  s === s.trim() &&
  s.length <= 2 * MAX_QUOTE &&
  [...s].length <= MAX_QUOTE;
export function clipPassage(item: Source, from: number, to: number): PassageBookmark | null {
  const body = item.contentText;
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to <= from ||
    to > body.length
  )
    return null;
  const raw = body.slice(from, to),
    excerpt = raw.trim();
  if (!validQuote(excerpt)) return null;
  const start = from + raw.length - raw.trimStart().length,
    end = start + excerpt.length;
  if (splitsPair(body, start) || splitsPair(body, end)) return null;
  let a = Math.max(0, start - MARGIN),
    z = Math.min(body.length, end + MARGIN);
  if (splitsPair(body, a)) a++;
  if (splitsPair(body, z)) z--;
  return {
    sourceId: item.id,
    url: item.url,
    title: item.title,
    author: item.author,
    ...(item.origin ? { origin: item.origin } : {}),
    start,
    excerpt,
    before: body.slice(a, start),
    after: body.slice(end, z),
  };
}
export function isBookmark(x: unknown): x is PassageBookmark {
  const m = x as PassageBookmark | null;
  return (
    !!m &&
    typeof m.sourceId === "string" &&
    typeof m.title === "string" &&
    typeof m.author === "string" &&
    typeof m.url === "string" &&
    (m.origin === "sample"
      ? /^\/\?sample=[a-z0-9-]+$/.test(m.url)
      : m.origin === undefined && /^https?:\/\//i.test(m.url)) &&
    validQuote(m.excerpt) &&
    Number.isSafeInteger(m.start) &&
    m.start >= 0 &&
    typeof m.before === "string" &&
    typeof m.after === "string" &&
    m.before.length <= MARGIN &&
    m.before.length <= m.start &&
    m.after.length <= MARGIN
  );
}
// Article threads keep their legacy URL key; two identical sentences at different offsets are distinct bookmarks.
export const bookmarkKey = (m: PassageBookmark) =>
  JSON.stringify(["passage-v1", m.url, m.start, m.excerpt]);
export function locatePassage(body: string, m: PassageBookmark): number | null {
  const first = body.indexOf(m.excerpt);
  if (first < 0) return null;
  if (body.indexOf(m.excerpt, first + 1) < 0) return first;
  const window = m.before + m.excerpt + m.after;
  const at = m.start - m.before.length;
  if (at >= 0 && body.startsWith(window, at)) return m.start;
  const found = body.indexOf(window);
  return found >= 0 && body.indexOf(window, found + 1) < 0 ? found + m.before.length : null;
}
export function sentenceChoices(body: string): SentenceChoice[] {
  const out: SentenceChoice[] = [];
  for (const match of body.matchAll(/[^。！？；!?;\r\n]+[。！？；!?;]*[”’」』）】]*/gu)) {
    const raw = match[0],
      text = raw.trim();
    let start = match.index! + raw.length - raw.trimStart().length;
    const chars = [...text];
    for (let i = 0; i < chars.length; i += MAX_QUOTE) {
      const chunk = chars.slice(i, i + MAX_QUOTE).join(""),
        value = chunk.trim();
      const from = start + chunk.length - chunk.trimStart().length;
      if (value) out.push({ start: from, end: from + value.length, text: value });
      start += chunk.length;
    }
  }
  return out;
}
export const requestFocus = (m: PassageBookmark) => ({
  id: m.sourceId,
  start: m.before.length,
  excerpt: m.excerpt,
});
// Offset is relative to the sent public window, not the locally recorded article position.
export function verifyFocus(trail: Pick<ReadingTrailItem, "id" | "contentText">[], raw: unknown) {
  const f = raw as ReturnType<typeof requestFocus> | null;
  if (
    !f ||
    trail.length !== 1 ||
    f.id !== trail[0].id ||
    !Number.isSafeInteger(f.start) ||
    f.start < 0 ||
    !validQuote(f.excerpt)
  )
    return null;
  return trail[0].contentText.startsWith(f.excerpt, f.start)
    ? { id: trail[0].id, start: f.start, excerpt: f.excerpt }
    : null;
}
