/** GET /api/zhihu/quota —— 额度监控（不耗额度），紧张时自动延长缓存 TTL */
import { NextResponse } from "next/server";
import { getQuota } from "@/lib/zhihu-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getQuota());
}
