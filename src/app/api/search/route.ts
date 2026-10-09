import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { SearchRequest } from "@/lib/api-types";
import { search } from "@/server/search";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as SearchRequest;
  if (!body.q || !body.q.trim()) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }
  const response = await search(body);
  return NextResponse.json(response);
}
