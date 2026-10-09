import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getFreshCache } from "@/server/precompute";
import { generateReviewSheet } from "@/server/review";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { subjectId?: string };
  if (!body.subjectId) {
    return NextResponse.json({ error: "subjectId is required" }, { status: 400 });
  }

  const cached = getFreshCache("review", body.subjectId);
  if (cached) return NextResponse.json({ ...(cached.payload as object), cachedAt: cached.cachedAt });

  try {
    const result = await generateReviewSheet(body.subjectId);
    return NextResponse.json({ ...result, cachedAt: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
