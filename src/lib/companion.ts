import type {
  DialogueLine,
  PassageBookmark,
  ReadingTrailItem,
  RoundtableResult,
  Speaker,
} from "@/types";

import { readTurn, type TurnContext } from "./turn-intent.ts";
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
  kind: "script" | "typed" | "choice" | "reply" | "note";
  quoteRef?: DialogueLine["quoteRef"];
};
export type Room = {
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
  pending: { key: string; id: string; text?: string } | null;
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
  if ((!context.length && key !== PERSONAL_ROOM) || b.threads.some((t) => t.key === key)) return b;
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
): Room {
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `${at.toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return {
    ...t,
    touched: at,
    turns: [...t.turns, { id, speaker, kind, text, at, quoteRef }].slice(-MAX_TURNS),
  };
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
const privateSubject =
  /身份证|住址|手机号|密码|密钥|转账|自杀|自残|抑郁|确诊|病历|诊断|性侵|银行卡|不想活|伤害自己|不想再活|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\d{7,}/i;
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
export function say(b: Book, key: string, raw: string, now: number): Book {
  const text = raw.trim().slice(0, 400);
  if (!text || !b.threads.some((t) => t.key === key)) return b;
  let next = b.pending?.key === key ? dismissNote(b) : b;
  if (optOut.test(text)) next = setNotes(next, false);
  return changeRoom(next, key, (t) => {
    const turn = readTurn(text, t.conversation);
    const reply = optOut.test(text)
      ? {
          speaker: "purr_cat" as const,
          text: "好，我不再主动留便签了。你来敲窗时，我还在。",
          quoteRef: undefined,
        }
      : replyToTurn(t, text, turn);
    return append(
      append({ ...t, conversation: turn.next }, "user", "typed", text, now),
      reply.speaker,
      "reply",
      reply.text,
      now,
      reply.quoteRef,
    );
  });
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
  env: { visible: boolean; busy: boolean; activeKey: string | null },
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
  if (!latest) return b;
  const { t, user } = latest;
  const last = t.turns.at(-1)!;
  if (
    !user ||
    t.committed ||
    t.conversation?.need === "quiet" ||
    (t.bookmark && privateSubject.test(`${t.bookmark.title} ${t.bookmark.excerpt}`)) ||
    user.kind !== "typed" ||
    (env.activeKey !== null && env.activeKey !== t.key) ||
    t.nudgedFor === user.id ||
    now - last.at < IDLE_MS ||
    now - user.at > 7 * DAY
  )
    return b;
  const recent = t.turns
    .filter((m) => m.kind === "typed")
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
export function takeNote(b: Book, key: string, now: number): Book {
  const invite = b.pending;
  if (!invite || invite.key !== key) return b;
  const next = dismissNote(b);
  return invite.text
    ? changeRoom(next, key, (t) => append(t, "purr_cat", "note", invite.text!, now))
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
