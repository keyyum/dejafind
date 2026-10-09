import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { QuizRequest } from "@/lib/api-types";
import { getFreshCache } from "@/server/precompute";
import { generateQuiz } from "@/server/quiz";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as QuizRequest;
  if (!body.subjectId && (!body.documentIds || body.documentIds.length === 0)) {
    return NextResponse.json({ error: "subjectId or documentIds is required" }, { status: 400 });
  }

  if (body.subjectId && !body.documentIds) {
    const cached = getFreshCache("quiz", body.subjectId);
    if (cached) return NextResponse.json({ ...(cached.payload as object), cachedAt: cached.cachedAt });
  }

  try {
    const quiz = await generateQuiz(body);
    return NextResponse.json({ ...quiz, cachedAt: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
