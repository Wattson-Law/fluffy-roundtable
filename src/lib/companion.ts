import type {
  DialogueLine,
  PassageBookmark,
  ReadingTrailItem,
  RoundtableResult,
  Speaker,
} from "@/types";

import { endsWithWithdrawal, readTurn, type TurnContext } from "./turn-intent.ts";
import {
  asksReadingFact,
  readingForRoom,
  sameReading,
  type TableReading,
} from "./table-reading.ts";
import { isPersonalRoomKey } from "./session-reading.ts";
import type { ReaderThought } from "./reader-thoughts.ts";
import {
  asksToRemember,
  captureStatement,
  handleMemory,
  memoryNote,
  knownTopic,
  sensitiveText,
  type SharedMemory,
} from "./shared-memory.ts";
import { replyToTurn } from "./turn-reply.ts";
export { selectComment } from "./reading-evidence.ts";

export const PERSONAL_ROOM = "cabin:window";
export const IDLE_MS = 5 * 60_000;
export const DAY = 24 * 60 * 60_000;
export const MAX_THREADS = 16;
const MAX_TURNS = 72;
export const names: Record<Speaker, string> = {
  purr_cat: "呼噜猫",
  owl: "考据猫头鹰",
  shiba: "护短柴犬",
  kanshan: "刘看山",
};
export const duties: Record<Speaker, string> = {
  purr_cat: "听你说说",
  owl: "一起弄清楚",
  shiba: "站在你这边",
  kanshan: "记下与收口",
};
export type Turn = {
  id: string;
  speaker: Speaker | "user";
  text: string;
  at: number;
  kind: "script" | "typed" | "choice" | "reply" | "note" | "memory" | "listening";
  quoteRef?: DialogueLine["quoteRef"];
  via?: "model" | "local" | "fallback";
  publicUrl?: string;
};
export type Room = {
  memoryFocus?: string;
  conversation?: TurnContext;
  bookmark?: PassageBookmark;
  key: string;
  title: string;
  context: ReadingTrailItem[];
  result?: RoundtableResult;
  cursor: number;
  turns: Turn[];
  nudgedFor?: string;
  committed?: boolean;
  followUp?: { text: string; microAction: string };
  touched: number;
};
export type Book = {
  version: 1;
  enabled: boolean;
  lastNudgeAt: number;
  thoughts?: ReaderThought[];
  memories?: SharedMemory[];
  mutedMemoryTopics?: string[];
  memoryEpoch?: number;
  pending: { key: string; id: string; text?: string; memoryId?: string } | null;
  threads: Room[];
};
export const emptyBook = (): Book => ({
  version: 1,
  enabled: true,
  lastNudgeAt: 0,
  pending: null,
  threads: [],
});
export function changeRoom(b: Book, key: string, fn: (t: Room) => Room): Book {
  const orig = b.threads.find((t) => t.key === key);
  if (!orig) return b;
  const next = fn(orig);
  return next === orig ? b : { ...b, threads: b.threads.map((t) => (t === orig ? next : t)) };
}
export function startThread(
  b: Book,
  key: string,
  context: ReadingTrailItem[],
  now: number,
  bookmark?: PassageBookmark,
): Book {
  if ((!context.length && !isPersonalRoomKey(key)) || b.threads.some((t) => t.key === key))
    return b;
  const item = context.at(-1);
  const others = b.threads
    .slice()
    .sort(
      (a, z) =>
        Number(z.key === b.pending?.key) - Number(a.key === b.pending?.key) ||
        z.touched - a.touched,
    );
  return {
    ...b,
    threads: [
      {
        key,
        ...(bookmark ? { bookmark } : {}),
        title: bookmark?.title || item?.fromQuestion || item?.title || "窗边随聊",
        context: context.slice(-5),
        cursor: 0,
        turns: [],
        touched: now,
      },
      ...others.slice(0, MAX_THREADS - 1),
    ],
  };
}
export const withResult = (b: Book, key: string, result: RoundtableResult) =>
  changeRoom(b, key, (t) => ({ ...t, result }));
