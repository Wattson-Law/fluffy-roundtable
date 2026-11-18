/**
 * 知乎开放平台客户端（施工蓝图 §4）
 *
 * 硬约束：
 *  - 仅在 Node.js 服务端调用，Secret 绝不下发浏览器（§4.1）
 *  - 参数大小写已实测核验：Query / Count / Limit 均为 PascalCase，小写 q 会返回 Code 10001
 *  - 统一信封 { Code, Message, Data }，Code 0 为成功
 *  - 所有数据真实，不造假；失败时由上层降级为空列表 + 友好提示，绝不白屏（§5.3）
 */
import "server-only";
import { TTL, cached, normalizeQuery, setTtlMultiplier } from "./cache";
import type { HotItem, QuotaState, ZhihuItem, ZhihuRawItem } from "@/types";

const BASE = "https://developer.zhihu.com";
const SECRET = process.env.ZHIHU_ACCESS_SECRET ?? "";

export const zhihuConfigured = Boolean(SECRET);

export interface ApiResult<T> {
  data: T;
  degraded: boolean;
  reason?: string;
  cacheHit?: boolean;
}

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${SECRET}`,
    "X-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
    "Content-Type": "application/json",
  };
}

async function get<T>(path: string, params: Record<string, string | number>): Promise<T> {
  if (!SECRET) throw new Error("ZHIHU_ACCESS_SECRET 未配置");
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  const res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ""}`, {
    headers: headers(),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
  const json = (await res.json()) as { Code?: number; Message?: string; Data?: unknown };
  if (typeof json.Code === "number" && json.Code !== 0) {
    throw new Error(`${path} Code ${json.Code} ${json.Message ?? ""}`);
  }
  return (json.Data ?? {}) as T;
}

/* ------------------------------------------------------------------ *
 * 文本清洗与归一化
 * ------------------------------------------------------------------ */

export function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function num(v: unknown, dflt = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^\d+(\.\d+)?$/.test(v)) return Number(v);
  return dflt;
}

export function normalizeItem(raw: ZhihuRawItem, idx = 0): ZhihuItem {
  const title = stripHtml(raw.Title ?? "").replace(/\s*-\s*知乎\s*$/, "");
  return {
    id: String(raw.ContentID ?? `${raw.Url ?? "item"}_${idx}`),
    title: title || "（未命名）",
    contentText: stripHtml(raw.ContentText ?? raw.Summary ?? ""),
    url: raw.Url ?? "https://www.zhihu.com",
    author: stripHtml(raw.AuthorName ?? "") || "知乎用户",
    authorAvatar: raw.AuthorAvatar || undefined,
    authorBadge: stripHtml(raw.AuthorBadgeText ?? raw.AuthorBadge ?? "") || undefined,
    authoritylevel: num(raw.AuthorityLevel, 0),
    voteUpCount: num(raw.VoteUpCount),
    commentCount: num(raw.CommentCount),
    comments: (raw.CommentInfoList ?? [])
      .map((c) => stripHtml(c?.Content ?? ""))
      .filter((c) => c.length > 1),
    editTime: raw.EditTime,
    contentType: raw.ContentType,
  };
}

function digItems(data: unknown): ZhihuRawItem[] {
  const o = (data ?? {}) as Record<string, unknown>;
  const items = o.Items;
  if (Array.isArray(items)) return items as ZhihuRawItem[];
  if (Array.isArray(data)) return data as ZhihuRawItem[];
  return [];
}

/* ------------------------------------------------------------------ *
 * 热榜 —— 100 次/天，强制 15 分钟 TTL 缓存
 * ------------------------------------------------------------------ */

/** 轻量本地分类，仅用于列表气候角标，不做任何伪量化打分 */
function tagOf(text: string): string | undefined {
  if (/(焦虑|裁员|35岁|失业|上岸|考研|考编|转行|内卷|躺平)/.test(text)) return "人生选择";
  if (/(AI|大模型|芯片|算法|开源|程序员|编程)/i.test(text)) return "科技";
  if (/(恋爱|分手|婚姻|相亲|感情|家庭)/.test(text)) return "情感";
  if (/(为什么|如何看待|怎么回事|是什么体验)/.test(text)) return "热点";
  return undefined;
}

