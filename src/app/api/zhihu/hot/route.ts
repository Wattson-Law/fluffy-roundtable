/** GET /api/zhihu/hot —— 真实知乎热榜（15 分钟服务端缓存） */
import { NextRequest, NextResponse } from "next/server";
import { getHotList } from "@/lib/zhihu-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 30);
  const r = await getHotList(Number.isFinite(limit) ? Math.min(50, Math.max(5, limit)) : 30);
  return NextResponse.json({
    items: r.data,
    degraded: r.degraded,
    cacheHit: r.cacheHit ?? false,
    reason: r.reason,
  });
}
