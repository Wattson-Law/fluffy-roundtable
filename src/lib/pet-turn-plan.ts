import type { Speaker } from "@/types";
import type { PetPacket } from "./pet-dialogue.ts";
import { asksReadingFact } from "./table-reading.ts";
import { correctedConcern, readTurn, type Need, type TurnContext } from "./turn-intent.ts";

export type Floor = "reader" | "support" | "discuss";
const supportNeeds: ReadonlySet<Need> = new Set(["listen", "encourage", "fear", "obstacle"]);
const lead: Partial<Record<Need, Speaker>> = {
  listen: "purr_cat",
  fear: "purr_cat",
  encourage: "shiba",
  rehearse: "shiba",
  act: "shiba",
  weigh: "owl",
  summary: "kanshan",
};
export const asksBack = (s: string) => /[？?]|(?:吗|么|要不要|愿不愿意)[呀啊呢。！!\s]*$/.test(s);

/** Same short, consented packet on the client and server. The previous pet never sets the reader’s intention. */
export function planPetTurn(p: PetPacket) {
  let context: TurnContext | undefined,
    named: Speaker | undefined,
    text = "";
  for (const turn of p.turns)
    if (turn.speaker === "user") {
      text = turn.text;
      const latest = readTurn(text, context);
      context = latest.next;
      named = latest.named;
    }
  const fact = asksReadingFact(text, !!p.reading);
  const need: Need = fact ? "article" : (context?.need ?? "ack");
  const last = p.turns.at(-1)!;
  const waiting = last.speaker !== "user" && asksBack(last.text);
  const floor: Floor =
    fact ||
    need === "quiet" ||
    need === "summary" ||
    (waiting && (need === "fear" || need === "obstacle"))
      ? "reader"
      : supportNeeds.has(need)
        ? "support"
        : "discuss";
  return {
    fact,
    need,
    floor,
    assigned: p.mode === "reader" ? (named ?? (fact ? "owl" : lead[need])) : undefined,
    excluded: p.mode === "handoff" ? last.speaker : undefined,
  };
}
export type PetTurnPlan = ReturnType<typeof planPetTurn>;

// Merely mentioning a page (or having pinned it earlier) is not asking to use it for support.
function asksToUsePassage(text: string): boolean {
  let use = false;
  const cue =
    /(?:引用|借用|用|借|照着|根据|结合|围绕)(?:一下|刚才的|桌上的)?(?:[这那](?:段|篇|句)(?:话|文字|原文|原句)?|原文|原句|选段)/g;
  // Require a request to the pet, not “我昨天用这段原文做了张卡”. If it is ambiguous, omit it.
  const request =
    /^(?:(?:猫猫|呼噜猫|猫头鹰|柴犬|狗狗|看山|刘看山)\s*)?(?:我想请|我想让|希望|麻烦|可不可以|可以|能不能|能否|能|请|你们|你|帮我|试着|还是|就|再|先|也|直接|\s)*$/;
  for (const clause of text.split(/[，,。！？!?；;\n]|但是|不过|而是/)) {
    const part = clause.trim();
    if (/算了|只想(?:吐槽|有人听|被听见)|先不看|不用原文/.test(part)) use = false;
    for (const m of part.matchAll(cue)) {
      const before = part.slice(0, m.index);
      if (/(?:别|不用|不要|不必|不想|不需要|不)(?:再|去|特意)?$/.test(before)) use = false;
      else if (request.test(before)) use = true;
    }
  }
  return use;
}

/** Minimise this particular model call, not the reader's local transcript or their grant. */
export function materialForTurn(p: PetPacket, plan = planPetTurn(p)): PetPacket {
  // After the reader corrects a guess, do not supply the old pet's question as fresh context.
  const stale = new Set<number>();
  p.turns.forEach((t, i) => {
    if (t.speaker === "user" && correctedConcern(t.text)) {
      for (let j = i - 1; j >= 0 && p.turns[j].speaker !== "user"; j--) stale.add(j);
    }
  });
  if (stale.size) p = { ...p, turns: p.turns.filter((_, i) => !stale.has(i)) };
  if (!supportNeeds.has(plan.need)) return p;
  const current = p.turns.length - (p.mode === "handoff" ? 2 : 1);
  if (asksToUsePassage(p.turns[current].text)) return p;
  // Remove the entire earlier article exchange: its answer can itself contain the verbatim source.
  // Keep ordinary conversation and the actual first pet of this handoff unchanged.
  let omitGroup = false;
  const turns = p.turns.filter((t, i) => {
    if (i >= current) return true;
    if (t.speaker === "user") {
      const need = readTurn(t.text).next.need;
      omitGroup =
        asksReadingFact(t.text, !!p.reading) ||
        need === "article" ||
        need === "comments" ||
        asksToUsePassage(t.text);
    }
    return !omitGroup;
  });
  return { mode: p.mode, turns };
}

// A backstop for obvious assignments during support, not a general semantic judge.
export function prescribesTask(text: string): boolean {
  return /(?:建议你|你不妨|不如先|你可以先|你应该先|你得先|试着先|要不先)(?:去|做|找|写|列|练|查|试|读|看|把|从|定|挑|问|整理|准备|规划)|(?:第一步[，,：:是]|给你(?:列|定)(?:个|一个)?计划)/.test(
    text,
  );
}
const words = (s: string) => s.replace(/[\p{P}\p{Z}\s]/gu, "");
export function addsToTable(text: string, previous: string, floor: Floor): boolean {
  const line = words(text);
  if (!line || line === words(previous)) return false;
  return floor !== "support" || (!asksBack(text) && !prescribesTask(text));
}
