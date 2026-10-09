import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { QuizRequest } from "@/lib/api-types";
import { generateQuiz } from "@/server/quiz";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as QuizRequest;
  if (!body.subjectId && (!body.documentIds || body.documentIds.length === 0)) {
    return NextResponse.json({ error: "subjectId or documentIds is required" }, { status: 400 });
  }
  try {
    const quiz = await generateQuiz(body);
    return NextResponse.json(quiz);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
