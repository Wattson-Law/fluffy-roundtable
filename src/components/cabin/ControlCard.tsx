"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Sparkles } from "lucide-react";
import type { ControlCard as ControlCardType, FollowUpQuestion } from "@/types";

const CAT_EMOJI: Record<ControlCardType["catBadgeTheme"], string> = {
  cyber_gpu: "😼",
  compass_orange: "🧭",
  goggles_calico: "🥽",
  cocoa_ragdoll: "🧶",
};

/** 底部「3 分钟最小掌控卡」+ 决策追问芯片 + 入账按钮 */
export function ControlCard({
  card,
  followUp,
  followUpAnswer,
  onChoose,
  onCommit,
  committed,
  delay,
}: {
  card: ControlCardType;
  followUp?: FollowUpQuestion;
  followUpAnswer?: { text: string; microAction: string } | null;
  onChoose: (c: { id: string; label: string }) => void;
  onCommit: () => void;
  committed: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 190, damping: 22 }}
      className="space-y-2.5"
    >
      {/* 决策追问芯片 */}
      {followUp && !followUpAnswer && (
        <div className="cabin-panel rounded-xl p-3">
          <p className="text-[12.5px] leading-relaxed text-paper-50/88">{followUp.prompt}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {followUp.choices.map((c) => (
              <button
                key={c.id}
                onClick={() => onChoose(c)}
                className="rounded-full border border-ember-400/40 px-3.5 py-1.5 text-[12px] text-paper-50 transition hover:bg-ember-400/15"
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {followUpAnswer && (
        <div className="flex gap-2.5">
          <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cabin-800 text-lg ring-1 ring-fur-kanshan/50">
            🦊
          </div>
          <div className="rounded-2xl rounded-tl-sm bg-cabin-800/80 px-3.5 py-2.5 ring-1 ring-ember-400/12">
            <p className="text-[13px] leading-[1.75] text-paper-50/92">{followUpAnswer.text}</p>
          </div>
        </div>
      )}

      {/* 掌控卡 */}
      <div className="paper-card rounded-xl p-3.5">
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles size={13} className="text-ember-600" />
          <h3 className="text-[12px] font-bold tracking-wide text-cabin-950">
            3 分钟最小掌控卡
          </h3>
        </div>

        <p className="text-[13px] font-semibold leading-relaxed text-cabin-950">
          {card.oneLineTakeaway}
        </p>

        <div className="mt-2.5 rounded-lg bg-ember-500/10 p-2.5">
          <p className="text-[10.5px] font-medium text-ember-600">今天就能做的一件小事</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-cabin-950/88">
            {followUpAnswer?.microAction ?? card.microAction}
          </p>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-2xl">{CAT_EMOJI[card.catBadgeTheme]}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11.5px] font-medium text-cabin-950">
              {card.catBadgeName}
            </p>
            <p className="text-[10px] text-cabin-900/55">
              {committed ? "已入住清醒猫咖手账" : "等你拍板就跟定你"}
            </p>
          </div>

          {committed ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-medium text-emerald-700">
              <CheckCircle2 size={13} />
              已收进手账
            </span>
          ) : (
            <button
              onClick={onCommit}
              className="shrink-0 rounded-full bg-ember-500 px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-ember-600"
            >
              我决定了 🐾
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
