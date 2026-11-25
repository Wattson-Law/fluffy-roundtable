import type { HotItem, Speaker } from "@/types";
import type { Turn } from "./companion.ts";

export type ListeningIntent =
  | {
      kind:
        | "hot"
        | "listen"
        | "next"
        | "back"
        | "step"
        | "stop"
        | "evidence"
        | "comments"
        | "opinion";
    }
  | { kind: "scope"; query: string }
  | { kind: "reader" | "rumor"; title: string };

// Fail toward ordinary conversation. In particular, “我听说” isn't consent to search.
const privateCues =
  /我|咱|俺|本人|你|他[们的]|她|这人|那个人|心事|私事|家里|家人|爸|妈|爷爷|奶奶|室友|同事|老板|领导|同学|导师|男友|女友|朋友|对象|老公|老婆|丈夫|妻子|这份工作|面试没|分手|失恋|好累|很累|很烦|失落|难受|心情|想睡|不敢|害怕|担心|难过|焦虑|心慌|吐槽|安慰|打气|不想聊|怎么办|其实|电话|住址|\d{6}|[@:/]/u;
const fields: ReadonlyArray<[RegExp, RegExp]> = [
  [
    /^(科技|技术)$/u,
    /科技|技术|人工智能|大模型|机器人|芯片|半导体|算法|开源|计算机|量子|航天|太空|卫星|电池|\bAI\b/i,
  ],
  [
    /^(体育|运动)$/u,
    /体育|联赛|足球|篮球|排球|网球|冰球|棒球|乒乓球|羽毛球|球员|球赛|赛季|夺冠|奥运|游泳|田径|马拉松/u,
  ],
  [/^(天文|太空|航天)$/u, /天文|太空|航天|月球|火星|地球|行星|星系|望远镜|卫星|火箭|探测器/u],
  [/^(文化|文艺)$/u, /文化|文艺|文学|小说|电影|戏剧|博物馆|图书馆|展览|非遗/u],
  [/^(环保|环境)$/u, /环保|环境|生态|气候|碳排放|回收|保护区/u],
];
const publicSubject =
  /公共|新闻|城市|市民|政策|发布|科学|教育|历史|考古|经济|市场|物价|涨价|气象|天气|试点|试行|学校|大学|交通|公交|地铁|通勤|高铁|公园|医疗|医院|海洋|海水|音乐|游戏|手机|互联网|动物|植物|能源|法律/u;
function looksPublic(text: string) {
  return publicSubject.test(text) || fields.some(([, related]) => related.test(text));
}
function shortScope(text: string) {
  return (
    /^[\p{L}\d][\p{L}\d -]{0,11}$/u.test(text) &&
    !privateCues.test(text) &&
    !/刚才|昨天的事|今天的事|心情|轻松|开心|别的|算了|那件事|工资|病情|住院/u.test(text)
  );
}

