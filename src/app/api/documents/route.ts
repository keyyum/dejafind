import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { listDocuments } from "@/server/documents";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const subject = searchParams.get("subject");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 200;
  const response = listDocuments(subject, Number.isFinite(limit) && limit > 0 ? limit : 200);
  return NextResponse.json(response);
}
