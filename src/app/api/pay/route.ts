import { NextResponse } from "next/server";
import { payAndFetch } from "@/lib/payments";

// Manual payment trigger for testing and the dashboard: { merchant, reason }.
export async function POST(req: Request) {
  const { merchant, reason } = await req.json();
  const result = await payAndFetch(String(merchant), String(reason ?? "manual test"));
  return NextResponse.json(result, { status: result.ok ? 200 : 402 });
}