export function readListeningIntent(text: string, atDesk = false): ListeningIntent | null {
  const raw = text.trim();
  if (!raw || raw.length > 120 || /[\r\n]/u.test(raw)) return null;
  const command = raw
    .replace(/[\s，,、]/gu, "")
    .replace(/[。.!！?？~～]+$/u, "")
    .replace(/[呀吧啦啊]$/u, "");
  if (
    /^(?:请)?(?:你们|大家|伙伴们)?(?:帮我|给我|来)?(?:挑|选)(?:一?[个条则道]|点)?(?:知乎)?(?:热榜(?:上的)?(?:新闻|话题)?|新闻|公共话题|话题)(?:来?聊聊|聊一聊)?(?:我听着|我旁听)?$/u.test(
      command,
    )
  )
    return { kind: "hot" };
  if (
    /^(?:你们|大家|伙伴们)?(?:接着|接下去|继续)(?:聊聊|聊|说|讲)?(?:吧)?我(?:听着|旁听)(?:就好|呢|就行)?$/u.test(
      command,
    )
  )
    return { kind: "listen" };
  if (atDesk) {
    if (
      /^(?:(?:(?:这|那)(?:条新闻|个话题|件事|题)的?)?(?:(?:精选)?评论(?:区)?|网友)(?:里|都)?(?:是)?(?:怎么说(?:的)?|说了什么|有什么看法|怎么看)|有(?:精选)?评论吗)$/u.test(
        command,
      )
    )
      return { kind: "comments" };
    if (
      /^(?:(?:这|那)(?:条新闻|个话题|件事|题))?(?:狗狗|柴犬|护短柴犬)?(?:你们?|大家)(?:怎么看|有什么想法|会怎么做|怎么想)(?:呢)?$/u.test(
        command,
      )
    )
      return { kind: "opinion" };
    if (
      /^(?:(?:这|那)(?:条新闻|个消息|件事|条|题)(?:已经|有|是)?|这)?(?:已经证实了吗|证实了吗|是真的吗|有(?:什么)?依据|有什么出处|有原帖吗|来源是什么|的出处呢)$/u.test(
        command,
      )
    )
      return { kind: "evidence" };
    if (
      /^(?:(?:(?:这[个条题]|对这[个条题])?我?(?:没(?:什么)?兴趣|不感兴趣))(?:换一?[题条个])?|不想听这[个条题]|(?:换|下)一?[题条个](?:新闻|话题)?|换个话题|聊点别的)$/u.test(
        command,
      )
    )
      return { kind: "next" };
    if (
      /^(?:还是|再)?(?:聊聊?|接着聊|回到|回去聊)?(?:上(?:一)?[题条个]|刚才那[题条个])$/u.test(
        command,
      )
    )
      return { kind: "back" };
    if (/^(?:再听一句|继续(?:聊)?|接着(?:说|聊)|然后呢)$/u.test(command)) return { kind: "step" };
    if (/^(?:暂停(?:旁听)?|先停(?:一下)?|停一下|先不听了)$/u.test(command)) return { kind: "stop" };
  }

  const scope =
    /^(?:请|那就)?(?:你们|我想)?(?:聊点|听点|说点|找点)(.{1,12}?)(?:的(?:新闻|话题)?|类(?:的)?(?:新闻|话题)?|新闻|话题)(?:吧|呗|呀)?[。！!？?]?$/u
      .exec(raw)?.[1]
      .trim();
  if (scope) return shortScope(scope) ? { kind: "scope", query: scope } : null;
  const rumor = /^我听说[，,：:\s]*(.+)$/u
    .exec(raw)?.[1]
    .replace(/[，,]\s*(?:你们怎么看|这是真的吗|真的假的|一起聊聊)[？?。！!]?$/u, "")
    .trim();
  // A second, uninvited clause may be the real point (e.g. a personal disclosure).
  if (rumor && /[，,]/u.test(rumor)) return null;
  const explicit = /^(?:我来出(?:个)?题|我出个题|公共话题|话题是)(?:\s*[：:，,]\s*|\s+)(.+)$/u
    .exec(raw)?.[1]
    .trim();
  const subject =
    rumor || explicit || /^(?:我想|你们|我们|来)?(?:聊聊|聊一聊)(.+)$/u.exec(raw)?.[1].trim();
  if (
    !subject ||
    subject.length < 2 ||
    subject.length > 92 ||
    privateCues.test(subject.replace(/(?:我们|咱们)(?=市|这座城)/gu, "")) ||
    /[；;]|[。！？!?].+/u.test(subject)
  )
    return null;
  if (!explicit && !looksPublic(subject)) return null;
  return { kind: rumor ? "rumor" : "reader", title: subject };
}

export type ListeningTopic = {
  origin: "hot" | "search" | "reader" | "rumor";
  title: string;
  excerpt: string;
  comment?: string;
  /** Direct Zhihu source, never a generated URL or the API's fallback homepage. */
  url?: string;
};
export type ListeningLine = Pick<Turn, "at" | "id" | "text"> & {
  speaker: Speaker;
  kind: "listening";
  via: "local";
  topic: ListeningTopic;
};

