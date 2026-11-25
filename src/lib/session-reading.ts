// No runtime import from companion: its empty-room guard can use this predicate too.
// Tab storage contains only opaque handles, never article URLs, excerpts, or utterances.
const SESSION = "fr.sessionReading.v1";
const LEGACY_SEAT = "fr.windowSeat.v1";
export const isOpaqueId = (v: unknown): v is string =>
  typeof v === "string" && /^[a-f\d]{32}$/.test(v);
export const opaqueId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
export const isPersonalRoomKey = (key: string) =>
  key === "cabin:window" || /^cabin:session:[a-f\d]{32}:window$/.test(key);
export const scopedRoomKey = (scope: string, material?: string) =>
  `cabin:session:${scope}:${material === undefined || material === "cabin:window" ? "window" : `source:${material}`}`;

export type ReadGrant = { ref: string; sample: boolean; readAt: number; visits: number };
export type ReadingSession = { epoch: string; scope: string; grants: ReadGrant[]; seat?: string };
export const freshSession = (epoch: string): ReadingSession => ({
  epoch,
  scope: opaqueId(),
  grants: [],
});

type Slot = { fallback?: string | null };
const documents = new WeakMap<Window, Slot>();
function slot(): Slot {
  let s = documents.get(window);
  if (!s) {
    s = {};
    documents.set(window, s);
    // window.open (and duplicate-tab) can start with a copy of the opener's sessionStorage.
    // A new navigation is not a reload or a back/forward restoration of this document.
    const nav = window.performance?.getEntriesByType?.("navigation")?.[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (nav?.type === "navigate") remove(s);
  }
  return s;
}
function remove(s: Slot) {
  try {
    window.sessionStorage.removeItem(SESSION);
    window.sessionStorage.removeItem(LEGACY_SEAT);
    delete s.fallback;
  } catch {
    s.fallback = null; // even if a stale on-disk value could not be removed
  }
}
export function clearSession() {
  if (typeof window !== "undefined") remove(slot());
}
export function sessionInMemory() {
  return typeof window !== "undefined" && documents.get(window)?.fallback !== undefined;
}
export function loadSession(epoch: string | null): ReadingSession | undefined {
  if (typeof window === "undefined") return;
  const s = slot();
  try {
    const raw = s.fallback !== undefined ? s.fallback : window.sessionStorage.getItem(SESSION);
    if (!raw) return;
    const value = JSON.parse(raw) as ReadingSession | null;
    if (
      epoch &&
      value?.epoch === epoch &&
      isOpaqueId(value.scope) &&
      Array.isArray(value.grants) &&
      value.grants.length <= 10 &&
      value.grants.every(
        (g) =>
          g &&
          isOpaqueId(g.ref) &&
          typeof g.sample === "boolean" &&
          Number.isFinite(g.readAt) &&
          Number.isSafeInteger(g.visits) &&
          g.visits > 0,
      ) &&
      (value.seat === undefined || isOpaqueId(value.seat))
    )
      return value;
    remove(s); // expired/reset or malformed: no attempt to reconstruct it from the library
  } catch {
    /* Unreadable tab storage has no authority to restore anything. */
  }
}
export function saveSession(value: ReadingSession) {
  if (typeof window === "undefined") return;
  const s = slot(),
    raw = JSON.stringify(value);
  try {
    window.sessionStorage.setItem(SESSION, raw);
    delete s.fallback;
  } catch {
    // Quota may prohibit writes but still permit removals. Don't revive an older seat on reload.
    try {
      window.sessionStorage.removeItem(SESSION);
    } catch {
      /* denied */
    }
    s.fallback = raw;
  }
}
export function recordGrant(
  session: ReadingSession,
  grant: ReadGrant,
  oldRef?: string,
): ReadingSession {
  const rest = session.grants.filter((g) => g.ref !== grant.ref && g.ref !== oldRef);
  return {
    epoch: session.epoch,
    scope: session.scope,
    grants: [
      ...rest.filter((g) => g.sample !== grant.sample).slice(-5),
      ...rest.filter((g) => g.sample === grant.sample).slice(-4),
      grant,
    ],
  }; // The new read, not a background/idle timer, supersedes the seat.
}
