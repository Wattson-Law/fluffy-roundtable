"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AnimalRow, DialogueBubble, SourceTrailCards } from "./AnimalStage";
import { BigScreenTrail } from "./BigScreenTrail";
import { ControlCard } from "./ControlCard";
import type { ReadingTrailItem, RoundtableResult, Speaker } from "@/types";

const CABIN_BG = "/assets/images/fluffy-roundtable-hq-backview.png";

const MODE_LABEL: Record<RoundtableResult["mode"], string> = {
  anti_anxiety: "脱水拆解模式",
  decision_debate: "正反决策模式",
  topic_digest: "热点速览模式",
};

/** 篝火小屋主容器：大光幕 + 圆桌剧场 + 掌控卡 */
export function CabinModal({
  open,
  onClose,
  trail,
  result,
  loading,
  error,
  onCommit,
  committed,
  onRetry,
}: {
  open: boolean;
  onClose: () => void;
  trail: ReadingTrailItem[];
  result: RoundtableResult | null;
  loading: boolean;
  error: string | null;
  onCommit: () => void;
  committed: boolean;
  onRetry: () => void;
}) {
  const [revealed, setRevealed] = useState(0);
  const [followUpAnswer, setFollowUpAnswer] = useState<{
    text: string;
    microAction: string;
  } | null>(null);

  const dialogues = result?.dialogues ?? [];

  // 逐轮演绎：每 1.1 秒揭示一条，营造围炉夜话的节奏感
  useEffect(() => {
    if (!result) {
      setRevealed(0);
      setFollowUpAnswer(null);
      return;
    }
    setRevealed(1);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 2; i <= dialogues.length; i++) {
      timers.push(setTimeout(() => setRevealed(i), (i - 1) * 1100));
    }
    return () => timers.forEach(clearTimeout);
  }, [result, dialogues.length]);

  const speaking: Speaker | null = useMemo(() => {
    if (!result || revealed === 0) return null;
    if (revealed >= dialogues.length) return null;
    return dialogues[revealed - 1]?.speaker ?? null;
  }, [result, revealed, dialogues]);

  const allRevealed = result != null && revealed >= dialogues.length;
  // 柴犬最后一次发言之后插入溯源卡
  const shibaLastIdx = useMemo(() => {
    for (let i = dialogues.length - 1; i >= 0; i--) {
      if (dialogues[i].speaker === "shiba") return i;
    }
    return -1;
  }, [dialogues]);

  const chooseFollowUp = async (c: { id: string; label: string }) => {
    try {
      const res = await fetch("/api/roundtable/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          choiceId: c.id,
          choiceLabel: c.label,
          topicTitle: result?.topicTitle ?? "",
        }),
      });
      const j = await res.json();
      setFollowUpAnswer({ text: j.dialogue?.text ?? "", microAction: j.microAction ?? "" });
    } catch {
      /* 追问失败不影响主卡片 */
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
          />

          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="cabin-bg fixed inset-y-0 right-0 z-50 flex w-full flex-col sm:w-[580px]"
            style={{
              backgroundImage: `linear-gradient(rgba(20,33,38,0.82), rgba(16,26,22,0.93)), url(${CABIN_BG})`,
            }}
          >
            {/* 篝火暖光 */}
            <div className="cabin-ember-glow pointer-events-none absolute inset-x-0 bottom-0 h-1/2 animate-ember" />

            {/* 头部 */}
            <div className="relative flex items-center gap-2 border-b border-ember-400/15 px-4 py-3">
              <span className="text-lg">🔥</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[14px] font-bold text-paper-50">毛茸茸圆桌</h2>
                <p className="truncate text-[10.5px] text-paper-50/55">
                  {result ? (
                    <>
                      {MODE_LABEL[result.mode]} · {result.topicTitle}
                    </>
                  ) : (
                    "围着篝火，聊聊你刚才看的那几篇"
                  )}
                </p>
              </div>
              <button
                onClick={onClose}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-paper-50/60 transition hover:bg-white/10 hover:text-paper-50"
                aria-label="关闭小屋"
              >
                <X size={16} />
              </button>
            </div>

            {/* 内容区 */}
            <div className="scroll-thin scroll-thin-warm relative min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {trail.length > 0 && <BigScreenTrail trail={trail} radar={result?.radar} />}

              <AnimalRow speaking={speaking} />

              {loading && (
                <div className="flex items-center gap-2 py-6 text-[12.5px] text-paper-50/55">
                  <Loader2 size={13} className="animate-spin" />
                  四小只正在看你刚翻过的那几篇，并去知乎重新找真话…
                </div>
              )}

              {error && (
                <div className="cabin-panel rounded-xl p-3.5">
                  <p className="text-[12.5px] leading-relaxed text-paper-50/85">{error}</p>
                  <button
                    onClick={onRetry}
                    className="mt-2.5 rounded-full border border-ember-400/40 px-3 py-1 text-[11.5px] text-paper-50 hover:bg-ember-400/15"
                  >
                    再试一次
                  </button>
                </div>
              )}

              {dialogues.slice(0, revealed).map((d, i) => (
                <div key={i} className="space-y-2">
                  <DialogueBubble line={d} delay={0} />
                  {i === shibaLastIdx && result && (
                    <SourceTrailCards sources={result.curatedSources} delay={0.25} />
                  )}
                </div>
              ))}

              {result && allRevealed && (
                <ControlCard
                  card={result.controlCard}
                  followUp={result.followUpQuestion}
                  followUpAnswer={followUpAnswer}
                  onChoose={chooseFollowUp}
                  onCommit={onCommit}
                  committed={committed}
                  delay={0.15}
                />
              )}

              {result?.meta.note && (
                <p className="pb-1 text-center text-[10px] text-paper-50/35">
                  {result.meta.note}
                </p>
              )}
            </div>

            <div className="relative border-t border-ember-400/15 px-4 py-2 text-center text-[9.5px] leading-relaxed text-paper-50/35">
              所有引用均逐字来自知乎开放平台实时返回的真实原文，可点击溯源
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
