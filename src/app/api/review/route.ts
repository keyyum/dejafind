import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { generateReviewSheet } from "@/server/review";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { subjectId?: string };
  if (!body.subjectId) {
    return NextResponse.json({ error: "subjectId is required" }, { status: 400 });
  }
  try {
    const result = await generateReviewSheet(body.subjectId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
