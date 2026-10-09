import type { NextRequest } from "next/server";
import { connection, NextResponse } from "next/server";
import type { ScheduleConfirmRequest } from "@/lib/api-types";
import { emitEvent } from "@/server/events";
import { confirmSchedule, getScheduleResponse } from "@/server/subjects";

export async function GET() {
  await connection(); // schedule changes at runtime; opt out of static prerendering
  return NextResponse.json(getScheduleResponse());
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ScheduleConfirmRequest;
  try {
    const { response, newSubjects } = confirmSchedule(body.documentId, body.confirm);
    for (const subject of newSubjects) emitEvent({ type: "subject.created", subject });
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
