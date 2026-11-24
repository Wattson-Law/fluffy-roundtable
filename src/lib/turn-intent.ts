import type { Speaker } from "@/types";

// Reopening this table restores the exchange; its cues are never used as a reader profile.
export type Need =
  | "article"
  | "comments"
  | "weigh"
  | "fear"
  | "obstacle"
  | "encourage"
  | "act"
  | "rehearse"
  | "listen"
  | "quiet"
  | "summary"
  | "ack";
type Barrier = "asking" | "ride" | "budget" | "time" | "other";
export type TurnContext = {
  need: Need;
  willing?: "yes" | "no" | "undecided";
  barrier?: Barrier;
  askedWhy?: boolean;
};
export type ReadingOfTurn = {
  next: TurnContext;
  named?: Speaker;
  term?: string;
  uncertain: boolean;
};
const vocative =
  /(?:^|[，,。！!？?、：:；;\s]|我想听|可以请|让|请|想让)(?:一下)?(呼噜猫|猫猫|考据猫头鹰|猫头鹰|护短柴犬|柴犬|狗狗|刘看山|看山)(?=$|[，,。：:！!？?、\s]|来|你|能|可以|陪|帮|先|说|讲|给|听)/;
const voices: Record<string, Speaker> = {
  猫猫: "purr_cat",
  呼噜猫: "purr_cat",
  猫头鹰: "owl",
  考据猫头鹰: "owl",
  柴犬: "shiba",
  护短柴犬: "shiba",
  狗狗: "shiba",
  看山: "kanshan",
  刘看山: "kanshan",
};
const stop =
  /不想聊|不聊了|先不聊|到这[里儿]?吧|到这里就好|想静静|想自己待|晚安|先睡了|不用继续|想安静/;
const unsure = /不知道|不太清楚|说不[清上]|我也不清楚|讲不清|没想明白/;
const fear =
  /[害有点很挺]怕|我怕|就是怕|^怕|担心|心里[没打]|心里.{0,3}打鼓|紧张|不敢|发怵|犯怵|没底/;
const yes =
  /(?:我(?:还是|其实|真的|已经|挺|很|也|就是)?|决定|是)想(?:去|做|试|学|报名|应聘|参加|换)|我愿意|决定(?:去|试|参加)|不是不想去/;
const no = /(?:不想|不愿意|决定不)(?:去|做|试|学|报名|参加)|不去了/;
const undecided = /还没(?:想好|选好|决定)|拿不定|犹豫|不知道要不要/;
const switchTopic = /换(?:个|件|一个|一件)?(?:话题|事)|说点别的|另外一件事|不说这个了|说回文章/;
const correction = /(?:^|[，,。；;])\s*(?:不是|不对|我不怕|别猜)/;
const cues: [Need, RegExp][] = [
  [
    "listen",
    /听我(?:说|讲|吐槽)|只想被听见|只(?:是)?想(?:说说|聊聊|吐槽|有人听)|陪我坐|不用给建议|别给建议|不想要建议|别问了/,
  ],
  [
    "encourage",
    /打(?:打|个|点)?气|加(?:个|加|点)?油|加把劲|鼓(?:鼓|个|把)?劲|夸我(?:两句|一句|一下)|鼓励|给我(?:一点|点)?勇气|支持我|安慰|抱抱|给我个拥抱/,
  ],
  [
    "act",
    /先做(?:点)?什么|从哪[里儿]?(?:开始|下手)|第一步|下一步|小行动|怎么办|怎么(?:开口|办到|做|安排)|给(?:我|个|点)?.{0,3}(?:办法|建议)|想(?:个|想)?办法|帮我(?:想|排).{0,3}(?:办法|计划)/,
  ],
  ["rehearse", /陪我练|练(?:一练|一下|一句)|演练/],
  ["weigh", /分析|利弊|权衡|帮我(?:比较|理一理|捋)/],
  ["summary", /收[个一下]*尾|总结|掌控卡|理一下刚才/],
  ["comments", /评论|反方|其他人的?(?:声音|经验)|避坑|同路人/],
  [
    "article",
    /原文|证据|出处|引用|来源|核查|作者.{0,6}(?:说|指)|指(?:的是|什么)|什么意思|怎么理解|怎么解释|这句话/,
  ],
];
const negated =
  /(?:别(?:再|光|只)?|不(?:必|想|要|用|需要|是)(?:再|光|只)?|停止)(?:你们?|帮我|给我|替我|告诉我|跟我|我该|该|听|看|讲|说|只|继续|再|一味|急着|一直|做|分析|什么|让我)*(?:一点|点|个)?$/;
