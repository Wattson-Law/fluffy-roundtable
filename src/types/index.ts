/**
 * 毛茸茸圆桌 · 全局类型契约
 * 对应施工蓝图 §4.2（知乎 API 已核验字段）与 §5.3（RoundtableResult JSON Schema）
 */

/* ------------------------------------------------------------------ *
 * 知乎开放平台真实返回（已核验字段，PascalCase）
 * ------------------------------------------------------------------ */

/** zhihu_search / global_search 的 Data.Items[] 原始形态 */
export interface ZhihuRawItem {
  Title?: string;
  ContentType?: string;
  ContentID?: string;
  ContentText?: string;
  Url?: string;
  Summary?: string;
  ThumbnailUrl?: string;
  CommentCount?: number;
  VoteUpCount?: number;
  AuthorName?: string;
  AuthorAvatar?: string;
  AuthorBadge?: string;
  AuthorBadgeText?: string;
  AuthorSignature?: string;
  EditTime?: number;
  CreateTime?: number;
  /** 实测为字符串 "1"-"4" */
  AuthorityLevel?: string | number;
  RankingScore?: number;
  CommentInfoList?: { Content?: string }[];
}

/** 归一化后供前端消费的知乎条目 */
export interface ZhihuItem {
  /** Only bundled editorial samples carry this marker; never sent to Zhihu. */
  origin?: "sample";
  id: string;
  title: string;
  /** zhihu_search 实测返回大段甚至完整回答正文，足以支撑真实阅读流 */
  contentText: string;
  url: string;
  author: string;
  authorAvatar?: string;
  authorBadge?: string;
  authoritylevel: number;
  voteUpCount: number;
  commentCount: number;
  /** 精选评论——护短柴犬挖「反方打脸声音」的数据源 */
  comments: string[];
  editTime?: number;
  contentType?: string;
}

/** 热榜条目（hot_list 仅返回 Title/Url/ThumbnailUrl/Summary） */
export interface HotItem {
  id: string;
  title: string;
  url: string;
  summary: string;
  thumbnailUrl?: string;
  /** 轻量本地分类标签，仅用于列表气候角标 */
  tag?: string;
}

/* ------------------------------------------------------------------ *
 * 前端 localStorage 持久化（无数据库架构 §1.5）
 * ------------------------------------------------------------------ */

/** 静默浏览轨迹：展开回答或视口停留 >= 2.5s 自动写入 */
export interface ReadingTrailItem {
  origin?: "sample";
  id: string;
  title: string;
  contentText: string;
  url: string;
  author: string;
  authoritylevel: number;
  voteUpCount: number;
  comments: string[];
  /** 来源问题标题（从热榜/搜索进入时记录） */
  fromQuestion?: string;
  readAt: number;
  visits?: number;
}

/** 《清醒猫咖手账》存档条目 */
export interface JournalEntry {
  id: string;
  createdAt: number;
  topicTitle: string;
  oneLineTakeaway: string;
  microAction: string;
  catBadgeTheme: CatBadgeTheme;
  catBadgeName: string;
  sources: { title: string; author: string; url: string }[];
}

/* ------------------------------------------------------------------ *
 * §5.3 圆桌分析结果（LLM 强制结构化输出 + 服务端硬校验）
 * ------------------------------------------------------------------ */

export type RoundtableMode = "anti_anxiety" | "decision_debate" | "topic_digest";
export type Speaker = "purr_cat" | "owl" | "shiba" | "kanshan";
export type Mood = "warm" | "glasses" | "angry_protect" | "calm" | "happy";
export type CatBadgeTheme =
  | "cyber_gpu"
  | "compass_orange"
  | "goggles_calico"
  | "cocoa_ragdoll";

export interface RoundtableRadar {
  /** 干货密度 0-100 */
  drynessScore: number;
  /** 情绪煽动 / 含焦量 0-100 */
  anxietyScore: number;
  /** 软广 / 引流嫌疑 0-100 */
  adRiskScore: number;
  summaryTag: string;
}

export interface QuoteRef {
  /** 必须是真实传入的编号 READ_x / EXT_x / NEW_x */
  sourceTag: string;
  /** 必须为原文真实子串，服务端逐字校验 */
  excerpt: string;
  reason: string;
  /** 服务端回填，LLM 不得自行生成 */
  sourceTitle?: string;
  sourceAuthor?: string;
  sourceUrl?: string;
}

export interface DialogueLine {
  speaker: Speaker;
  mood: Mood;
  text: string;
  quoteRef?: QuoteRef;
}

export interface CuratedSource {
  title: string;
  author: string;
  url: string;
  voteUpCount: number;
  authoritylevel: number;
  excerpt: string;
  /** 这篇凭什么值得你花时间 */
  why: string;
}

export interface FollowUpQuestion {
  prompt: string;
  choices: { id: string; label: string }[];
}

export interface ControlCard {
  oneLineTakeaway: string;
  microAction: string;
  catBadgeTheme: CatBadgeTheme;
  catBadgeName: string;
}

export interface RoundtableResult {
  mode: RoundtableMode;
  topicTitle: string;
  radar: RoundtableRadar;
  dialogues: DialogueLine[];
  /** 服务端按 NEW_x 编号映射回真实对象后下发，绝不含 LLM 生成的 URL */
  curatedSources: CuratedSource[];
  followUpQuestion?: FollowUpQuestion;
  controlCard: ControlCard;
  /** 运行元信息，供额度指示灯与降级提示 */
  meta: {
    llmUsed: boolean;
    degraded: boolean;
    note?: string;
    trailCount: number;
  };
}

export interface QuotaItem {
  apiId: string;
  apiName: string;
  total: number;
  used: number;
  remaining: number;
}

export interface QuotaState {
  live: boolean;
  items: QuotaItem[];
  note: string;
}
