import type { ListeningDeskModel } from "./useListeningTopics";
import "./listening-desk.css";

// Part of the existing client cabin. The one RoomScene owns the portrait and speech paper.
export function ListeningDesk({
  desk,
  onTakeFloor,
  onCompose,
}: {
  desk: ListeningDeskModel;
  /** Cancel an in-flight ordinary chat when the reader explicitly chooses a desk control. */
  onTakeFloor?: () => void;
  /** Optional: focus the cabin's existing input; this component has no composer of its own. */
  onCompose?: () => void;
}) {
  const { topic, upNext, previous, continuous, hasMoreLines, searching, scope } = desk;
  const act = (fn: () => void) => () => {
    onTakeFloor?.();
    fn();
  };
  const source =
    topic?.origin === "rumor"
      ? "读者听说 · 未经证实"
      : topic?.origin === "reader"
        ? "读者出题"
        : topic?.origin === "search"
          ? `知乎站内 · ${scope}`
          : "知乎热榜";
  const canPlay = !!topic && (hasMoreLines || !!upNext);
  return (
    <section className="listening-desk" aria-label="旁听话题">
      <header>
        <strong>桌边选题</strong>
        {topic && <small>{source}</small>}
      </header>
      {topic && (
        <div className="listening-topic">
          <b>{topic.title}</b>
          {topic.url && (
            <a href={topic.url} target="_blank" rel="noopener noreferrer" onClick={desk.stop}>
              知乎原帖 ↗
            </a>
          )}
        </div>
      )}
      <p role="status" className="listening-notice">
        {desk.notice}
      </p>
      {topic && !hasMoreLines && upNext && (
        <button type="button" className="listening-offer" onClick={act(desk.nextTopic)}>
          <small>接下一题 →</small> {upNext.title}
        </button>
      )}
      <div className="listening-actions">
        {!topic && !searching && (
          <button type="button" onClick={act(desk.pickHot)}>
            让伙伴挑新闻
          </button>
        )}
        {topic && hasMoreLines && !continuous && (
          <button type="button" onClick={act(desk.step)}>
            再听一句
          </button>
        )}
        {topic && hasMoreLines && (
          <button type="button" onClick={act(desk.nextTopic)}>
            换一题
          </button>
        )}
        {continuous || searching ? (
          <button type="button" onClick={desk.stop}>
            {searching ? "停止找题" : "暂停旁听"}
          </button>
        ) : (
          canPlay && (
            <button type="button" onClick={act(desk.listen)}>
              连续旁听
            </button>
          )
        )}
        {previous && (
          <button type="button" onClick={act(desk.previousTopic)}>
            接回上一题
          </button>
        )}
        {!topic && !searching && (
          <button type="button" onClick={act(() => void desk.findScope(scope || "科技"))}>
            {scope ? `再找「${scope}」` : "听点科技的"}
          </button>
        )}
      </div>
      <footer>
        {continuous
          ? "伙伴会慢慢接到下一题，你一动笔就停。"
          : "也可以在输入框说「聊点科技的」或「我来出题：……」。"}
        {onCompose && (
          <button
            type="button"
            onClick={() => {
              desk.stop();
              onCompose();
            }}
          >
            我来出题
          </button>
        )}
      </footer>
    </section>
  );
}
