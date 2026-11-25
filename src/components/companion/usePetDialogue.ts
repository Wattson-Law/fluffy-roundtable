"use client";
import { useEffect, useRef, useState } from "react";
import { settleSpeech, startSpeech, type Room, type SpeechStart } from "@/lib/companion";
import { canHandoff, isPet, packetForRoom, type PetPacket } from "@/lib/pet-dialogue";
import { readingForRoom, sameReading, type TableReading } from "@/lib/table-reading";
import { memoryRequest } from "@/lib/shared-memory";
import { leavesReading } from "@/lib/turn-intent";
import { getBook, updateBook } from "@/lib/storage";

const endpoint = "/api/roundtable/chat";
const reasons: Record<string, string> = {
  busy: "同时开口的伙伴太多，这句没有排队，可以稍后再问",
  limited: "模型限流或额度不足",
  access: "模型未授权",
  timeout: "模型回应超时",
  invalid_reply: "模型回复没有符合这一轮的人设格式",
  off_intent: "这句没有照你刚才想要的方式接话",
  ungrounded: "这句没能对回桌上的原文",
  no_reading: "这桌还没有共享原句",
  offline: "未开启在线联调",
};
/** Only Home owns this hook. The portable trial never imports a transport or queries status. */
export function usePetDialogue() {
  const [model, setModel] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const grant = useRef<{ key: string; reading: TableReading } | null>(null);
  const ids = useRef(new Set<string>());
  const [yieldedAt, setYieldedAt] = useState<string | null>(null);
  const [, refreshScope] = useState(0);
  const epoch = useRef<number | undefined>(undefined);
  function remember(id: string) {
    ids.current.add(id);
    // Only the last seven are usable in a packet. Keep a small cushion for local turns.
    if (ids.current.size > 16) ids.current.delete(ids.current.values().next().value!);
  }
  const [checking, setChecking] = useState(true);
  const active = useRef<AbortController | null>(null),
    since = useRef(0);
  useEffect(() => {
    since.current = Date.now();
    const c = new AbortController();
    void fetch(endpoint, {
      signal: AbortSignal.any([c.signal, AbortSignal.timeout(6000)]),
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((j) => {
        if (!c.signal.aborted && j.enabled && typeof j.model === "string") setModel(j.model);
      })
      .catch(() => {})
      .finally(() => {
        if (!c.signal.aborted) setChecking(false);
      });
    return () => {
      c.abort();
      active.current?.abort();
    };
  }, []);
  function cancel() {
    active.current?.abort();
    active.current = null;
    setBusy(false);
    setNotice("");
  }
  function changeScope(key?: string, reading?: TableReading | null) {
    epoch.current = getBook().memoryEpoch;
    cancel();
    ids.current = new Set();
    setYieldedAt(null);
    grant.current = key && reading ? { key, reading } : null;
    refreshScope((n) => n + 1);
  }
  function sharedFor(room?: Room) {
    const g = grant.current;
    return g && room?.key === g.key && sameReading(g.reading, readingForRoom(room))
      ? g.reading
      : null;
  }
  async function deliver(
    room: Room,
    mode: PetPacket["mode"],
    anchor: string,
    fallback?: SpeechStart["fallback"],
  ) {
    const sentEpoch = getBook().memoryEpoch;
    const p = packetForRoom(room, since.current, mode, {
      ids: ids.current,
      reading: sharedFor(room),
    });
    const deadline = AbortSignal.timeout(26000);
    const c = new AbortController();
    active.current = c;
    setBusy(true);
    setNotice("");
    try {
      if (!p) throw Error("input");
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.any([c.signal, deadline]),
        body: JSON.stringify(p),
      });
      const j = await res.json();
      if (getBook().memoryEpoch !== sentEpoch) return;
      if (res.ok && j.source === "reader_floor" && mode === "handoff") {
        // This is a successful handoff back to the human, not a failed (or synthetic) pet reply.
        if (
          !c.signal.aborted &&
          getBook()
            .threads.find((t) => t.key === room.key)
            ?.turns.at(-1)?.id === anchor
        )
          setYieldedAt(anchor);
        return;
      }
      if (
        !res.ok ||
        j.source !== "model" ||
        !isPet(j.reply?.speaker) ||
        typeof j.reply?.text !== "string" ||
        !j.reply.text.trim()
      )
        throw Error(typeof j.error === "string" ? j.error : "invalid_reply");
      if (!c.signal.aborted) {
        const updated = updateBook((b) =>
          settleSpeech(b, room.key, anchor, j.reply, Date.now(), "model"),
        );
        const tail = updated.threads.find((t) => t.key === room.key)?.turns;
        if (tail?.at(-2)?.id === anchor && tail.at(-1)?.via === "model") remember(tail.at(-1)!.id);
      }
    } catch (e) {
      if (
        !c.signal.aborted &&
        getBook().memoryEpoch === sentEpoch &&
        getBook()
          .threads.find((t) => t.key === room.key)
          ?.turns.at(-1)?.id === anchor
      ) {
        const msg =
          reasons[deadline.aborted ? "timeout" : (e as Error).message] ?? "模型这次没连上";
        if (fallback)
          updateBook((b) => settleSpeech(b, room.key, anchor, fallback, Date.now(), "fallback"));
        setNotice(msg + (fallback ? "，这句由本机接住。" : "，没有生成第二句。"));
      }
    } finally {
      if (active.current === c) {
        active.current = null;
        setBusy(false);
      }
    }
  }
  function send(key: string, text: string) {
    if (leavesReading(text) || memoryRequest(text) || epoch.current !== getBook().memoryEpoch)
      changeScope();
    else cancel();
    let speech!: SpeechStart;
    const b = updateBook((b) => {
      speech = startSpeech(
        b,
        key,
        text,
        Date.now(),
        !!model,
        sharedFor(b.threads.find((t) => t.key === key)),
      );
      return speech.book;
    });
    const room = b.threads.find((t) => t.key === key);
    if (b.memoryEpoch !== epoch.current) changeScope();
    if (room && speech.anchor) {
      remember(speech.anchor);
      void deliver(room, "reader", speech.anchor, speech.fallback);
    }
  }
  function floorFor(room?: Room): "none" | "offer" | "reader" {
    const last = room?.turns.at(-1);
    if (
      !model ||
      !room ||
      !last ||
      last.kind !== "reply" ||
      last.via !== "model" ||
      !ids.current.has(last.id)
    )
      return "none";
    if (getBook().memoryEpoch !== epoch.current) return "none";
    if (yieldedAt === last.id) return "reader";
    return canHandoff(room, since.current, { ids: ids.current, reading: sharedFor(room) })
      ? "offer"
      : "reader";
  }
  function pass(key: string) {
    const room = getBook().threads.find((t) => t.key === key);
    if (!active.current && room && floorFor(room) === "offer")
      void deliver(room, "handoff", room.turns.at(-1)!.id);
  }
  return {
    model,
    checking,
    busy,
    notice,
    cancel,
    changeScope,
    sharedFor,
    send,
    floorFor,
    pass,
  };
}
