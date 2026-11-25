import type { Speaker } from "@/types";
import type { Room } from "./companion";
import { materialForTurn, planPetTurn } from "./pet-turn-plan.ts";

import { parseReading, readingForRoom, sameReading, type TableReading } from "./table-reading.ts";
export { readingForRoom };

export const isPet = (s: unknown): s is Speaker =>
  s === "purr_cat" || s === "owl" || s === "shiba" || s === "kanshan";
export type PetReply = { speaker: Speaker; text: string };
export type PetPacket = {
  mode: "reader" | "handoff";
  reading?: TableReading;
  turns: { speaker: "user" | Speaker; text: string }[];
};
const LIMIT = 7;

export function parsePetRequest(value: unknown): PetPacket | null {
  if (!value || typeof value !== "object") return null;
  const { mode, turns, reading } = value as Record<string, unknown>;
  if (
    (mode !== "reader" && mode !== "handoff") ||
    !Array.isArray(turns) ||
    !turns.length ||
    turns.length > LIMIT
  )
    return null;
  const clean: PetPacket["turns"] = [];
  for (const t of turns) {
    if (
      !t ||
      (t.speaker !== "user" && !isPet(t.speaker)) ||
      typeof t.text !== "string" ||
      !t.text.trim() ||
      t.text.length > 400
    )
      return null;
    clean.push({ speaker: t.speaker, text: t.text.trim() });
  }
  if (clean[0].speaker !== "user") return null;
  if (
    mode === "reader"
      ? clean.at(-1)!.speaker !== "user"
      : clean.at(-1)!.speaker === "user" || clean.at(-2)?.speaker !== "user"
  )
    return null;
  if (reading === undefined) return { mode, turns: clean };
  const verified = parseReading(reading);
  return verified ? { mode, turns: clean, reading: verified } : null;
}

type ChatScope = { ids: ReadonlySet<string>; reading?: TableReading | null };

/** Only speech in this disclosure scope and the exact approved preview can leave the room. */
export function packetForRoom(
  room: Room,
  since: number,
  mode: PetPacket["mode"],
  scope?: ChatScope,
): PetPacket | null {
  const recent = room.turns
    .filter(
      (t) =>
        t.at >= since &&
        (!scope || scope.ids.has(t.id)) &&
        t.via === "model" &&
        (t.kind === "typed" || t.kind === "reply"),
    )
    .slice(-LIMIT);
  const start = recent.findIndex((t) => t.speaker === "user");
  if (start < 0) return null;
  const packet = parsePetRequest({
    mode,
    ...(scope?.reading && sameReading(scope.reading, readingForRoom(room))
      ? { reading: scope.reading }
      : {}),
    turns: recent.slice(start).map(({ speaker, text }) => ({ speaker, text })),
  });
  return packet ? materialForTurn(packet) : null;
}
export function canHandoff(room: Room, since: number, scope?: ChatScope): boolean {
  const prev = room.turns.at(-2),
    last = room.turns.at(-1);
  if (
    last?.kind !== "reply" ||
    last.via !== "model" ||
    prev?.kind !== "typed" ||
    prev.via !== "model" ||
    prev.at < since ||
    (scope && (!scope.ids.has(last.id) || !scope.ids.has(prev.id)))
  )
    return false;
  const p = packetForRoom(room, since, "handoff", scope);
  return !!p && planPetTurn(p).floor !== "reader";
}
