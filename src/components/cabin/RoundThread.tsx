import { useEffect, useState, type ReactNode } from "react";
import { UserRound } from "lucide-react";
import type { Speaker } from "@/types";
import { art } from "@/lib/art";
import { names, type Turn } from "@/lib/companion";
import { zhihuSource } from "@/lib/listening-topics";

export function RoundThread({
  turns,
  labelLocal,
  attachment,
  onAddress,
}: {
  turns: Turn[];
  labelLocal: boolean;
  onAddress: (pet: Speaker) => void;
  attachment: (turn: Turn) => ReactNode;
}) {
  // Restored messages belong on the page, but are neither arrivals nor new announcements.
  const [restored] = useState(() => new Set(turns.map((t) => t.id)));
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <div
      className="round-thread"
      role="log"
      aria-label="聊天记录"
      aria-live={ready ? "polite" : "off"}
      aria-relevant="additions"
      aria-atomic="false"
    >
      {turns.map((t) => {
        const who = t.speaker;
        const source =
          t.via === "model"
            ? "模型回复"
            : t.via === "fallback"
              ? "本机兜底"
              : t.via === "local" && labelLocal
                ? "本机回复"
                : null;
        const url = t.kind === "listening" ? zhihuSource(t.publicUrl) : undefined;
        return (
          <div
            className="round-message"
            key={t.id}
            data-speaker={who}
            data-kind={t.kind}
            data-new={!restored.has(t.id)}
          >
            {who === "user" ? (
              <span className="message-face" aria-hidden="true">
                <UserRound size={18} />
              </span>
            ) : (
              <button
                className="message-face pet-face"
                type="button"
                aria-label={`和${names[who]}说句话`}
                title={`把话递给${names[who]}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onAddress(who)}
              >
                <img src={art.resting[who]} alt="" draggable={false} />
              </button>
            )}
            <div className="message-column">
              <div className="message-byline">
                <strong>{who === "user" ? "你" : names[who]}</strong>
                {t.kind === "note" && <small>主动便签</small>}
                {who !== "user" && source && <small className="voice-source">{source}</small>}
              </div>
              <p className="message-bubble">{t.text}</p>
              {url && (
                <a
                  className="paper-link message-link"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  回看这条知乎原帖 ↗
                </a>
              )}
              {attachment(t)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
