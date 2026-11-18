"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const KANSHAN_AVATAR = "/assets/ip/33f11967cc145627560c3db70c7d3ab8.jpg";

/** 侧边常驻刘看山：静默记录、微表情、计数角标、轻气泡低语，绝不弹窗打断阅读 */
export function KanshanDock({
  count,
  onOpen,
  busy,
}: {
  count: number;
  onOpen: () => void;
  busy: boolean;
}) {
  const [whisper, setWhisper] = useState<string | null>(null);
  const [lastCount, setLastCount] = useState(0);

  useEffect(() => {
    if (count === 0) {
      setWhisper("我在旁边陪你刷，乱了点我");
      const t = setTimeout(() => setWhisper(null), 5200);
      return () => clearTimeout(t);
    }
    if (count !== lastCount) {
      setLastCount(count);
      const lines = [
        "这篇我记下了…",
        `已经陪你看了 ${count} 篇`,
        count >= 3 ? "攒够了，要不要进屋聊聊？" : "嗯，继续看，我守着",
      ];
      setWhisper(lines[Math.min(count - 1, lines.length - 1)]);
      const t = setTimeout(() => setWhisper(null), 4200);
      return () => clearTimeout(t);
    }
  }, [count, lastCount]);

  const ready = count >= 1;

  return (
    <div className="fixed bottom-5 right-5 z-40 flex items-end gap-2">
      <AnimatePresence>
        {whisper && (
          <motion.div
            initial={{ opacity: 0, x: 12, scale: 0.94 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 8, scale: 0.96 }}
            className="mb-3 max-w-[190px] rounded-2xl rounded-br-sm bg-cabin-800/95 px-3 py-2 text-[12px] leading-relaxed text-paper-50 shadow-lg ring-1 ring-ember-400/25"
          >
            {whisper}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={onOpen}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.95 }}
        animate={ready ? { y: [0, -5, 0] } : {}}
        transition={{ duration: 3.4, repeat: ready ? Infinity : 0 }}
        className="relative grid h-16 w-16 place-items-center rounded-full bg-cabin-800 shadow-xl ring-2 ring-ember-400/45"
        aria-label="打开毛茸茸小屋"
      >
        {/* 篝火暖光晕 */}
        <span className="absolute inset-0 animate-ember rounded-full bg-ember-500/22 blur-md" />
        <img
          src={KANSHAN_AVATAR}
          alt="刘看山"
          className="relative h-[52px] w-[52px] rounded-full object-cover"
        />

        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute -right-0.5 -top-0.5 grid h-6 min-w-6 place-items-center rounded-full bg-ember-500 px-1.5 text-[11px] font-bold text-white shadow"
          >
            {count}
          </motion.span>
        )}

        {busy && (
          <span className="absolute inset-0 animate-pulse rounded-full ring-2 ring-ember-400" />
        )}
      </motion.button>
    </div>
  );
}