const plain = (s: unknown) => (typeof s === "string" ? s.trim().replace(/\s+/gu, " ") : "");
function clip(text: string, max: number) {
  const chars = Array.from(text);
  return chars.length > max ? chars.slice(0, max - 1).join("") + "…" : text;
}
export function zhihuSource(raw: unknown) {
  if (typeof raw !== "string" || !/^(?:https?:\/\/|\/(?!\/))/iu.test(raw)) return;
  try {
    const link = new URL(raw, "https://www.zhihu.com");
    if (
      !["zhihu.com", "www.zhihu.com", "zhuanlan.zhihu.com"].includes(link.hostname) ||
      link.username ||
      link.password ||
      link.port ||
      !/^\/(?:question|answer|p|pin|zvideo|topic)\/[^/]+/u.test(link.pathname)
    )
      return;
    link.protocol = "https:";
    return link.href;
  } catch {
    return;
  }
}
function distinct(topics: ListeningTopic[]) {
  const titles = new Set<string>(),
    urls = new Set<string>();
  return topics.filter(({ title, url }) => {
    const name = title.toLowerCase(),
      path = url?.split(/[?#]/u)[0];
    if (titles.has(name) || (path && urls.has(path))) return false;
    titles.add(name);
    if (path) urls.add(path);
    return true;
  });
}
function fromItems(items: readonly unknown[], origin: "hot" | "search", scope?: string) {
  const topics: ListeningTopic[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = clip(plain(row.title), 160);
    if (row.origin === "sample" || !title || title === "（未命名）") continue;
    const excerpt = clip(plain(origin === "hot" ? row.summary : row.contentText), 180);
    const material = `${title} ${excerpt}`;
    if (
      scope &&
      !material.toLowerCase().includes(scope.toLowerCase()) &&
      !fields.some(([name, related]) => name.test(scope) && related.test(material))
    )
      continue;
    const url = zhihuSource(row.url);
    const comment =
      origin === "search" && url && Array.isArray(row.comments)
        ? clip(plain(row.comments.find((v) => plain(v).length > 0)), 100)
        : "";
    topics.push({
      origin,
      title,
      excerpt: excerpt === title ? "" : excerpt,
      url,
      ...(comment ? { comment } : {}),
    });
  }
  return distinct(topics);
}
export function hotTopics(hot: readonly HotItem[], live: boolean): ListeningTopic[] {
  return live ? fromItems(hot, "hot") : [];
}
export async function searchListeningTopics(
  query: string,
  signal: AbortSignal,
  request: typeof fetch = fetch,
) {
  if (!shortScope(query)) throw new Error("只用简短的公共范围找题。");
  const response = await request(
    `/api/zhihu/search?${new URLSearchParams({ q: query, count: "6" })}`,
    { signal },
  );
  if (!response.ok) throw new Error("站内搜索暂不可用。");
  const data = await response.json();
  if (data?.degraded !== false || !Array.isArray(data.items))
    throw new Error("没有取到站内搜索结果。");
  return fromItems(data.items, "search", query);
}

type Voice = Pick<ListeningLine, "speaker" | "text">;
function opening(t: ListeningTopic, bridge: boolean): Voice {
  const title = `「${t.title}」`;
  switch (t.origin) {
    case "rumor":
      return { speaker: "owl", text: `你听到的是${title}。这还是未经证实的说法，咱们当作假设聊。` };
    case "reader":
      return { speaker: "purr_cat", text: `好，就聊你出的这题：${title}。` };
    default:
      return {
        speaker: "kanshan",
        text: bridge
          ? `刚才那题先留着。换一张：${title}。`
          : t.origin === "hot"
            ? `从这份知乎热榜开头挑一条：${title}。`
            : `站内找到了这题：${title}。`,
      };
  }
}
function angle(t: ListeningTopic): string {
  const material = `${t.title} ${t.excerpt}`;
  if (/图书馆|阅览室/u.test(material) && /晚|时间|开放|闭馆|通宵/u.test(material))
    return "如果想照顾晚上才有空的人，我会先让一间阅览室晚点关。这样可以先看看谁用得上，不必一开始就让整栋楼都值夜班。";
  if (/芯片|处理器|显卡/u.test(material) && /比较|性能|功耗|测试|散热|测温/u.test(material))
    return "如果让我来比，我想让它们做同一件事，再一起看花了多久、用了多少电。只挑一个最快的数字，还不是我想知道的差别。";
  if (/地铁|公交|末班车/u.test(material) && /晚|时间|末班|延|班次/u.test(material))
    return "如果多开一班，我会先看下车后还能不能换乘。对要转车的人来说，最后一段也接得上才有用。";
  if (/试点|试行|征求意见/u.test(material))
    return "如果是先试一段时间，我在意的是试完怎么决定留不留。哪些人的日子方便了，哪些人反倒添了麻烦，都值得问。";
  if (/价格|涨价|降价|票价/u.test(material))
    return "如果要比价格，我会先摆出同一规格、同一时间段的两张价签。一次优惠和常年便宜，对经常买的人不是一回事。";
  if (t.origin === "rumor")
    return `如果「${clip(t.title, 44)}」属实，我想先弄清它影响谁。只发生在一个地方，和到处都会遇到，意义很不一样。`;
  if (/为什么|原因/u.test(t.title))
    return `说到「${clip(t.title, 44)}」，我想找个条件相近、结果却不同的例子。这样比直接挑一个听起来顺耳的原因更能说明问题。`;
  if (/该不该|要不要|应不应该|是否应该/u.test(t.title))
    return `拿「${clip(t.title, 44)}」来说，我想先听最受影响的人会怎么选，再谈要不要替所有人定一个办法。`;
  return `聊「${clip(t.title, 44)}」，我会先留一个具体例子，再看看换个条件还成不成立。我不想拿一个例子替所有人说话。`;
}
function remarks(t: ListeningTopic): Voice[] {
  const idea: Voice = { speaker: "shiba", text: angle(t) };
  if (t.origin === "reader" || t.origin === "rumor") return [idea];
  const sentences = t.excerpt.match(/[^。！？!?]+(?:[。！？!?]+|$)/gu) ?? [];
  const excerpt = clip(sentences[0]?.trim() || t.excerpt, 100);
  const evidence: Voice = {
    speaker: "owl",
    text: excerpt
      ? `${t.origin === "hot" ? "题目附的摘要" : "站内这篇的摘录"}写的是：「${excerpt}」`
      : "我手上只有标题，没拿到这题的摘录。标题提了问题，不等于已经有了答案。",
  };
  // For unfamiliar material use the author's next actual sentence, not a stock opinion about the news.
  if (sentences[1] && !looksPublic(t.title) && t.excerpt.length > excerpt.length) {
    return [
      evidence,
      {
        speaker: "purr_cat",
        text: `我还留意到后面这句：「${clip(sentences[1].trim(), 90)}」把它和前一句放在一起读，比光看题目多了一层意思。`,
      },
    ];
  }
  return [evidence, idea];
}

export type ListeningState = {
  topic?: ListeningTopic;
  upNext?: ListeningTopic;
  previous?: ListeningTopic;
  activeLine?: ListeningLine;
  scope?: string;
  hasMoreLines: boolean;
  continuous: boolean;
  searching: boolean;
  notice: string;
};
const empty: ListeningState = {
  hasMoreLines: false,
  continuous: false,
  searching: false,
  notice: "",
};
type Seat = {
  deck: ListeningTopic[];
  index: number;
  scope?: string;
  replies: Voice[];
  read: number;
};
const seatedTopic = (seat?: Seat) => seat?.deck[seat.index];
let serial = 0;

/** One ephemeral session per mounted room. No reading history, storage, model, or background polling. */
export function createListeningSession(options: {
  getFeed: () => { hot: readonly HotItem[]; live: boolean };
  onLine?: (line: ListeningLine) => void;
  canSpeak?: () => boolean;
  request?: typeof fetch;
}) {
  let state = empty,
    seat: Seat | undefined;
  const past: Seat[] = [],
    listeners = new Set<() => void>();
  let generation = 0,
    pending: AbortController | undefined,
    timer: ReturnType<typeof setTimeout> | undefined;
  const allowed = () => options.canSpeak?.() ?? true;
  const feed = () => {
    const { hot, live } = options.getFeed();
    return hotTopics(hot, live);
  };
  function update(patch: Partial<ListeningState>) {
    state = {
      ...state,
      topic: seatedTopic(seat),
      previous: seatedTopic(past.at(-1)),
      upNext: seat?.deck[seat.index + 1],
      hasMoreLines: !!seat && seat.read < seat.replies.length,
      ...patch,
    };
    listeners.forEach((notify) => notify());
  }
  function interrupt() {
    generation++;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    pending?.abort();
    pending = undefined;
  }
  function stop() {
    interrupt();
    if (state.continuous || state.searching || state.activeLine)
      update({
        activeLine: undefined,
        searching: false,
        continuous: false,
        notice: state.searching ? "已经停止找题，没有再查。" : state.notice,
      });
  }
  function cancel() {
    interrupt();
    seat = undefined;
    past.length = 0;
    if (state !== empty) {
      state = empty;
      listeners.forEach((notify) => notify());
    }
  }
  function leaveSeat() {
    if (!seat) return;
    past.push(seat);
    if (past.length > 8) past.shift();
    seat = undefined;
  }
  function endNote(scope?: string) {
    return scope
      ? `这次找到的「${scope}」话题就到这里了。可以换个范围，也可以自己出题。`
      : "手边没有下一条了。想留在这题或自己出题都可以。";
  }
  function schedule() {
    if (!state.continuous || timer !== undefined) return;
    const token = generation;
    const delay = Math.min(
      24_000,
      Math.max(8_000, 2_000 + (state.activeLine?.text.length ?? 32) * 250),
    );
    timer = setTimeout(() => {
      if (token !== generation) return;
      timer = undefined;
      if (!allowed()) {
        stop();
        return;
      }
      advance(true);
    }, delay);
  }
  function say(voice: Voice, playing: boolean) {
    if (!seat || !allowed()) {
      stop();
      return;
    }
    const topic = seat.deck[seat.index],
      at = Date.now(),
      token = generation;
    const line: ListeningLine = {
      ...voice,
      topic,
      at,
      id: `listening-${at}-${++serial}`,
      kind: "listening",
      via: "local",
    };
    const more = seat.read < seat.replies.length || seat.index + 1 < seat.deck.length;
    update({
      activeLine: line,
      scope: seat.scope,
      searching: false,
      continuous: playing && more,
      notice: more ? "" : endNote(seat.scope),
    });
    if (token !== generation) return;
    options.onLine?.(line);
    if (token === generation) schedule();
  }
  function open(
    deck: ListeningTopic[],
    index: number,
    scope: string | undefined,
    playing: boolean,
    bridge: boolean,
  ) {
    leaveSeat();
    seat = { deck, index, scope, replies: remarks(deck[index]), read: 0 };
    say(opening(deck[index], bridge), playing);
  }
  function pick(playing: boolean) {
    if (!allowed()) return;
    interrupt();
    const deck = feed();
    if (deck.length) open(deck, 0, undefined, playing, false);
    else {
      leaveSeat();
      update({
        ...empty,
        scope: undefined,
        activeLine: undefined,
        notice: "没取到可用的知乎热榜。你可以自己出个公共话题，不用等榜单。",
      });
    }
  }
  async function findScope(query: string, playing = false) {
    if (!allowed() || !shortScope(query)) return;
    interrupt();
    leaveSeat();
    const token = generation,
      controller = new AbortController();
    pending = controller;
    update({
      scope: query,
      searching: true,
      continuous: playing,
      activeLine: undefined,
      notice: `正在知乎站内找「${query}」的话题…`,
    });
    try {
      const deck = await searchListeningTopics(query, controller.signal, options.request);
      if (generation !== token) return;
      if (!allowed()) {
        stop();
        return;
      }
      pending = undefined;
      if (deck.length) open(deck, 0, query, state.continuous, past.length > 0);
      else
        update({
          searching: false,
          continuous: false,
          notice: `没找到能对上「${query}」的站内话题。换个范围或自己出题都行。`,
        });
    } catch {
      if (generation !== token) return;
      if (!allowed()) {
        stop();
        return;
      }
      pending = undefined;
      update({
        searching: false,
        continuous: false,
        notice: `暂时没取到「${query}」的站内结果，不用其他新闻充数。`,
      });
    }
  }
  function offer(title: string, origin: "reader" | "rumor") {
    if (!allowed()) return;
    interrupt();
    const rest = seat ? seat.deck.slice(seat.index + 1) : state.scope ? [] : feed();
    const topic: ListeningTopic = { origin, title, excerpt: "" };
    // An existing, exactly matching source is a reading link, never verification of hearsay.
    topic.url = (seat?.deck ?? rest).find((t) => t.title === title)?.url;
    open(distinct([topic, ...rest]), 0, state.scope, false, false);
  }
  function next(playing: boolean) {
    if (!allowed() || !seat) return;
    if (seat.index + 1 < seat.deck.length)
      open(seat.deck, seat.index + 1, seat.scope, playing, true);
    else {
      seat.read = seat.replies.length; // A rejected last card must not start speaking again.
      update({ activeLine: undefined, continuous: false, notice: endNote(seat.scope) });
    }
  }
  function advance(playing: boolean) {
    if (!allowed() || !seat) return;
    const reply = seat.replies[seat.read];
    if (reply) {
      seat.read++;
      say(reply, playing);
    } else next(playing);
  }
  function previousTopic() {
    if (!allowed()) {
      stop();
      return;
    }
    if (!past.length) {
      stop();
      update({ notice: "还没有聊过的上一题。" });
      return;
    }
    interrupt();
    seat = past.pop()!;
    // Return to the unsaid part, or recall the last thought if this topic was finished.
    seat.read = Math.min(seat.read, seat.replies.length - 1);
    const voice = seat.replies[seat.read++];
    say(
      { ...voice, text: `回到「${clip(seat.deck[seat.index].title, 42)}」。${voice.text}` },
      false,
    );
  }
  function listen() {
    if (!allowed() || state.continuous) return;
    if (state.searching) {
      update({ continuous: true });
      return;
    }
    if (!seat) {
      if (state.scope) void findScope(state.scope, true);
      else pick(true);
      return;
    }
    if (state.hasMoreLines || state.upNext) {
      update({ continuous: true });
      schedule();
    }
  }
  function step() {
    if (!allowed() || !seat) {
      stop();
      return;
    }
    interrupt();
    advance(false);
  }
  function nextTopic() {
    if (!allowed()) {
      stop();
      return;
    }
    if (!seat) {
      stop();
      if (state.scope) update({ notice: `先不找「${state.scope}」了，还没有可以接的下一题。` });
      return;
    }
    interrupt();
    next(false);
  }
  function handleText(text: string, beforePublic?: () => void): boolean {
    if (!allowed()) return false;
    const intent = readListeningIntent(text, !!(seat || state.scope || past.length));
    if (!intent) {
      if (text.trim()) cancel();
      return false;
    }
    beforePublic?.();
    switch (intent.kind) {
      case "comments":
      case "opinion": {
        stop();
        const item = seatedTopic(seat);
        if (!item) {
          update({ notice: "手边还没有这道题的材料。" });
          break;
        }
        if (intent.kind === "comments")
          say(
            {
              speaker: "owl",
              text: item.comment
                ? `站内这篇返回的一条评论是：「${item.comment}」这一条不代表其他人。`
                : "这道题没有拿到能对回原帖的评论，我不替网友表态。",
            },
            false,
          );
        else
          say(
            {
              speaker: "shiba",
              text: (item.origin === "rumor" ? "先当作假设。" : "") + angle(item),
            },
            false,
          );
        break;
      }
      case "evidence": {
        stop();
        const item = seatedTopic(seat);
        if (!item) {
          update({ notice: "手边还没有这道题的材料。" });
          break;
        }
        const text =
          item.origin === "rumor"
            ? "这还是你听来的说法，我这里没有核实，不能把它说成事实。"
            : item.excerpt
              ? `我能对上的只有这份摘录：「${clip(item.excerpt, 80)}」它不是独立核实。`
              : "手边只有题目，没有拿到能证实它的材料。";
        say({ speaker: "owl", text }, false);
        break;
      }
      case "hot":
        pick(false);
        break;
      case "reader":
      case "rumor":
        offer(intent.title, intent.kind);
        break;
      case "scope":
        void findScope(intent.query);
        break;
      case "listen":
        listen();
        break;
      case "next":
        nextTopic();
        break;
      case "back":
        previousTopic();
        break;
      case "step":
        step();
        break;
      case "stop":
        stop();
        break;
    }
    return true;
  }
  return {
    getSnapshot: () => state,
    subscribe(notify: () => void) {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    },
    pickHot: () => pick(false),
    findScope: (query: string) => findScope(query),
    handleText,
    step,
    nextTopic,
    previousTopic,
    listen,
    stop,
    cancel,
  };
}
