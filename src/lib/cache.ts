/**
 * 进程内 TTL 缓存（施工蓝图 §1.5）
 * AiWorks 不支持独立数据库写入，因此服务端一律使用进程内存缓存，
 * 不引入 MySQL / PostgreSQL / Redis，也不做本地文件写入。
 *
 * 额度防爆仓：hot_list 15 分钟、search 30 分钟（§4.2）。
 */

interface Entry<T> {
  value: T;
  expireAt: number;
}

const store = new Map<string, Entry<unknown>>();

/** 剩余额度紧张时由调用方抬高倍率，自动延长 TTL */
let ttlMultiplier = 1;

export function setTtlMultiplier(m: number): void {
  ttlMultiplier = Math.max(1, Math.min(8, m));
}

export function getTtlMultiplier(): number {
  return ttlMultiplier;
}

export function cacheGet<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expireAt) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlSeconds: number): void {
  store.set(key, { value, expireAt: Date.now() + ttlSeconds * ttlMultiplier * 1000 });
  // 轻量清理，避免长时间运行后 Map 无限膨胀
  if (store.size > 400) {
    const now = Date.now();
    for (const [k, v] of store) if (now > v.expireAt) store.delete(k);
  }
}

/** 读穿透：命中直接返回；未命中执行 loader 并回填 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<{ value: T; hit: boolean }> {
  const hit = cacheGet<T>(key);
  if (hit !== null) return { value: hit, hit: true };
  const value = await loader();
  cacheSet(key, value, ttlSeconds);
  return { value, hit: false };
}

/** Query 规范化：避免大小写/空格差异导致缓存击穿 */
export function normalizeQuery(q: string): string {
  return q.trim().replace(/\s+/g, " ").toLowerCase();
}

export const TTL = {
  HOT: 15 * 60,
  SEARCH: 30 * 60,
  ROUNDTABLE: 30 * 60,
} as const;
