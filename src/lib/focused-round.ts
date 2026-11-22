import type { DialogueLine, RoundtableResult, ZhihuItem } from "@/types";
import { selectComment } from "./companion";

type Row = Pick<ZhihuItem, "title" | "url" | "author" | "comments" | "origin">;
/** A sentence round has one reading source. The model cannot substitute an attractive but different quote. */
export function focusRound(r: RoundtableResult, source: Row, excerpt: string): RoundtableResult {
  const quoted = {
    sourceTag: "READ_0",
    sourceTitle: source.title,
    sourceUrl: source.url,
    sourceAuthor: source.author,
  };
  const owl: DialogueLine = {
    speaker: "owl",
    mood: "glasses",
    text: "我们就从你夹的这句读起。前后两句也留着，点开就能核对它原来在说什么。",
    quoteRef: {
      ...quoted,
      kind: "bookmark",
      excerpt,
      reason: source.origin ? "试读正文 · 你的书签" : "作者正文 · 你的书签",
    },
  };
  const comment = selectComment([source]);
  const dog: DialogueLine =
    source.origin === "sample"
      ? r.dialogues.find((d) => d.speaker === "shiba")!
      : comment
        ? {
            speaker: "shiba",
            mood: "happy",
            text: comment.contrast
              ? "这位读者有不同的经验。我把评论原话放在这里，它不是作者的结论。"
              : "我找到一条读者补充。它来自原帖评论区，不一定是在反驳作者。",
            quoteRef: {
              sourceTag: "READ_0",
              sourceTitle: source.title,
              sourceUrl: source.url,
              excerpt: comment.excerpt,
              reason: "原帖精选评论 · 读者留言",
            },
          }
        : {
            speaker: "shiba",
            mood: "calm",
            text: "这篇原帖没有返回可核对的精选评论。我不替读者编一种意见。",
          };
  const card = r.meta.llmUsed
    ? r.controlCard
    : {
        ...r.controlCard,
        oneLineTakeaway: "把夹下来的原话和自己的理解分开记。",
        microAction: "在这句话旁边写下一个具体的例子，或者一个还想问的问题。",
      };
  const host: DialogueLine = {
    speaker: "kanshan",
    mood: "calm",
    text: "这句话和原帖我替你夹在卡片里了。这一页要不要收进手账，由你拍板。",
  };
  const extra = r.dialogues.find(
    (d) => d.speaker === "owl" && d.quoteRef?.sourceTag.startsWith("EXT_"),
  );
  const cat = r.dialogues.find((d) => d.speaker === "purr_cat")!;
  return { ...r, controlCard: card, dialogues: [cat, owl, ...(extra ? [extra] : []), dog, host] };
}
