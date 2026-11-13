import { NextResponse } from "next/server";
import { getPolicy, resetAll, updatePolicy, type Policy } from "@/lib/store";

export async function GET() {
  return NextResponse.json(await getPolicy());
}

// Partial update, e.g. { "paused": true } or { "per_call_max_usdc": 0.05 }.
// { "reset": true } restores defaults and clears the ledger.
export async function POST(req: Request) {
  const body = await req.json();
  if (body.reset) {
    await resetAll();
    return NextResponse.json(await getPolicy());
  }
  const allowed: (keyof Policy)[] = [
    "per_call_max_usdc", "per_day_max_usdc", "per_merchant_max_usdc", "allowlist", "expires_at", "paused",
  ];
  const patch = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k as keyof Policy)));
  return NextResponse.json(await updatePolicy(patch as Partial<Policy>));
}
