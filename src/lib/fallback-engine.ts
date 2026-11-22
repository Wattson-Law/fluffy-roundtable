/**
 * 规则兜底圆桌引擎（施工蓝图 §5.3「模型异常或超时自动降级，保证 Demo 永不白屏」）
 *
 * 不依赖 LLM，仅用真实 API 返回的文本特征 + VoteUpCount/AuthorityLevel 生成四小只台词。
 * 所有引文一律从原文逐字抽取，与 LLM 路径共用同一套防幻觉校验。
 */
import "server-only";
import { selectComment } from "./companion";
import { computeRadar, detectLeadGen, locateSentence } from "./llm";
import type {
  ControlCard,
  CuratedSource,
  DialogueLine,
  FollowUpQuestion,
  RoundtableMode,
  ZhihuItem,
} from "@/types";

const EVIDENCE_RE = [
  /\d+\s*(k|K|万|元|个月|年|周|天|小时)/,
  /\d+\s*%|百分之\d+/,
  /(数据|统计|报告|调研|论文|白皮书|公开)/,
  /\d{4}\s*年/,
];
const ANXIETY_RE = [
  /(焦虑|崩溃|绝望|熬不住|撑不下去|睡不着|石沉大海)/,
  /(淘汰|被优化|裁员|35岁|中年危机|没机会|太难了)/,
  /(劝退|别来沾边|趁早放弃|没救了)/,
];
const START_RE = [
  /(本人|我是|我的背景|本科|硕士|博士|专业是|科班|非科班|转行前)/,
  /(第\s*\d+\s*个月|花了\s*\d+|用了\s*\d+\s*(个月|周|年))/,
  /(踩(的)?坑|走过的弯路|浪费(了)?时间)/,
];

const CN = ["零", "一", "两", "三", "四", "五"];

/** 对单篇已读帖给出一句「它为什么没在回答你」，并附原文证据 */
function judge(it: ZhihuItem): { verdict: string; span: string | null; reason: string } {
  const txt = `${it.title}。${it.contentText}`;
  const lead = detectLeadGen(txt);
  if (lead.length) {
    return {
      verdict: "它结尾留了钩子，要的是你报名，不是你想清楚。",
      span: locateSentence(txt, LEAD_SENT),
      reason: `检出${lead.join("、")}`,
    };
  }
  const hasEvi = EVIDENCE_RE.some((r) => r.test(txt));
  const anx = ANXIETY_RE.some((r) => r.test(txt));
  if (anx && !hasEvi) {
    return {
      verdict: "它讲的是情绪，那份难受是真的，但它没告诉任何人接下来怎么走。",
      span: locateSentence(txt, ANXIETY_RE),
      reason: "情绪共鸣为主，未给可落地路径",
    };
  }
  if (!hasEvi) {
    return {
      verdict: "我在这段摘录里没找到可以单独核对的数字，暂时把它当成作者的看法。",
      span: locateSentence(txt, [/。/]),
      reason: "缺少可核验的数据支撑",
    };
  }
  if (!START_RE.some((r) => r.test(txt))) {
    return {
      verdict: "它没交代自己的起点，拿它的进度当你的起跑线并不公平。",
      span: locateSentence(txt, EVIDENCE_RE),
      reason: "未披露作者背景与前提条件",
    };
  }
  return {
    verdict: "这篇和你的处境贴得比较近，可以留着细看。",
    span: locateSentence(txt, START_RE),
    reason: "交代了起点与耗时",
  };
}

const LEAD_SENT = [
  /私信/,
  /扣\s*1/,
  /加\s*(我)?\s*(V|vx|微信)/i,
  /公众号/,
  /(训练营|特训班|集训营)/,
  /(领取|领|送).{0,6}(资料|路线图|全套|课程)/,
  /(知识星球|付费咨询)/,
];

