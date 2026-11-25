import { isPet, type PetPacket, type PetReply } from "./pet-dialogue.ts";
import { sentenceChoices } from "./bookmarks.ts";
import { petMessages } from "./pet-personas.ts";
import { planPetTurn, addsToTable, prescribesTask } from "./pet-turn-plan.ts";

// The individual test credential must never follow an article-provider URL, a client URL or a redirect.
export const PET_ENDPOINT = "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";
export async function requestPetReply(
  p: PetPacket,
  config: { key: string; model: string },
  signal: AbortSignal,
  send: typeof fetch = fetch,
): Promise<PetReply | null> {
  const plan = planPetTurn(p);
  const { fact, assigned, excluded, floor } = plan;
  if (p.mode === "handoff" && floor === "reader") return null;
  if (fact && !p.reading) throw new Error("no_reading");
  const timeout = AbortSignal.timeout(22_000);
  try {
    const r = await send(PET_ENDPOINT + "/chat/completions", {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.any([signal, timeout]),
      headers: {
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: petMessages(p, plan),
        response_format: { type: "json_object" },
        enable_thinking: false,
        max_tokens: 400,
      }),
    });
    if (!r.ok)
      throw new Error(
        r.status === 401 || r.status === 403
          ? "access"
          : r.status === 429 || r.status === 402
            ? "limited"
            : "upstream",
      );
    const payload = await r.json().catch(() => null);
    const content = payload?.choices?.[0]?.message?.content;
    let obj;
    try {
      obj = JSON.parse(content);
    } catch {
      throw new Error("invalid_reply");
    }
    if (obj && typeof obj === "object" && "pass" in obj) {
      if (p.mode === "handoff" && obj.pass === true && Object.keys(obj).length === 1) return null;
      throw new Error("invalid_reply");
    }
    const speaker: unknown = obj?.speaker;
    if (
      !obj ||
      !isPet(speaker) ||
      (assigned && obj.speaker !== assigned) ||
      obj.speaker === excluded
    )
      throw new Error("invalid_reply");
    if (fact && p.reading) {
      const ev = obj.evidence,
        excerpt = p.reading.excerpt;
      if (ev === null)
        return {
          speaker: obj.speaker,
          text: "桌上这段没有写清这一点，我不能替作者补。可以回到正文，点「逐句挑选」，把提到它的那句带来。",
        };
      const spans = sentenceChoices(excerpt);
      const exact =
        typeof ev === "string" &&
        !!ev.trim() &&
        (ev === excerpt ||
          spans.some((a, i) =>
            spans.slice(i, i + 2).some((b) => excerpt.slice(a.start, b.end) === ev),
          ));
      if (!exact || !/[\p{L}\p{N}]/u.test(ev)) throw new Error("ungrounded");
      // For recall, surface the checked source, never the provider's unverifiable paraphrase.
      const lead = {
        shiba: "我帮你翻到这句了",
        owl: "能核对的是这一句",
        purr_cat: "我陪你再看一眼这句",
        kanshan: "我们先把原句留在这里",
      };
      return { speaker: obj.speaker, text: `${lead[speaker]}：「${ev}」` };
    }
    if (typeof obj.text !== "string" || !obj.text.trim() || obj.text.trim().length > 240)
      throw new Error("invalid_reply");
    const text = obj.text.trim();
    if (p.mode === "handoff" && !addsToTable(text, p.turns.at(-1)!.text, floor)) return null;
    if (p.mode === "reader" && floor === "support" && prescribesTask(text))
      throw new Error("off_intent");
    return { speaker: obj.speaker, text };
  } catch (e) {
    if (signal.aborted) throw new Error("cancelled");
    if (timeout.aborted || (e as Error)?.name === "TimeoutError") throw new Error("timeout");
    const code = (e as Error)?.message;
    throw new Error(
      ["access", "limited", "upstream", "invalid_reply", "ungrounded", "off_intent"].includes(code)
        ? code
        : "upstream",
    );
  }
}
