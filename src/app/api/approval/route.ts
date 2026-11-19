import { NextResponse } from "next/server";
import { decide } from "@/lib/approvals";

// The owner's answer to an approval request: { id, decision: "approve" | "deny" }.
export async function POST(req: Request) {
  const { id, decision } = await req.json();
  const result = await decide(String(id), decision === "deny" ? "deny" : "approve");
  if ("notFound" in result && result.notFound) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json(result, { status: result.ok ? 200 : 402 });
}
