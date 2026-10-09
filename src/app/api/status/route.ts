import { NextResponse } from "next/server";
import { getStatus } from "@/server/status";

export async function GET() {
  return NextResponse.json(await getStatus());
}
