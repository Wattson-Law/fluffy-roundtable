import type { Speaker, QuoteRef } from "@/types";
import type { Room } from "./companion";
import type { ReadingOfTurn, TurnContext } from "./turn-intent";
import { selectComment } from "./reading-evidence.ts";

type Reply = { speaker: Speaker; text: string; quoteRef?: QuoteRef };
const byNeed: Record<TurnContext["need"], Speaker> = {
  article: "owl",
  comments: "shiba",
  weigh: "owl",
  fear: "purr_cat",
  obstacle: "shiba",
  encourage: "shiba",
  act: "kanshan",
  rehearse: "shiba",
  listen: "purr_cat",
  quiet: "purr_cat",
  summary: "kanshan",
  ack: "purr_cat",
};
function evidence(room: Room, term?: string): Omit<Reply, "speaker"> {
  const row = room.context.at(-1),
    mark = room.bookmark;
  if (!row)
    return {
      text: "这桌没带文章，我手上没有原句。你可以把在意的那句话带进来。",
    };
  const body = row.contentText;
  if (term && !body.includes(term))
    return {
      text: `这篇带进来的文字里没找到「${term}」。我先不拿别篇替作者解释。`,
    };
  const q = room.result?.dialogues.find(
    (l) =>
      l.speaker === "owl" &&
      l.quoteRef?.sourceUrl === row.url &&
      l.quoteRef.sourceTag.startsWith("READ_") &&
      l.quoteRef.excerpt &&
      body.includes(l.quoteRef.excerpt) &&
      (!term || l.quoteRef.excerpt.includes(term)),
  )?.quoteRef;
  // Prioritize the reader's clip; do not silently swap in an external or a neighboring article.
  const pinned =
    mark?.url === row.url && body.includes(mark.excerpt) && (!term || mark.excerpt.includes(term));
  const at = term ? body.indexOf(term) : 0;
  const start = Math.max(body.slice(0, at).search(/[^。！？\n]*$/), at - 45, 0);
  const end = body.slice(at + (term?.length ?? 0)).search(/[。！？\n]/);
  const excerpt =
    pinned && mark
      ? mark.excerpt
      : q?.excerpt ||
        body
          .slice(
            start,
            Math.min(start + 150, end < 0 ? body.length : at + (term?.length ?? 0) + end + 1),
          )
          .trim();
  if (!excerpt) return { text: "还没有能核对的正文。我先不猜作者是什么意思。" };
  const definition =
    term &&
    /^(?:[」』”’》\s，,]*)(?:指的是|指的就是|是指|意思是|就是指)/.test(
      excerpt.slice(excerpt.indexOf(term) + term.length),
    );
  return {
    text: term
      ? definition
        ? `作者在这句里直接解释了「${term}」。我们先按这篇的意思读，不把它当成通用定义。`
        : `能核对的是下面这句。光凭这段，还分不清作者给「${term}」划了什么界线。`
      : "先看这篇的原话。它说了什么，和我们从中想到什么，是两件事。",
    quoteRef: {
      sourceTag: `READ_${room.context.length - 1}`,
      sourceUrl: row.url,
      sourceTitle: row.title,
      sourceAuthor: row.author,
      excerpt,
      ...(pinned ? { kind: "bookmark" as const } : {}),
      reason: `${row.origin ? "试读正文" : "作者正文"} · ${pinned ? "你的书签" : "本篇摘录"}`,
    },
  };
}
function comments(room: Room): Omit<Reply, "speaker"> {
  const row = room.context.at(-1);
  if (row?.origin === "sample")
    return {
      text: "这是编辑室试读，没有评论区。没听到读者怎么说，我就不替他们编一句。",
    };
  const c = row && selectComment([row]);
  if (!row || !c)
    return {
      text: "手边没有这篇可核对的读者评论。不能因为没有看到，就说大家都同意。",
    };
  return {
    text: c.contrast
      ? "有位读者提了不同的经验。我把原话夹在下面，它不代表所有人。"
      : "这是读者补充的一句，不是原作者的结论。",
    quoteRef: {
      sourceTag: `READ_${room.context.length - 1}`,
      sourceUrl: row.url,
      sourceTitle: row.title,
      excerpt: c.excerpt,
      reason: "原帖精选评论 · 读者留言",
    },
  };
}
const cheers: Record<Speaker, string> = {
  purr_cat: "我在你这边。窗边的椅子给你留着，想有人陪的时候就来坐。",
  owl: "一次选择不能定义你。我支持你按自己的心意来，不用先证明一定会成功。",
  shiba: "我相信你。照自己的步子来，我陪着你。",
  kanshan: "这回听你的。我支持你做自己的选择，今天不用再给谁一个理由。",
};
const offers = {
  ride: "晚了怎么回家是件实在的事。你愿意的话，咱们可以单独想个办法。",
  asking: "听漏了还要再问一次，确实不容易开口。要不要我陪你练一句？",
  budget: "钱不够和想不想做，是两件事。要不要一起看最先要付的那笔？",
  time: "排不出时间不是没心思。要不要一起看看，哪段时间最不好挪？",
  other: "你已经说到了最难的地方，不用再从头解释。我们可以在这里多坐一会儿。",
};
const steps = {
  ride: "先挑一个要晚下班的日子，把那天的下班时间和末班车时间放在一起看。先只弄清这一天。",
  asking: "先把没听明白的那一步说出来就好，比如：「刚才那一步，能再讲一遍吗？」",
  budget: "先记下开始时必须付的那一笔。不必今天就算完所有开销。",
  time: "先在明天的安排里圈出一段你能自己做主的时间，哪怕只有十分钟。",
  other: "先挑一个你愿意试、随时能停的小动作。今天做到这一步就够了。",
};
export function replyToTurn(room: Room, text: string, turn: ReadingOfTurn): Reply {
  const { need, willing, barrier } = turn.next,
    speaker = turn.named ?? byNeed[need];
  const line = (text: string): Reply => ({ speaker, text });
  switch (need) {
    case "article":
      return { speaker, ...evidence(room, turn.term) };
    case "comments":
      return { speaker, ...comments(room) };
    case "weigh":
      return line(
        willing === "yes"
          ? "想做这件事是清楚的。咱们只看你还拿不准的那一处：你最想先弄清什么？"
          : "先分开看：什么在吸引你，什么会让你付出代价？咱们从最在意的一头说起。",
      );
    case "fear":
      return line(
        willing === "yes"
          ? "嗯，你是想试试的。想到真要迈出那一步，哪件事最让你心里打鼓？"
          : "嗯，听起来有点让人发怵。哪一刻最让你紧张？",
      );
    case "obstacle":
      return line(offers[barrier ?? "other"]);
    case "encourage": {
      const optional =
        barrier === "ride"
          ? "晚上怎么回家，要是你想，咱们可以单独想办法。"
          : barrier === "budget"
            ? "开销的事，等你想谈时我再陪你看。"
            : barrier === "time"
              ? "时间怎么挪，等你想谈时咱们再看。"
              : "";
      return line(cheers[speaker] + optional);
    }
    case "act":
      return line(steps[barrier ?? "other"]);
    case "rehearse":
      return line(
        barrier === "asking"
          ? "我来当听的人。你可以试一句：「刚才那一步我没听清，能再说一遍吗？」"
          : "好，我来听。你可以先试着把最想说的那一句说出来。",
      );
    case "listen":
      return line(
        turn.uncertain
          ? "说不上来也没关系。可以就这么坐会儿，不用急着找原因。"
          : /累|疲惫|没力气/.test(text)
            ? "听起来已经花了你好多力气。在这儿，不用再把话说得很周全。"
            : /选择|纠结|拿不定|犹豫/.test(text)
              ? "嗯，两边都有让你放不下的地方。我在听，不催你选。"
              : "好，你说，我听着。不用把它讲成一道等着解的题。",
      );
    case "quiet":
      return line(
        /晚安|睡/.test(text) ? "晚安。今天就聊到这儿。" : "好，先歇会儿。今天这句不用回。",
      );
    case "summary": {
      if (barrier === "ride")
        return line("你在意的是晚了还能不能回家。这一点还没弄清，我们就先记到这里。");
      if (barrier === "asking")
        return line("卡住你的，是没听清时怎么再问一遍。咱们先停在这儿，什么时候想试都可以。");
      if (willing === "yes") return line("想试一试，是你自己说清楚的。余下的，不用今天都定下来。");
      return line(
        room.result?.controlCard && !room.conversation
          ? room.result.controlCard.oneLineTakeaway
          : "我们可以先停在你刚才说到的地方。不必为了收尾，替你补一个结论。",
      );
    }
    case "ack":
      return line(/谢谢|嗯|好/.test(text) ? "嗯，我在。" : "我听着呢。你想从哪儿说起都行。");
  }
}