export async function getHotList(limit = 30): Promise<ApiResult<HotItem[]>> {
  if (!zhihuConfigured) {
    return { data: [], degraded: true, reason: "ZHIHU_ACCESS_SECRET 未配置" };
  }
  try {
    const { value, hit } = await cached(`hot:${limit}`, TTL.HOT, async () => {
      const data = await get<unknown>("/api/v1/content/hot_list", { Limit: limit });
      return digItems(data).map((raw, i) => {
        const title = stripHtml(raw.Title ?? "");
        const summary = stripHtml(raw.Summary ?? "");
        return {
          id: String(raw.ContentID ?? raw.Url ?? `hot_${i}`),
          title,
          url: raw.Url ?? "https://www.zhihu.com",
          summary,
          thumbnailUrl: raw.ThumbnailUrl || undefined,
          tag: tagOf(`${title}${summary}`),
        } satisfies HotItem;
      });
    });
    return { data: value, degraded: false, cacheHit: hit };
  } catch (e) {
    return { data: [], degraded: true, reason: (e as Error).message };
  }
}

/* ------------------------------------------------------------------ *
 * 站内搜索 —— 5000 次/天，主力双用途接口（Count 最大 10）
 * ------------------------------------------------------------------ */

export async function searchZhihu(query: string, count = 10): Promise<ApiResult<ZhihuItem[]>> {
  if (!zhihuConfigured) return { data: [], degraded: true, reason: "未配置 Key" };
  const q = query.trim();
  if (!q) return { data: [], degraded: true, reason: "空查询" };
  const n = Math.min(10, Math.max(1, count));
  try {
    const { value, hit } = await cached(
      `zs:${normalizeQuery(q)}:${n}`,
      TTL.SEARCH,
      async () => {
        const data = await get<unknown>("/api/v1/content/zhihu_search", { Query: q, Count: n });
        return digItems(data).map(normalizeItem);
      },
    );
    return { data: value, degraded: false, cacheHit: hit };
  } catch (e) {
    return { data: [], degraded: true, reason: (e as Error).message };
  }
}

/* ------------------------------------------------------------------ *
 * 全网搜索 —— 5000 次/天，猫头鹰的站外客观坐标
 * 注意：Filter 不可传 host=="zhihu.com"
 * ------------------------------------------------------------------ */

export async function searchGlobal(query: string, count = 5): Promise<ApiResult<ZhihuItem[]>> {
  if (!zhihuConfigured) return { data: [], degraded: true, reason: "未配置 Key" };
  const q = query.trim();
  if (!q) return { data: [], degraded: true, reason: "空查询" };
  const n = Math.min(20, Math.max(1, count));
  try {
    const { value, hit } = await cached(
      `gs:${normalizeQuery(q)}:${n}`,
      TTL.SEARCH,
      async () => {
        const data = await get<unknown>("/api/v1/content/global_search", {
          Query: q,
          Count: n,
          SearchDB: "all",
        });
        return digItems(data).map(normalizeItem);
      },
    );
    return { data: value, degraded: false, cacheHit: hit };
  } catch (e) {
    return { data: [], degraded: true, reason: (e as Error).message };
  }
}

/* ------------------------------------------------------------------ *
 * 额度查询 —— 不耗额度；接近阈值时自动延长缓存 TTL
 * ------------------------------------------------------------------ */

export async function getQuota(): Promise<QuotaState> {
  if (!zhihuConfigured) {
    return { live: false, items: [], note: "未配置 ZHIHU_ACCESS_SECRET · 以缓存与兜底运行" };
  }
  try {
    const data = await get<unknown>("/api/v1/quota", {});
    const arr = Array.isArray(data) ? data : [];
    const items = arr.map((r) => {
      const o = r as Record<string, unknown>;
      return {
        apiId: String(o.APIID ?? ""),
        apiName: String(o.APIName ?? o.APIID ?? ""),
        total: num(o.TotalQuota),
        used: num(o.TotalUsed),
        remaining: num(o.RemainingQuota),
      };
    });

    // 任一主力接口剩余不足 15% 时，整体抬高 TTL 倍率防爆仓
    const tight = items.some(
      (i) => i.total > 0 && i.remaining / i.total < 0.15,
    );
    setTtlMultiplier(tight ? 4 : 1);

    const watch = items.filter((i) =>
      ["hot_list", "zhihu_search", "global_search"].includes(i.apiId),
    );
    const brief = (watch.length ? watch : items.slice(0, 3))
      .map((i) => `${i.apiName} ${i.remaining}/${i.total}`)
      .join(" · ");

    return { live: true, items, note: brief || "额度正常" };
  } catch (e) {
    return { live: false, items: [], note: `额度查询失败：${(e as Error).message}` };
  }
}
