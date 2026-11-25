import type { Book, Room } from "./companion";

/** Local, dated statements, never a model profile. No full utterance or page content is copied. */
export type SharedMemory = {
  id: string;
  topic: string;
  label: string;
  at: number;
  sourceTurn: string;
  offered?: boolean;
};
export const sensitiveText =
  /身份证|住址|手机号|密码|密钥|转账|自杀|自残|抑郁|确诊|病历|诊断|性侵|银行卡|不想活|伤害自己|不想再活|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\d{7,}/i;
export function normalizeMemories(v: unknown): SharedMemory[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  return v
    .filter((m): m is SharedMemory => {
      if (
        !m ||
        typeof m.id !== "string" ||
        !/^(work|pet|craft|style|chosen-[\w-]{1,80})$/.test(m.id) ||
        m.topic !== m.id ||
        seen.has(m.id) ||
        typeof m.label !== "string" ||
        !m.label.trim() ||
        [...m.label].length > 60 ||
        sensitiveText.test(m.label) ||
        typeof m.sourceTurn !== "string" ||
        !/^[\w-]{1,100}$/.test(m.sourceTurn) ||
        !Number.isFinite(m.at)
      )
        return false;
      seen.add(m.id);
      return true;
    })
    .slice(0, 12)
    .map(({ id, topic, label, at, sourceTurn, offered }) => ({
      id,
      topic,
      label,
      at,
      sourceTurn,
      ...(offered === true ? { offered: true } : {}),
    }));
}
const topics: [string, RegExp][] = [
  ["work", /工作|求职|简历|面试|入职|入职通知/],
  ["pet", /宠物|养猫|猫咪|喂猫|家.{0,3}猫|养狗/],
  ["craft", /学艺|手艺|陶艺|修钟|读书会|课程/],
  ["style", /怎么陪|怎么聊|不爱听建议|陪伴方式/],
];
export function knownTopic(text: string) {
  return topics.find(([, re]) => re.test(text))?.[0];
}
const elsewhere =
  /(?:作者|文中|书里|原文|文章里|故事里|网友|新闻|同学说|朋友|同事|室友|我妈|我爸|别人说|听说)|[「“『《"]/;
const conditional =
  /(?:如果|假如|假设|要是|万一|你猜|猜猜|开玩笑|比如|举个例子|并不是|不是我|我没(?:有)?(?:养|找))/;
const remember = /(?:请|麻烦)?(?:你们?|帮我|替我)?(?:帮我)?记住[，,：: ]*(.{2,65})/;
export const asksToRemember = (text: string) =>
  /^(?:(?:猫猫|猫头鹰|狗狗|看山)[，,：: ]+)?(?:请|麻烦)?(?:你们?|帮我|替我)?(?:帮我)?记住[，,：: ]*我/.test(
    text,
  );
function statement(text: string): { topic: string; label: string } | undefined {
  if (
    sensitiveText.test(text) ||
    elsewhere.test(text) ||
    conditional.test(text) ||
    !text.includes("我") ||
    (/(?:还没|没有|没能|尚未|不再)(?:有)?(?:找到|找工作|入职)/.test(text) &&
      !/我已经找到.{0,2}工作/.test(text))
  )
    return;
  const parts = text.split(/[。！？!?；;\n]/).filter(Boolean);
  for (const part of parts) {
    // An explicit question about a topic is not an assertion of ownership.
    if (/(?:吗|是不是|要不要|该不该|记得|记不记得|想不想)/.test(part)) continue;
    if (
      /我(?:现在|最近|终于|昨天|已经|刚刚|刚|正式|顺利|也|上周)*(?:入职(?:了|啦)|找到(?:了|新)?工作(?:了|啦)|开始上班了)/.test(
        part,
      ) ||
      /我(?:已经|刚|最近)?(?:收到|拿到)了?(?:新的?)?(?:入职通知|工作offer)/i.test(part)
    )
      return {
        topic: "work",
        label: /收到|拿到/i.test(part)
          ? "收到了入职通知"
          : /找到/.test(part)
            ? "已经找到工作"
            : "已经入职",
      };
    if (
      /我(?:上个?月|这段时间|这阵子|近来|最近|一直|这几天|现在|又|在|这两天|开始|正在|为了|因为|忙着|准备|正|想|在忙)*?(?:找工作|求职|投简历|找新工作|准备面试)/.test(
        part,
      )
    )
      return {
        topic: "work",
        label:
          /焦虑|紧张|有压力|着急|心烦/.test(part) && !/不(?:再|太)?(?:焦虑|紧张|着急)/.test(part)
            ? "找工作时有些焦虑"
            : "在找工作",
      };
    const pet = part.match(
      /我(?:家(?:里)?|自己|最近|一直)?(?:养了?|有)(?:着|一只|两只|了|只|一条|个|小|条)*(猫|狗)/,
    );
    if (pet) return { topic: "pet", label: "家里养" + (pet[1] === "猫" ? "猫" : "狗") };
    const craft = part.match(
      /我(?:最近|已经|终于|这学期|开始|报名|决定|在|准备|想|学|的|了|上|去|参加|周[一二三四五六日天]){0,10}(陶艺|修钟|读书会)/,
    );
    if (craft) return { topic: "craft", label: "提过" + craft[1] };
    if (
      /我(?:通常|一向|更喜欢|一直希望|希望你们以后).{0,5}(?:先听我说|先听我讲|只听我说)/.test(part)
    )
      return { topic: "style", label: "平时喜欢有人先听自己说" };
  }
  const explicit = text
    .match(remember)?.[1]
    ?.replace(/[。！!，,\s]+$/g, "")
    .trim();
  if (
    explicit &&
    /^我/.test(explicit) &&
    !/[?？]|别记|不要记|忘/.test(text) &&
    [...explicit].length <= 50
  )
    return { topic: "chosen", label: explicit };
}
export function captureStatement(
  b: Book,
  text: string,
  turn: string,
  at: number,
  roomKey: string,
): Book {
  const paused =
    b.memories?.some((m) => m.id === "work") &&
    /^我(?:已经|现在|暂时)?(?:不再|不打算再)找工作(?:了)?[。！!]*$/.test(text);
  const fact = paused ? { topic: "work", label: "暂时不再找工作" } : statement(text);
  if (!fact) return b;
  const all = b.memories ?? [],
    old = all.find((m) =>
      fact.topic === "chosen" ? m.label === fact.label : m.topic === fact.topic,
    );

  const id = old?.id ?? (fact.topic === "chosen" ? "chosen-" + turn : fact.topic);
  const threads = b.threads.map((r) =>
    r.key === roomKey && r.memoryFocus !== id ? { ...r, memoryFocus: id } : r,
  );
  if (old?.label === fact.label) return { ...b, threads }; // Keep the referent, without a new invitation.
  const row: SharedMemory = {
    id,
    topic: id,
    label: fact.label,
    sourceTurn: turn,
    at,
    ...(!b.enabled ? { offered: true } : {}),
  };
  return {
    ...b,
    threads,
    memories: [row, ...all.filter((m) => m.id !== id)].slice(0, 12),
    pending: b.pending?.memoryId === id ? null : b.pending,
    ...(old ? { memoryEpoch: Math.max(at, (b.memoryEpoch ?? 0) + 1) } : {}),
  };
}
export type MemoryAction = "forget" | "mute" | "unmute";
/** A control immediately invalidates pending/online context. Local transcripts remain explicitly browsable. */
export function editMemory(b: Book, id: string, action: MemoryAction, now: number): Book {
  const m = b.memories?.find((x) => x.id === id);
  const muted = b.mutedMemoryTopics ?? [];
  if (!m && !muted.includes(id) && !topics.some(([t]) => t === id)) return b;
  const newMuted =
    action === "mute"
      ? [...new Set([...muted, id])]
      : action === "unmute"
        ? muted.filter((t) => t !== id)
        : muted;
  return {
    ...b,
    memories: action === "forget" ? (b.memories ?? []).filter((x) => x.id !== id) : b.memories,
    mutedMemoryTopics: newMuted,
    pending: null,
    memoryEpoch: Math.max(now, (b.memoryEpoch ?? 0) + 1),
    threads: b.threads.map((r) => ({
      ...r,
      ...(action === "forget"
        ? {
            conversation: r.conversation ? { need: "ack" as const } : undefined,
            memoryFocus: r.memoryFocus === id ? undefined : r.memoryFocus,
          }
        : {}),
      nudgedFor: r.turns.findLast((t) => t.speaker === "user")?.id ?? r.nudgedFor,
    })),
  };
}
export function memoryRequest(
  text: string,
): MemoryAction | "third" | "recall" | "forgetAll" | null {
  if (
    /(?:忘(?:掉|了|记)|清空|删除)(?:我(?:说过)?的?)?(?:所有|全部|全(?:部)?的)(?:事情|事|记忆|近况)/.test(
      text,
    )
  )
    return "forgetAll";
  if (
    /(?:别|不用|不要)(?:再)?(?:记得?|记住)|(?:忘了|忘掉|忘记|删掉)(?:我说过的|之前的|刚才的|关于|那个|这|那|找工作|工作|养猫)/.test(
      text,
    )
  )
    return "forget";
  if (/(?:可以|允许|恢复|重新)(?:再)?主动(?:问|提|聊)/.test(text)) return "unmute";
  if (
    /(?:别|不要|不用|不许|不想让你们?)(?:再|你们?)?主动(?:再)?(?:问|提|聊)|(?:别|不要)(?:再)?提.{0,12}(?:工作|求职|养猫)/.test(
      text,
    )
  )
    return "mute";
  if (
    /(?:那是|是说|说的是|不是我[，,、 ]*是)(?:在说)?我(?:的)?(?:朋友|同事|室友|同学)|(?:是我(?:的)?(?:朋友|同事|室友|同学)).{0,16}不是我/.test(
      text,
    )
  )
    return "third";
  if (
    !/(?:文中|作者|文章|原文|新闻|便签.{0,3}几张|第几)/.test(text) &&
    /(?:还记得|记不记得|你(?:们)?记得|还记着|记住过|上次.{0,7}记了什么|记下了什么|之前我(?:说过|提过)什么)|(?:上次|上回).{0,8}(?:求职|工作|养猫|陶艺).{0,6}(?:接着聊|说到哪)/.test(
      text,
    )
  )
    return "recall";
  return null;
}
export function timeOfMemory(at: number, now: number): string {
  const days = Math.floor((now - at) / 86400000);
  if (days <= 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 7) return "前几天";
  const d = new Date(at),
    n = new Date(now);
  if ((n.getFullYear() - d.getFullYear()) * 12 + n.getMonth() - d.getMonth() === 1) return "上个月";
  return days < 15 ? "前阵子" : `${d.getMonth() + 1}月${d.getDate()}日`;
}
export function memoryNote(m: SharedMemory, now: number) {
  const when = timeOfMemory(m.at, now);
  if (m.label === "找工作时有些焦虑")
    return `${when}你说找工作那阵子有些焦虑。最近好一点了吗？不急着回。`;
  if (m.topic === "pet") return `${when}你提过${m.label}。让我猜猜，它今天也给自己挑了个好座位？`;
  return `${when}你提过「${m.label}」。这件事最近怎么样？想说的时候我在。`;
}
export function handleMemory(b: Book, room: Room, text: string, now: number) {
  const action = memoryRequest(text);
  if (!action) return;
  const all = b.memories ?? [],
    hint = knownTopic(text),
    byLabel = all.find((m) => text.includes(m.label));
  // An exact noun phrase is enough; never infer a similar topic or choose between two matches.
  const subject = text
    .match(/(?:还记得|记不记得|你们?记得|忘了|忘掉|忘记)(.+)$/u)?.[1]
    .replace(/^(?:我的?|上次|上回|上个月|之前|当时|说过的|提过的|关于|那场|那个)+/u, "")
    .replace(/[。！？!? ]+$/u, "")
    .replace(/(?:的事情|那件事|的事)?(?:吗|呢|吧)?$/u, "")
    .trim();
  const matches =
    subject && /^[\p{L}\p{N}]{2,30}$/u.test(subject) && !/什么|怎么|这个|那个|近况/.test(subject)
      ? all.filter((m) => m.label.includes(subject))
      : [];
  if (!byLabel && matches.length > 1)
    return {
      book: b,
      focus: undefined,
      text: "有不止一条说到这个话题，我先不替你选。可以去「伙伴记得」看是哪一条。",
    };
  // Only an explicit reference to *this* memory may fall back to the current focus.
  // An unfamiliar named subject is not the only fact we happen to have on file.
  const pointsHere =
    action === "third" ||
    /(?:[这那](?:一)?件事|[这那]个话题|上次(?:我)?(?:在忙什么|说过什么)|上回(?:我)?在忙什么|记下了什么|之前我(?:说过|提过)什么)(?:吗|呢|了|吧)?[。！？!? ]*$/u.test(
      text,
    );
  const atTable = all.filter((m) =>
    room.turns.some((t) => t.speaker === "user" && t.id === m.sourceTurn),
  );
  const id =
    byLabel?.id ??
    matches[0]?.id ??
    hint ??
    (pointsHere
      ? (room.memoryFocus ??
        (atTable.length === 1 ? atTable[0].id : undefined) ??
        (all.length === 1 ? all[0].id : undefined))
      : undefined);
  if (action === "forgetAll") {
    const clean = all.reduce((acc, m) => editMemory(acc, m.id, "forget", now), b);
    return {
      book: clean,
      text: "好，四位伙伴记下的近况都清掉了。本机聊天记录仍可自行回看。",
      focus: undefined,
    };
  }
  const m = all.find((x) => x.id === id);
  if (action === "recall")
    return {
      book: b,
      focus: m?.id,
      text: m
        ? `${timeOfMemory(m.at, now)}你提过「${m.label}」。这是那次你说的，不是说你现在还一样。`
        : "这件事我没有记下，不想靠猜的。你愿意的话，可以从现在讲起。",
    };
  if (!id)
    return {
      book: b,
      focus: undefined,
      text: "我没法确定你指的是哪一件。可以在阅读记录里的「伙伴记得」选那一条。",
    };
  const next = editMemory(b, id, action === "third" ? "forget" : action, now);
  return {
    book: next,
    focus: action === "forget" || action === "third" ? undefined : id,
    text:
      action === "third"
        ? "明白，是别人的事，不是你的。我不再把它算作你的近况。"
        : action === "mute"
          ? "好，我们不再主动提这个话题。你自己想聊时，仍然可以聊。"
          : action === "unmute"
            ? "好，以后可以再问；不会现在就来打扰。"
            : "好，这件事不再作为伙伴的记忆。本机的聊天原话留给你自己回看。",
  };
}

/** A reader's explicit edit is the new evidence; it never rewrites the old chat bubble. */
export function reviseMemory(b: Book, id: string, label: string, now: number): Book {
  const value = label.trim().replace(/\s+/g, " "),
    old = b.memories?.find((m) => m.id === id);
  if (!old || !value || [...value].length > 50 || sensitiveText.test(value) || value === old.label)
    return b;
  return {
    ...b,
    memories: [
      { ...old, label: value, at: now, sourceTurn: `edit-${now}`, offered: true },
      ...(b.memories ?? []).filter((m) => m.id !== id),
    ],
    memoryEpoch: Math.max(now, (b.memoryEpoch ?? 0) + 1),
    pending: null,
  };
}
export const memoryTopicName = (id: string) =>
  ({ work: "工作近况", pet: "家里的宠物", craft: "学习与兴趣", style: "陪伴方式" })[id] ?? "这件事";
