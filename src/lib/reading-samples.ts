import type { ReadingTrailItem, RoundtableResult, ZhihuItem } from "@/types";

/** Original, explicitly local reading material. No votes, scraped comments or external claims. */
const sheets = [
  {
    slug: "weekend-notebook",
    title: "一页笔记，什么时候才算读完？",
    paragraphs: [
      "周六收拾桌子，我从书里抖出来三张便签。第一张抄了一整段话，第二张画了满页箭头。最后那张只有铅笔写的一行字：下次翻到这一页，我想记起哪一件事？",
      "有一张纸留下了作者说过的话，另一张留下了我读到这里时的问题。我原以为笔记越多，读得越深。可是当我把书合上，能让我重新找到这一页的，反倒是那个没有写完的问题。",
      "后来我在窗沿放了一只浅碟，专门放没有写完的便签。它不是待办清单：有的纸会在第二天被翻回来，有的过了一个月还是空着。哪一张值得继续，不需要在读完那天决定。",
    ],
    quote: "最后那张只有铅笔写的一行字：下次翻到这一页，我想记起哪一件事？",
    takeaway: "笔记也可以留下一个问题，不一定要把原文抄完。",
    action: "在纸角写下一个下次想翻回来的问题。",
  },
  {
    slug: "two-bookmarks",
    title: "两张书签，留下两种读法",
    paragraphs: [
      "同一本散文集里，我夹了两张颜色不同的书签。绿的那张夹在我同意的地方，蓝的那张夹在我想再想想的地方。这样，下次翻书就不会只碰到自己已经相信的话。",
      "绿书签那页让我记住了一个具体画面：雨停后，窗台上的水先从一角退去。蓝书签的那页却没有画面，只有一个很大的结论。我在页边写的是：作者从哪件小事走到了这里？",
      "吃完晚饭回来，我把蓝书签往前挪了两页。原来我漏读了一段背景。书签挪了位置，我的看法也跟着挪了一点。两张纸都没给出标准答案，但它们让我知道自己下一次想看哪里。",
    ],
    quote: "我在页边写的是：作者从哪件小事走到了这里？",
    takeaway: "保留不同意的那一页，也是在认真阅读。",
    action: "给一句想核对的话夹张书签，往前找一段背景。",
  },
];
export const sampleItems: ZhihuItem[] = sheets.map((s) => ({
  origin: "sample",
  id: s.slug,
  url: `/?sample=${s.slug}`,
  title: s.title,
  contentText: s.paragraphs.join("\n\n"),
  author: "伴读编辑室",
  authoritylevel: 0,
  voteUpCount: 0,
  commentCount: 0,
  comments: [],
}));
export function sampleRound(context: ReadingTrailItem[]): RoundtableResult {
  const target = context.at(-1)!,
    i = sheets.findIndex((s) => s.slug === target.id);
  if (i < 0 || context.some((t) => t.origin !== "sample")) throw Error("Unknown sample");
  const s = sheets[i],
    other = sampleItems[1 - i];
  return {
    mode: "topic_digest",
    topicTitle: s.title,
    radar: {
      drynessScore: 0,
      anxietyScore: 0,
      adRiskScore: 0,
      summaryTag: "本地编辑试读 · 无网络检索",
    },
    dialogues: [
      {
        speaker: "purr_cat",
        mood: "warm",
        text: "这页我也翻到了。就算只有一句话留在心里，也值得讲给我听。",
      },
      {
        speaker: "owl",
        mood: "glasses",
        text: "我把原文夹在这里。这是作者自己的读书经历，不是给所有人的规定。",
        quoteRef: {
          sourceTag: `READ_${context.length - 1}`,
          excerpt: s.quote,
          sourceTitle: s.title,
          sourceAuthor: target.author,
          sourceUrl: target.url,
          reason: "试读原文 · 逐字摘录",
        },
      },
      {
        speaker: "shiba",
        mood: "happy",
        text: "这本试读册没有评论区，我就不替别人编感受了。同册还有另一种读法，我把那一页留在下面。",
      },
      {
        speaker: "kanshan",
        mood: "calm",
        text: `${s.takeaway} 我把这件小事写成一张卡，收不收由你。`,
      },
    ],
    curatedSources: [
      {
        title: other.title,
        author: other.author,
        url: other.url,
        voteUpCount: 0,
        authoritylevel: 0,
        excerpt: other.contentText.slice(0, 60),
        why: "同册另一篇试读 · 不是线上检索结果",
      },
    ],
    controlCard: {
      oneLineTakeaway: s.takeaway,
      microAction: s.action,
      catBadgeTheme: "compass_orange",
      catBadgeName: "夹着书签的橘猫",
    },
    meta: {
      llmUsed: false,
      degraded: false,
      trailCount: context.length,
      note: "本地试读，不调用知乎或模型",
    },
  };
}
