"use client";

import { motion } from "framer-motion";
import type { ReadingTrailItem, RoundtableRadar } from "@/types";

/** 《头脑特工队》式弧形大光幕：陈列用户刚刷过的真实帖子 */
export function BigScreenTrail({
  trail,
  radar,
}: {
  trail: ReadingTrailItem[];
  radar?: RoundtableRadar;
}) {
  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, scaleY: 0.82, y: -14 }}
        animate={{ opacity: 1, scaleY: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 180, damping: 22 }}
        className="rounded-2xl border border-[#dbd4c3] bg-[#f5f1e7] p-3"
        style={{ transformOrigin: "top center" }}
      >
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-[11px] font-semibold tracking-wide text-cabin-900/70">
            你刚刚在深夜翻过的 {trail.length} 篇
          </p>
          {radar && (
            <p className="text-[10.5px] text-cabin-900/55">{radar.summaryTag}</p>
          )}
        </div>

        <div className="scroll-thin flex gap-2 overflow-x-auto pb-1">
          {trail.map((t, i) => (
            <motion.a
              key={t.id || t.url}
              href={t.url}
              target="_blank"
              rel="noreferrer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + i * 0.09 }}
              className="border border-[#e6dfd0] bg-[#fdfbf5] w-[190px] shrink-0 rounded-lg p-2.5 transition hover:-translate-y-0.5"
            >
              <p className="line-clamp-2 text-[12px] font-medium leading-snug text-cabin-950">
                {t.title}
              </p>
              <p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-cabin-900/60">
                {t.contentText.slice(0, 60)}
              </p>
              <div className="mt-1.5 flex items-center gap-1.5 text-[9.5px] text-cabin-900/55">
                <span className="truncate">@{t.author}</span>
                {t.authoritylevel >= 3 && (
                  <span className="rounded bg-sky-100 px-1 text-sky-700">
                    Lv.{t.authoritylevel}
                  </span>
                )}
                <span className="ml-auto shrink-0 text-[#2E6FB7]">▲{t.voteUpCount}</span>
              </div>
            </motion.a>
          ))}
        </div>
      </motion.div>

      {radar && <RadarBars radar={radar} />}
    </div>
  );
}

/** 情绪与水分雷达条 */
function RadarBars({ radar }: { radar: RoundtableRadar }) {
  const bars = [
    { label: "干货密度", v: radar.drynessScore, color: "bg-emerald-400" },
    { label: "情绪煽动", v: radar.anxietyScore, color: "bg-amber-400" },
    { label: "引流嫌疑", v: radar.adRiskScore, color: "bg-rose-400" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="mt-2.5 grid grid-cols-3 gap-2"
    >
      {bars.map((b, i) => (
        <div key={b.label} className="bg-[#435747] rounded-lg px-2.5 py-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] text-paper-50/70">{b.label}</span>
            <span className="text-[11px] font-semibold tabular-nums text-paper-50">{b.v}</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/30">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, b.v)}%` }}
              transition={{ delay: 0.35 + i * 0.1, duration: 0.7 }}
              className={`h-full rounded-full ${b.color}`}
            />
          </div>
        </div>
      ))}
    </motion.div>
  );
}