/** 规则生成四小只台词 */
export function buildFallbackDialogues(
  trail: ZhihuItem[],
  ext: ZhihuItem[],
  mode: RoundtableMode,
): DialogueLine[] {
  const n = trail.length;
  const lines: DialogueLine[] = [];

  /* 1. 呼噜猫：只接住情绪，零建议 */
  lines.push({
    speaker: "purr_cat",
    mood: "warm",
    text:
      mode === "topic_digest"
        ? `你刚才那${CN[n] ?? n}篇我都跟着看了。有哪一句留在心里，我都愿意听。`
        : `你刚才翻过的那${CN[n] ?? n}篇，我也看到了。一下子有那么多声音，没想清楚也没关系。`,
  });

  /* 2. 猫头鹰：拆解原文，带逐字引用 */
  const judged = trail.map((t) => ({ it: t, j: judge(t) }));
  const worst = judged.find((x) => x.j.span) ?? judged[0];
  if (worst) {
    const idx = trail.indexOf(worst.it);
    const span = worst.j.span;
    const excerpt =
      span && (worst.it.contentText.includes(span) || worst.it.title.includes(span))
        ? span
        : worst.it.contentText.trim().slice(0, 110) || worst.it.title;
    lines.push({
      speaker: "owl",
      mood: "glasses",
      text:
        mode === "topic_digest"
          ? `我把这几篇逐句对了一遍。${worst.j.verdict}先理清谁在讲事实、谁在带情绪，再往下看。`
          : `我逐句核对过了。不是你看不懂，是它们没在回答你的问题。${worst.j.verdict}`,
      quoteRef: excerpt
        ? {
            sourceTag: `READ_${idx}`,
            excerpt,
            reason: worst.j.reason,
            sourceTitle: worst.it.title,
            sourceAuthor: worst.it.author,
            sourceUrl: worst.it.url,
          }
        : undefined,
    });
  }

  /* 2.5 站外客观坐标 */
  const e0 = ext[0];
  if (e0?.contentText) {
    const span = locateSentence(e0.contentText, EVIDENCE_RE) ?? e0.contentText.slice(0, 90);
    lines.push({
      speaker: "owl",
      mood: "glasses",
      text: "再给你一个站外的坐标，省得只在社区情绪里打转。它不负责让你乐观，只负责让你别拿别人的情绪做决定。",
      quoteRef: {
        sourceTag: "EXT_0",
        excerpt: span,
        reason: "站外客观对照",
        sourceTitle: e0.title,
        sourceAuthor: e0.author,
        sourceUrl: e0.url,
      },
    });
  }

  /* 3. 柴犬炸毛护短（插嘴） */
  const leadCount = judged.filter(
    (x) => detectLeadGen(`${x.it.title}${x.it.contentText}`).length,
  ).length;
  const ventCount = judged.filter((x) => x.j.reason.includes("情绪")).length;
  const roast: string[] = [];
  if (leadCount) roast.push("有的绕半天是为了卖课");
  if (ventCount) roast.push("有的光顾着喊难");
  lines.push({
    speaker: "shiba",
    mood: "angry_protect",
    text: roast.length
      ? `好家伙！${roast.join("，")}，怪不得把你看懵了！别拉我，我这就去把真正走过这条路的人刨出来！`
      : "我更想听听真走过这条路的人怎么说。让我看看有没有能跟原帖对照的经历。",
  });

  // A selected comment is a reader's experience, not an author's claim or a new source.
  const comment = selectComment(trail);
  if (comment) {
    const t = trail[comment.index];
    lines[lines.length - 1] = {
      speaker: "shiba",
      mood: "angry_protect",
      text: comment.contrast
        ? "有位读者在评论区提了不同的看法。我把原话翻出来；这是一种声音，不是所有人的结论。"
        : "我在评论区翻到一条补充。把读者的声音也摆上桌，但不把评论当作作者的结论。",
      quoteRef: {
        sourceTag: `READ_${comment.index}`,
        sourceTitle: t.title,
        sourceUrl: t.url,
        excerpt: comment.excerpt,
        reason: "原帖精选评论",
      },
    };
  }
  /* 3.5 呼噜猫按住柴犬，保留圆桌互动感 */
  lines.push({
    speaker: "purr_cat",
    mood: "happy",
    text: "好啦好啦，毛都炸起来了～快把你刚刨出来的东西端上来给人家看看。",
  });

  return lines;
}

