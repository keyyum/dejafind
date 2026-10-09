import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { listTimeline } from "@/server/documents";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 50;
  const all = searchParams.get("all") === "1";
  const entries = listTimeline(from, Number.isFinite(limit) && limit > 0 ? limit : 50, all);
  return NextResponse.json({ entries });
}
