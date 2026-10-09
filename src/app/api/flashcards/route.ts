import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { generateFlashcards, type FlashcardsRequest } from "@/server/flashcards";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as FlashcardsRequest;
  if (!body.subjectId && (!body.documentIds || body.documentIds.length === 0)) {
    return NextResponse.json({ error: "subjectId or documentIds is required" }, { status: 400 });
  }
  try {
    const result = await generateFlashcards(body);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
