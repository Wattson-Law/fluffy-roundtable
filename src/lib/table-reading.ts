import { explicitNeed } from "./turn-intent.ts";
import type { Room } from "./companion";
import { MAX_QUOTE, sentenceChoices } from "./bookmarks.ts";

/** The UI preview and both speakers use this exact allowlisted object. Never persist consent. */
export type TableReading = { title: string; excerpt: string };
const chars = (s: string, n: number) => Array.from(s).slice(0, n).join("");
export function parseReading(v: unknown): TableReading | null {
  if (!v || typeof v !== "object") return null;
  const { title, excerpt } = v as Partial<TableReading>;
  if (
    typeof title !== "string" ||
    !title.trim() ||
    [...title].length > 96 ||
    typeof excerpt !== "string" ||
    !excerpt.trim() ||
    [...excerpt].length > MAX_QUOTE
  )
    return null;
  return { title: title.trim(), excerpt: excerpt.trim() };
}
export function readingForRoom(room?: Room): TableReading | null {
  const row = room?.context.at(-1);
  if (!row || !room) return null;
  const m = room.bookmark;
  if (m && (m.sourceId !== row.id || m.url !== row.url || !row.contentText.includes(m.excerpt)))
    return null;
  const paragraph = row.contentText.trimStart().split(/[\r\n]/, 1)[0];
  const sentences = sentenceChoices(paragraph).slice(0, 2);
  const excerpt = m ? m.excerpt : chars(paragraph.slice(0, sentences.at(-1)?.end ?? 0), MAX_QUOTE);
  return parseReading({ title: chars(row.title, 96), excerpt });
}
export const sameReading = (a?: TableReading | null, b?: TableReading | null) =>
  !!a && !!b && a.title === b.title && a.excerpt === b.excerpt;

// A question about the page, not a request for personal advice just because a page is open.
export function asksReadingFact(text: string, atArticle = false): boolean {
  const reference =
    /刚(?:刚|才)?(?:读|看|翻)|[这那上]一?(?:篇|段)|文[中里]|故事[中里]|原文|作者|书里/;
  const recall =
    /谁|哪(?!怕)|几(?:种|张|页|个|次|点|天|年|位|人|场|本|项|件)|多少|什么(?:时候|时间|地点|颜色|名字|用途|工具|建议|办法)|分别|(?:写|讲|说|用|提|做|发生|叫)(?:的?是|了|过)?(?:什么|啥)|提到.{0,8}(?:吗|么)|往[前后]挪/;
  // Read requests in order. “几张便签？算了，我只是想吐槽” and its reverse are different requests.
  let factual = false;
  for (const sentence of text.split(/[。！？!?；;\n]/)) {
    let sourceHere = false;
    for (const part of sentence.split(/[，,]|而是|但是|不过/).filter(Boolean)) {
      const explicit = explicitNeed([part]);
      const personal =
        /算了|先不问|不用回答|你(?:们)?(?:怎么看|觉得|认为|会怎么|最喜欢)|我(?:应该|该|能|可以)(?:怎么|怎样|做什么)|(?:给我|帮我|陪我)(?:想办法|打气|加油|出主意|分析利弊|列计划)|安慰我|鼓励我|我只想(?:吐槽|倾诉|说说)/.test(
          part,
        );
      sourceHere ||= reference.test(part);
      // “作者建议先做什么？” asks for the author's words, not advice from a pet.
      if (sourceHere && recall.test(part) && !personal) {
        factual = true;
      } else if (personal || (explicit && explicit !== "article" && explicit !== "comments")) {
        factual = false;
        sourceHere = false;
      } else if (
        atArticle &&
        recall.test(part) &&
        !/我|你/.test(part) &&
        /[他她它]|[那这](?:位|场|个|本|次|件)|(?:分别|一共|总共|总计)|(?:了|过)几|哪(?:两|几)种/.test(
          part,
        )
      )
        factual = true;
    }
  }
  return factual;
}
