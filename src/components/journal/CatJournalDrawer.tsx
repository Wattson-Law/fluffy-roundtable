"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, X } from "lucide-react";
import type { CatBadgeTheme, JournalEntry } from "@/types";

const CAT_EMOJI: Record<CatBadgeTheme, string> = {
  cyber_gpu: "😼",
  compass_orange: "🧭",
  goggles_calico: "🥽",
  cocoa_ragdoll: "🧶",
};

/** 《清醒猫咖手账》：猫不是奖品，是每个决定的存档 */
export function CatJournalDrawer({
  open,
  onClose,
  entries,
}: {
  open: boolean;
  onClose: () => void;
  entries: JournalEntry[];
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/45"
          />
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="fixed inset-y-0 left-0 z-50 flex w-full flex-col bg-cabin-900 sm:w-[400px]"
          >
            <div className="flex items-center gap-2 border-b border-ember-400/15 px-4 py-3">
              <span className="text-lg">📖</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[14px] font-bold text-paper-50">清醒猫咖手账</h2>
                <p className="text-[10.5px] text-paper-50/55">
                  已收录 {entries.length} 个决定
                </p>
              </div>
              <button
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-full text-paper-50/60 hover:bg-white/10"
                aria-label="关闭手账"
              >
                <X size={16} />
              </button>
            </div>

            <div className="scroll-thin scroll-thin-warm min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
              {entries.length === 0 ? (
                <p className="py-6 text-[12px] leading-relaxed text-paper-50/45">
                  这里存的不是奖品，是你每一个决定。
                  <br />
                  在小屋里拍板一次，第一只小猫就会带着当晚说服你的那几篇帖子住进来。
                </p>
              ) : (
                entries.map((e) => (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="paper-card rounded-xl p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{CAT_EMOJI[e.catBadgeTheme]}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11.5px] font-semibold text-cabin-950">
                          {e.catBadgeName}
                        </p>
                        <p className="text-[9.5px] text-cabin-900/55">
                          {new Date(e.createdAt).toLocaleString("zh-CN", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>

                    <p className="mt-2 line-clamp-2 text-[10.5px] text-cabin-900/55">
                      {e.topicTitle}
                    </p>
                    <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-cabin-950">
                      {e.oneLineTakeaway}
                    </p>
                    <p className="mt-1.5 rounded bg-ember-500/10 p-2 text-[11.5px] leading-relaxed text-cabin-950/85">
                      {e.microAction}
                    </p>

                    {e.sources.length > 0 && (
                      <>
                        <p className="mt-2 text-[9.5px] text-cabin-900/45">
                          当晚说服我的回答
                        </p>
                        <div className="mt-1 space-y-1">
                          {e.sources.map((s, i) => (
                            <a
                              key={i}
                              href={s.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-[10.5px] text-[#2E6FB7] hover:underline"
                            >
                              <ExternalLink size={9} className="shrink-0" />
                              <span className="truncate">@{s.author} · {s.title}</span>
                            </a>
                          ))}
                        </div>
                      </>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