function explicitNeed(parts: string[]): Need | undefined {
  let chosen: Need | undefined;
  for (const piece of parts) {
    let at = -1,
      hit: Need | undefined;
    for (const [need, pattern] of cues) {
      for (const m of piece.matchAll(new RegExp(pattern, "g"))) {
        if (m.index! < at || (need !== "listen" && negated.test(piece.slice(0, m.index)))) continue;
        at = m.index!;
        hit = need;
      }
    }
    if (hit) chosen = hit;
  }
  return chosen;
}
function barrierIn(parts: string[]): Barrier | undefined {
  let barrier: Barrier | undefined;
  for (const p of parts) {
    // Don't preserve the example that the reader has just explicitly denied.
    if (/^(?:不是(?:怕|担心|因为)?|不怕|我不怕|我不担心)/.test(p)) continue;
    if (/末班|没[有]?车|赶不[上到].{0,5}车|怎么回家|回家.{0,4}(?:车|交通)/.test(p))
      barrier = "ride";
    else if (
      /(?:不敢|不好意思|怕|想).{0,3}(?:再问|问第二|问两遍|开口问)|没听(?:懂|清).{0,5}(?:教|说)/.test(
        p,
      )
    )
      barrier = "asking";
    else if (/学费|负担不起|钱不够|付不起|预算不够/.test(p)) barrier = "budget";
    else if (/抽不出时间|时间不够|排不开|赶不上时间/.test(p)) barrier = "time";
    else if (/(?:我怕|害怕|担心|不敢)(?!呀|吧|啊|去[了呢吧]?$).{2,}/.test(p) && !unsure.test(p))
      barrier = "other";
  }
  return barrier;
}
export function readTurn(text: string, previous?: TurnContext): ReadingOfTurn {
  const parts = text
    .split(/[，,。.!！?？;；\n]|而是|但是|不过|其实是/)
    .map((p) => p.trim())
    .filter(Boolean);
  // A reported feeling belongs to its speaker, not to the reader. Explicit requests in other
  // clauses can still select a response, but do not carry the reader's previous obstacle over.
  const aboutSomeoneElse =
    /(?:朋友|同事|室友|家人|他|她)(?:说[他她]?|最近|有点|很|也|在|有些)*(?:怕|担心|紧张|焦虑)|替[他她]问|不是我[，,。 ]*是/.test(
      text,
    );
  const newProject =
    /我(?:最近|又|还|现在)?想(?:学|报名|参加|应聘|换)(?!不)[^，,。！？?；;]{2,}/.test(text);
  const fresh =
    switchTopic.test(text) || aboutSomeoneElse || newProject || previous?.need === "quiet";
  const prior = fresh ? undefined : previous;
  let willing = prior?.willing;
  for (const p of parts) {
    if (p.includes("不是不想")) willing = "yes";
    else if (no.test(p)) willing = "no";
    else if (yes.test(p)) willing = "yes";
    else if (undecided.test(p)) willing = "undecided";
  }
  const term = text.match(/[‘“「『《]([^’”」』》]{1,60})[’”」』》]/)?.[1];
  const named = voices[text.match(vocative)?.[1] ?? ""];
  let need = explicitNeed(parts);
  if (stop.test(parts.at(-1) ?? "")) need = "quiet";
  const uncertain = unsure.test(text) && !undecided.test(text);
  const corrected = correction.test(text);
  const specified = aboutSomeoneElse ? undefined : barrierIn(parts);
  let barrier = specified ?? (corrected ? undefined : prior?.barrier);
  let askedWhy = !corrected && !!prior?.askedWhy;
  if (!need) {
    const accept =
      /^(?:嗯嗯|嗯|好啊|好呀|好的|行啊|可以|好|行|那就试试|试试)[啊呀吧了\s，,。！!]*(?:试试|来吧|试一下)?[。！!]?$/u.test(
        text,
      );
    if (stop.test(text)) need = "quiet";
    else if (aboutSomeoneElse) need = "ack";
    else if (accept && prior?.need === "obstacle" && prior.barrier === "asking") need = "rehearse";
    else if (
      accept &&
      prior?.barrier &&
      ["ride", "budget", "time"].includes(prior.barrier) &&
      (prior.need === "encourage" || prior.need === "obstacle")
    )
      need = "act";
    else if (uncertain) need = "listen";
    else if (specified || (barrier && fear.test(text))) need = "obstacle";
    else if (fear.test(text) && !/不(?:再)?(?:害怕|怕|担心|紧张)/.test(text))
      need = askedWhy ? "listen" : "fear";
    else if (/只想|累|拿不定|纠结|犹豫|不想去|吐槽|难过|心烦/.test(text)) need = "listen";
    else need = "ack";
  }
  if (need === "article" || need === "comments" || need === "quiet" || aboutSomeoneElse) {
    barrier = undefined;
    willing = undefined;
    askedWhy = false;
  }
  return {
    next: { need, willing, barrier, askedWhy: need === "fear" || askedWhy },
    named,
    term,
    uncertain,
  };
}