/** 柴犬端出的真实好帖：从二次检索候选池挑，严格排除已读 */
export function pickCuratedSources(
  fresh: ZhihuItem[],
  trail: ZhihuItem[],
  topicHint: string,
): CuratedSource[] {
  const readUrls = new Set(trail.map((t) => t.url));
  const readIds = new Set(trail.map((t) => t.id));
  const tokens = topicHint
    .replace(/[，。！？、,.!?·\/]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  return fresh
    .filter((f) => !readUrls.has(f.url) && !readIds.has(f.id) && f.contentText.length > 60)
    .map((f) => {
      const txt = `${f.title}。${f.contentText}`;
      const lead = detectLeadGen(txt).length;
      const evi = EVIDENCE_RE.filter((r) => r.test(txt)).length;
      const start = START_RE.some((r) => r.test(txt));
      const action = /(先|建议|做法是|第一步|跑通|整理|试试)/.test(txt);
      const rel = tokens.filter((t) => txt.includes(t)).length;
      const score =
        (lead ? -40 : 0) +
        evi * 6 +
        (start ? 10 : 0) +
        (action ? 6 : 0) +
        rel * 2 +
        f.authoritylevel * 3 +
        Math.min(8, Math.log10(Math.max(1, f.voteUpCount)) * 3);
      const why = [
        start ? "交代了自己的起点、耗时和踩过的坑" : "",
        evi >= 2 ? "给的是可核验的数字，不是感想" : "",
        f.comments.length ? "评论区有真实反馈可对照" : "",
        !start && !evi && action ? "直接讲了怎么做" : "",
      ]
        .filter(Boolean)
        .join("；");
      const excerpt =
        locateSentence(f.contentText, START_RE) ??
        locateSentence(f.contentText, EVIDENCE_RE) ??
        f.contentText.slice(0, 120);
      return { f, score, why: why || "和你的处境更贴近", excerpt };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ f, why, excerpt }) => ({
      title: f.title,
      author: f.author,
      url: f.url,
      voteUpCount: f.voteUpCount,
      authoritylevel: f.authoritylevel,
      excerpt,
      why,
    }));
}

export function buildShibaDeliver(sources: CuratedSource[], searchWord: string): DialogueLine {
  return {
    speaker: "shiba",
    mood: "happy",
    text: sources.length
      ? `我换成「${searchWord}」重新搜了一遍，刨出这${CN[sources.length] ?? sources.length}篇，每篇我都标了凭什么不一样，点进去能直接看原帖！`
      : `我换关键词翻了一圈，暂时没找到够格的同路人帖子，不给你硬凑。这轮先留空。`,
  };
}

export function buildKanshanClose(count: number, mode: RoundtableMode): DialogueLine {
  const n = CN[count] ?? String(count);
  const base =
    count > 0 ? `上面这${n}篇大概率更贴近你今晚的处境，读完十来分钟。` : `今晚的线索先理到这儿。`;
  const tail =
    mode === "decision_debate"
      ? "不用急着今晚就定终身，先把下面这张卡拿走。"
      : "不用急，看完随时回来找我们，我们一直都在这里。";
  return { speaker: "kanshan", mood: "calm", text: `${base}${tail}` };
}

/** 决策类追问（§3.2 模式 2） */
export function buildFollowUp(mode: RoundtableMode): FollowUpQuestion | undefined {
  if (mode !== "decision_debate") return undefined;
  return {
    prompt: "在往下聊之前，先帮我确认一件事：你现在更看重哪一边？",
    choices: [
      { id: "short_term", label: "一年内的现金流与确定性" },
      { id: "long_term", label: "三年后的复利与成长空间" },
    ],
  };
}

const THEME_BY_TOPIC: { re: RegExp; theme: ControlCard["catBadgeTheme"]; name: string }[] = [
  { re: /(AI|大模型|算法|编程|代码|芯片|技术)/i, theme: "cyber_gpu", name: "头顶显卡的赛博布偶猫" },
  {
    re: /(工作|职业|转行|跳槽|考编|offer|薪资|秋招)/i,
    theme: "compass_orange",
    name: "背着指南针的橘猫侦探",
  },
  { re: /(恋爱|感情|分手|婚姻|家人|关系)/, theme: "cocoa_ragdoll", name: "围着毛围巾的可可布偶" },
];

export function buildControlCard(
  trail: ZhihuItem[],
  sources: CuratedSource[],
  mode: RoundtableMode,
  topicHint: string,
): ControlCard {
  const blob = `${topicHint} ${trail.map((t) => t.title).join(" ")}`;
  const m = THEME_BY_TOPIC.find((t) => t.re.test(blob));
  const theme = m?.theme ?? "goggles_calico";
  const name = m?.name ?? "戴着吃瓜护目镜的三花猫";

  const takeaway =
    mode === "anti_anxiety"
      ? "你刚才的乱，来自这几篇本来就没在回答你的问题——不是你的理解力出了问题。"
      : mode === "decision_debate"
        ? "两边高赞各站一边，是因为他们的前提条件和你不同；先锁定你自己的约束，再选。"
        : "这件事的争议主要在立场不同，而不是事实冲突；先把时间线理顺就清楚大半。";

  const action = sources.length
    ? `今晚只做一件事：挑上面第 1 篇读完，只记下作者交代的「起点和耗时」，不要记结论。`
    : `今晚只做一件事：把你的处境写成一句具体的话，明天拿这句话去搜，而不是搜那个大而空的词。`;

  return {
    oneLineTakeaway: takeaway,
    microAction: action,
    catBadgeTheme: theme,
    catBadgeName: name,
  };
}

export { computeRadar };
