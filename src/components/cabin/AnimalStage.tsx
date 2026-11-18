"use client";

import { motion } from "framer-motion";
import { ExternalLink, Quote, ShieldCheck } from "lucide-react";
import type { DialogueLine, Mood, Speaker } from "@/types";

export const ANIMALS: Record<
  Speaker,
  { emoji: string; name: string; role: string; accent: string; ring: string }
> = {
  purr_cat: {
    emoji: "🐱",
    name: "呼噜猫",
    role: "治愈行动官",
    accent: "text-fur-cat",
    ring: "ring-fur-cat/45",
  },
  owl: {
    emoji: "🦉",
    name: "考据猫头鹰",
    role: "数据考据官",
    accent: "text-amber-200",
    ring: "ring-fur-owl/55",
  },
  shiba: {
    emoji: "🐕",
    name: "护短柴犬",
    role: "踩坑情报员",
    accent: "text-fur-shiba",
    ring: "ring-fur-shiba/45",
  },
  kanshan: {
    emoji: "🦊",
    name: "刘看山",
    role: "圆桌主持",
    accent: "text-fur-kanshan",
    ring: "ring-fur-kanshan/50",
  },
};

const MOOD_HINT: Record<Mood, string> = {
  warm: "温柔眯眼",
  glasses: "推眼镜",
  angry_protect: "炸毛护短",
  calm: "收口",
  happy: "摇尾巴",
};

/** 篝火旁四只小动物（顶部常驻） */
export function AnimalRow({ speaking }: { speaking: Speaker | null }) {
  return (
    <div className="flex items-end justify-around border-b border-ember-400/15 pb-3">
      {(Object.keys(ANIMALS) as Speaker[]).map((s) => {
        const a = ANIMALS[s];
        const active = speaking === s;
        return (
          <div key={s} className="flex flex-col items-center gap-1">
            <motion.div
              animate={
                active
                  ? { scale: [1, 1.12, 1.06], y: [0, -4, -2] }
                  : { scale: 1, y: 0 }
              }
              transition={{ duration: 1.4, repeat: active ? Infinity : 0, repeatType: "reverse" }}
              className={`grid h-12 w-12 place-items-center rounded-full bg-cabin-800 text-2xl ${
                active ? `ring-2 ${a.ring} shadow-lg shadow-ember-500/20` : "opacity-50"
              }`}
            >
              {a.emoji}
            </motion.div>
            <span
              className={`text-[10px] ${active ? a.accent : "text-paper-50/35"}`}
            >
              {a.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** 单条对话气泡 */
export function DialogueBubble({ line, delay }: { line: DialogueLine; delay: number }) {
  const a = ANIMALS[line.speaker];
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 240, damping: 22 }}
      className="flex gap-2.5"
    >
      <div
        className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cabin-800 text-lg ring-1 ${a.ring}`}
      >
        {a.emoji}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5">
          <span className={`text-[11.5px] font-semibold ${a.accent}`}>{a.name}</span>
          <span className="text-[9.5px] text-paper-50/35">{a.role}</span>
          <span className="rounded-full bg-black/25 px-1.5 text-[9px] text-paper-50/45">
            {MOOD_HINT[line.mood]}
          </span>
        </div>

        <div className="rounded-2xl rounded-tl-sm bg-cabin-800/80 px-3.5 py-2.5 ring-1 ring-ember-400/12">
          <p className="text-[13px] leading-[1.75] text-paper-50/92">{line.text}</p>

          {line.quoteRef && (
            <a
              href={line.quoteRef.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="paper-card mt-2.5 block rounded-lg p-2.5 transition hover:-translate-y-0.5"
            >
              <div className="flex items-start gap-1.5">
                <Quote size={11} className="mt-0.5 shrink-0 text-ember-600" />
                <p className="text-[12px] leading-relaxed text-cabin-950">
                  <mark className="evidence">{line.quoteRef.excerpt}</mark>
                </p>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-cabin-900/60">
                <span className="font-medium">@{line.quoteRef.sourceAuthor}</span>
                <span className="truncate">{line.quoteRef.sourceTitle}</span>
                <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-[#2E6FB7]">
                  <ExternalLink size={9} />
                  原帖
                </span>
              </div>
              {line.quoteRef.reason && (
                <p className="mt-1 text-[10px] text-ember-600">· {line.quoteRef.reason}</p>
              )}
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/** 柴犬端出的真实可溯源好回答 */
export function SourceTrailCards({
  sources,
  delay,
}: {
  sources: {
    title: string;
    author: string;
    url: string;
    voteUpCount: number;
    authoritylevel: number;
    excerpt: string;
    why: string;
  }[];
  delay: number;
}) {
  if (sources.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="ml-11 space-y-2"
    >
      {sources.map((s, i) => (
        <a
          key={s.url}
          href={s.url}
          target="_blank"
          rel="noreferrer"
          className="paper-card block rounded-lg p-3 transition hover:-translate-y-0.5"
        >
          <div className="flex items-start gap-2">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ember-500/20 text-[10px] font-bold text-ember-600">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-cabin-950">
                {s.title}
              </p>
              <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-cabin-900/72">
                “{s.excerpt}”
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-cabin-900/60">
                <span className="font-medium">@{s.author}</span>
                {s.authoritylevel >= 3 && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-sky-100 px-1 text-sky-700">
                    <ShieldCheck size={8} />
                    Lv.{s.authoritylevel}
                  </span>
                )}
                <span className="text-[#2E6FB7]">▲{s.voteUpCount.toLocaleString()}</span>
                <span className="ml-auto inline-flex items-center gap-0.5">
                  <ExternalLink size={9} />
                  原帖
                </span>
              </div>
              <p className="mt-1 text-[10.5px] text-ember-600">· {s.why}</p>
            </div>
          </div>
        </a>
      ))}
    </motion.div>
  );
}