function append(
  t: Room,
  speaker: Turn["speaker"],
  kind: Turn["kind"],
  text: string,
  at: number,
  quoteRef?: Turn["quoteRef"],
  via?: Turn["via"],
): Room {
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `${at.toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return {
    ...t,
    touched: at,
    turns: [...t.turns, { id, speaker, kind, text, at, quoteRef, ...(via ? { via } : {}) }].slice(
      -MAX_TURNS,
    ),
  };
}
/** Local public discussion is not reader testimony, a memory candidate or a model turn. */
export function recordListeningTurn(
  b: Book,
  key: string,
  speaker: Turn["speaker"],
  text: string,
  now: number,
  publicUrl?: string,
): Book {
  return changeRoom(b, key, (r) => {
    const next = append(
      { ...r, conversation: { need: "ack" }, memoryFocus: undefined },
      speaker,
      "listening",
      text,
      now,
      undefined,
      "local",
    );
    if (publicUrl)
      next.turns[next.turns.length - 1] = { ...next.turns[next.turns.length - 1], publicUrl };
    return next;
  });
}
export function nextLine(b: Book, key: string, now: number): Book {
  return changeRoom(b, key, (t) => {
    if (t.conversation) return t; // An interruption retires this guide, even after reload.
    const line = t.result?.dialogues[t.cursor];
    return line
      ? {
          ...append(t, line.speaker, "script", line.text, now, line.quoteRef),
          cursor: t.cursor + 1,
        }
      : t;
  });
}
export const dismissNote = (b: Book): Book => (b.pending ? { ...b, pending: null } : b);
export function setNotes(b: Book, enabled: boolean): Book {
  if (b.enabled === enabled) return b;
  return {
    ...b,
    enabled,
    pending: enabled ? b.pending : null,
    memories: enabled ? b.memories : b.memories?.map((m) => ({ ...m, offered: true })),
    threads: enabled
      ? b.threads
      : b.threads.map((t) => ({
          ...t,
          nudgedFor: t.turns.findLast((m) => m.kind === "typed")?.id ?? t.nudgedFor,
        })),
  };
}
const optOut =
  /(?:不想|不希望|不需要)(?:再)?(?:收到?|被)(?:主动)?(?:消息|提醒|打扰|联系|便签)|(?:别|不要|不用)(?:再)?主动(?:给我)?(?:发|来|联系)|(?:关掉|关闭)(?:主动)?便签|(别再|不要再|不想再|不用再|关闭|关掉|停止|取消|别|不要|不用)(?:主动)?(?:提醒|发消息|发便签|来信|打扰|找我|联系我)|免打扰/;
const wantsSpace =
  /已经想明白了|已经决定了|不用继续了|问题解决了|不想聊|不聊了|想静静|先不聊|[想要]安静|想自己待|别问了|到这里|到这[里儿]?吧|晚安/;
const privateSubject = sensitiveText;
const themes = [
  {
    re: /选[择项]|两条路|取舍|纠结|拿不定|比较|犹豫|还是先/,
    note: "上回聊到怎么做选择，我还记得。还没想定的部分，我也愿意听。",
  },
  {
    re: /原文|证据|出处|引用|来源|依据|数字/,
    note: "上回你想把原文看明白一点。要是那句话还挂在心里，我在窗边听。",
  },
  {
    re: /累|歇|没力气|疲惫|压力|喘口气/,
    note: "上回你说有些累。我把窗边的垫子留着，今天不说话也好。",
  },
  {
    re: /只想说说|只想聊聊|听我说|别给建议|不想要建议/,
    note: "你上回说，只是想有人听听。我不出主意，还是给你留着那把椅子。",
  },
  {
    re: /摄影|拍照|照片|拍鸟/,
    note: "上回聊到了拍照。要是又看到什么想留住的画面，我愿意听你讲。",
  },
  {
    re: /计划|笔记|项目|学[习不]|课程|进度/,
    note: "上回说起想做的那件事，我还记得。无论有没有新进展，窗边都给你留了位置。",
  },
];
const ordinaryNote = "上次聊到一半的小屋还开着。想接着说，我在听；想继续看书也好。";
type SpeechReply = Pick<Turn, "text" | "quoteRef"> & { speaker: Speaker };
export type SpeechStart = { book: Book; anchor?: string; fallback?: SpeechReply };

/** Store the reader first: an online response must still own this exact place at the table. */
export function startSpeech(
  b: Book,
  key: string,
  raw: string,
  now: number,
  online: boolean,
  shared?: TableReading | null,
): SpeechStart {
  const text = raw.trim().slice(0, 400);
  const room = b.threads.find((t) => t.key === key);
  if (!text || !room) return { book: b };
  const mute = optOut.test(text),
    turn = readTurn(text, room.conversation);
  let next = b.pending?.key === key ? dismissNote(b) : b;
  const memoryControl = handleMemory(next, room, text, now);
  if (memoryControl) {
    const book = changeRoom(memoryControl.book, key, (r) =>
      append(
        append(
          { ...r, conversation: { need: "ack" }, memoryFocus: memoryControl.focus },
          "user",
          "memory",
          text,
          now,
        ),
        turn.named ?? "purr_cat",
        "reply",
        memoryControl.text,
        now,
        undefined,
        "local",
      ),
    );
    return { book };
  }
  if (asksToRemember(text)) {
    const started = changeRoom(next, key, (r) =>
      append({ ...r, conversation: { need: "ack" } }, "user", "typed", text, now),
    );
    const user = started.threads.find((r) => r.key === key)!.turns.at(-1)!;
    const recorded = captureStatement(started, text, user.id, now);
    const m = recorded.memories?.find((m) => m.sourceTurn === user.id);
    return {
      book: changeRoom(recorded, key, (r) =>
        append(
          { ...r, memoryFocus: m?.id ?? r.memoryFocus },
          turn.named ?? "kanshan",
          "reply",
          m
            ? `我把「${m.label}」记在本机了。`
            : "没有新增小记。只记简短的本人近况，不记敏感内容，也不重复记。",
          now,
          undefined,
          "local",
        ),
      ),
    };
  }
  if (mute) next = setNotes(next, false);
  const withdraw = endsWithWithdrawal(text);
  const need = turn.next.need;
  const fact = asksReadingFact(text, room.context.length > 0);
  // A request to locate a source or a comment is an on-device lookup, even if phrased as a fact question.
  const articleLookup =
    need === "article" &&
    (!fact ||
      /出处|引用|证据|引文|(?:找|查|列出|摘|指出|核对).{0,10}(?:原文|原句)|(?:原文|原句).{0,30}(?:那句|哪一句)/.test(
        text,
      ));
  const localSource =
    (articleLookup || need === "comments") &&
    (room.context.length > 0 ||
      /原文|原句|这篇|文中|作者|出处|引文|精选评论|评论区.{0,4}(?:说|提到)/.test(text));
  const recall = !mute && !withdraw && need !== "quiet" && !localSource && fact;
  const preview = recall ? readingForRoom(room) : null;
  const row = room.context.at(-1);
  const fallback: SpeechReply = mute
    ? {
        speaker: "purr_cat",
        text: "好，我不再主动留便签了。你来敲窗时，我还在。",
      }
    : withdraw
      ? { speaker: turn.named ?? "kanshan", text: "好，接下来不再带这段原文和刚才的聊天。" }
      : recall
        ? {
            speaker: turn.named ?? "owl",
            text:
              preview && row
                ? "我把本机能核对的这段夹在下面。没写在这里的，我先不猜。"
                : "我手边没有这篇能核对的原句，先不猜。",
            ...(preview && row
              ? {
                  quoteRef: {
                    excerpt: preview.excerpt,
                    sourceTitle: row.title,
                    sourceUrl: row.url,
                    sourceTag: `READ_${room.context.length - 1}`,
                    reason: "本机核对 · 当前选段",
                  },
                }
              : {}),
          }
        : replyToTurn(room, text, turn);
  const live =
    online &&
    !mute &&
    !withdraw &&
    need !== "quiet" &&
    !localSource &&
    (!recall || sameReading(shared, preview));
  const book = changeRoom(next, key, (t) => {
    const started = append(
      { ...t, conversation: turn.next },
      "user",
      "typed",
      text,
      now,
      undefined,
      live ? "model" : undefined,
    );
    return live
      ? started
      : append(started, fallback.speaker, "reply", fallback.text, now, fallback.quoteRef, "local");
  });
  const user = book.threads
    .find((t) => t.key === key)!
    .turns.findLast((t) => t.speaker === "user")!;
  const recorded =
    !mute && !withdraw && need !== "quiet" && !fact && !localSource
      ? captureStatement(book, text, user.id, now)
      : book;
  if (!live) return { book: recorded };
  return { book: recorded, anchor: user.id, fallback };
}
export function say(b: Book, key: string, raw: string, now: number): Book {
  return startSpeech(b, key, raw, now, false).book;
}
export function settleSpeech(
  b: Book,
  key: string,
  anchor: string,
  reply: SpeechReply,
  now: number,
  via: "model" | "fallback",
): Book {
  return changeRoom(b, key, (t) =>
    t.turns.at(-1)?.id !== anchor
      ? t
      : append(t, reply.speaker, "reply", reply.text, now, reply.quoteRef, via),
  );
}
export function acceptChoice(
  b: Book,
  key: string,
  label: string,
  reply: { text: string; microAction: string },
  now: number,
  expectedLastTurn: string | undefined,
): Book {
  const current = b.threads.find((t) => t.key === key);
  if (!current || current.committed || current.turns.at(-1)?.id !== expectedLastTurn) return b;
  return changeRoom(b.pending?.key === key ? dismissNote(b) : b, key, (t) => ({
    ...append(append(t, "user", "choice", label, now), "kanshan", "reply", reply.text, now),
    followUp: reply,
  }));
}
export function catCheckIn(
  b: Book,
  now: number,
  env: {
    visible: boolean;
    busy: boolean;
    activeKey: string | null;
    personalKey?: string;
    resumeKey?: string | null;
  },
): Book {
  if (
    !env.visible ||
    env.busy ||
    !b.enabled ||
    b.pending ||
    (b.lastNudgeAt && now - b.lastNudgeAt < DAY)
  )
    return b;
  // Only the most recent human exchange may be continued. Opening/reading posts isn't a conversation.
  const latest = b.threads
    .map((t) => ({ t, user: t.turns.findLast((m) => m.speaker === "user") }))
    .filter((x) => x.user)
    .sort((a, z) => z.user!.at - a.user!.at)[0];
  // Shared notes are independent of thread retention. Never infer a topic from a URL or reading history.
  const lastHuman = latest?.user;
  const closedForNow =
    lastHuman &&
    (latest.t.committed ||
      latest.t.conversation?.need === "quiet" ||
      lastHuman.kind !== "typed" ||
      wantsSpace.test(lastHuman.text) ||
      privateSubject.test(lastHuman.text) ||
      now - (latest.t.turns.at(-1)?.at ?? now) < IDLE_MS);
  const memory = (b.memories ?? []).find(
    (m) =>
      !m.offered &&
      now - m.at >= IDLE_MS &&
      !(b.mutedMemoryTopics ?? []).includes(m.topic) &&
      (env.activeKey === null ||
        b.threads
          .find((r) => r.key === env.activeKey)
          ?.turns.some((t) => t.speaker === "user" && t.id === m.sourceTurn)),
  );
  if (memory && !closedForNow) {
    // Outside a room, entering the invite is not implicit permission to reopen yesterday's article.
    const target = env.activeKey ?? env.personalKey ?? PERSONAL_ROOM;
    const root = startThread(b, target, [], now);
    const offered = {
      ...root,
      lastNudgeAt: now,
      memories: root.memories?.map((m) => (m.id === memory.id ? { ...m, offered: true } : m)),
      pending: { key: target, id: memory.sourceTurn, memoryId: memory.id },
    };
    return env.activeKey === target ? takeNote(offered, target, now) : offered;
  }
  if (!latest) return b;
  const { t, user } = latest;
  const last = t.turns.at(-1)!;
  if (
    !user ||
    t.committed ||
    t.conversation?.need === "quiet" ||
    (t.bookmark && privateSubject.test(`${t.bookmark.title} ${t.bookmark.excerpt}`)) ||
    (env.activeKey === null && env.resumeKey !== undefined && env.resumeKey !== t.key) ||
    user.kind !== "typed" ||
    user.at <= (b.memoryEpoch ?? -1) ||
    b.memories?.some((m) => m.sourceTurn === user.id) ||
    (b.mutedMemoryTopics ?? []).includes(knownTopic(user.text) ?? "") ||
    (env.activeKey !== null && env.activeKey !== t.key) ||
    t.nudgedFor === user.id ||
    now - last.at < IDLE_MS ||
    now - user.at > 7 * DAY
  )
    return b;
  const recent = t.turns
    .filter(
      (m) =>
        m.kind === "typed" &&
        m.at > (b.memoryEpoch ?? -1) &&
        !(b.mutedMemoryTopics ?? []).includes(knownTopic(m.text) ?? ""),
    )
    .slice(-3)
    .reverse();
  if (
    wantsSpace.test(user.text) ||
    recent.some((m) => privateSubject.test(m.text) || optOut.test(m.text))
  )
    return b;
  const theme = recent.map((m) => themes.find((o) => o.re.test(m.text))).find(Boolean);
  const note = t.bookmark
    ? recent.some((m) => /两种(?:做法|方法|读法|写法|记法|笔记|记笔记)/.test(m.text))
      ? /笔记/.test(t.bookmark.title)
        ? "上次那张书签还夹着。那两种记笔记的方法，还想接着聊吗？"
        : "上次那张书签还夹着。那两种做法，你还想接着聊吗？"
      : `上次那张书签还夹着。${theme?.note ?? "想翻回那一句时，我陪你。"}`
    : (theme?.note ?? ordinaryNote);
  const offered = {
    ...changeRoom(b, t.key, (room) => ({ ...room, nudgedFor: user.id })),
    lastNudgeAt: now,
    pending: { key: t.key, id: user.id, text: note },
  };
  return env.activeKey === t.key ? takeNote(offered, t.key, now) : offered;
}
/** Outside the cabin only an invitation exists. Older saves may already contain the actual note. */
export function takeNote(b: Book, key: string, now: number, destination = key): Book {
  const invite = b.pending;
  if (!invite || invite.key !== key) return b;
  if (destination !== key && !isPersonalRoomKey(destination)) return b;
  const next = dismissNote(b);
  if (invite.memoryId) {
    const m = b.memories?.find((m) => m.id === invite.memoryId && m.sourceTurn === invite.id);
    if (!m || b.mutedMemoryTopics?.includes(m.topic)) return next;
    return changeRoom(startThread(next, destination, [], now), destination, (r) =>
      append({ ...r, memoryFocus: m.id }, "purr_cat", "note", memoryNote(m, now), now),
    );
  }
  if (destination !== key)
    return changeRoom(startThread(next, destination, [], now), destination, (r) =>
      append(
        { ...r, conversation: { need: "ack" } },
        "purr_cat",
        "note",
        "窗边给你留着位置。今天想聊什么都行。",
        now,
      ),
    );
  return invite.text
    ? changeRoom(next, key, (r) => append(r, "purr_cat", "note", invite.text!, now))
    : next;
}
/** Keep the four project duties intact even when the model omits a speaker or drops a quote. */
export function shapeRoles(candidate: DialogueLine[], fallback: DialogueLine[]): DialogueLine[] {
  const select = (s: Speaker) => candidate.filter((l) => l.speaker === s);
  const backup = (s: Speaker) => fallback.filter((l) => l.speaker === s);
  const cat = select("purr_cat")[0] ?? backup("purr_cat")[0];
  const owls = [...select("owl"), ...backup("owl")].filter((l) => l.quoteRef?.sourceUrl);
  const fromRead = owls.find((l) => l.quoteRef?.sourceTag.startsWith("READ_")),
    external = owls.find((l) => l.quoteRef?.sourceTag.startsWith("EXT_"));
  const evidence = fromRead ? [fromRead, ...(external ? [external] : [])] : backup("owl");
  const dogs = select("shiba"),
    backupDogs = backup("shiba");
  const remark = backupDogs.find((l) => l.quoteRef?.reason.includes("评论"));
  const dog = remark
    ? [
        remark,
        ...(dogs.length ? dogs : backupDogs).filter(
          (l) => l.quoteRef?.excerpt !== remark.quoteRef?.excerpt,
        ),
      ]
    : backupDogs.some((l) => l.text.includes("没有返回可核对的精选评论"))
      ? backupDogs
      : dogs.length
        ? dogs
        : backupDogs;
  const host = select("kanshan").at(-1) ?? backup("kanshan").at(-1);
  return [cat, ...evidence.slice(0, 2), ...dog.slice(0, 2), host].filter(
    (l): l is DialogueLine => !!l,
  );
}
