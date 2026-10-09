import { connection } from "next/server";
import { NextResponse } from "next/server";
import { listSubjects, otherDocumentCount } from "@/server/subjects";

export async function GET() {
  await connection(); // subjects change at runtime; opt out of static prerendering
  const subjects = listSubjects();
  const otherCount = otherDocumentCount();
  const total = subjects.reduce((sum, s) => sum + s.count, 0) + otherCount;
  return NextResponse.json({ subjects, otherCount, total });
}
