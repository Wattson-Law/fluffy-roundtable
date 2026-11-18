/**
 * GET /api/zhihu/search —— 站内搜索（30 分钟缓存）
 * 双用途：① 点开热榜标题拉取该问题下真实回答列表；② 顶部搜索任意关键词
 */
import { NextRequest, NextResponse } from "next/server";
import { searchZhihu } from "@/lib/zhihu-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ items: [], degraded: true, reason: "缺少查询词" }, { status: 400 });
  }
  const count = Number(req.nextUrl.searchParams.get("count") ?? 10);
  const r = await searchZhihu(q, Number.isFinite(count) ? count : 10);
  return NextResponse.json({
    items: r.data,
    query: q,
    degraded: r.degraded,
    cacheHit: r.cacheHit ?? false,
    reason: r.reason,
  });
}
