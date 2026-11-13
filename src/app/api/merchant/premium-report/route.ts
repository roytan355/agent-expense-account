import { NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { paidRoute, resourceServer } from "@/lib/x402-server";

// Priced above the default per-call cap so the demo can show a block.
async function handler() {
  return NextResponse.json({
    title: "Premium Market Report",
    body: "Placeholder report content. This route exists to be expensive.",
    as_of: new Date().toISOString(),
  });
}

export const GET = withX402(handler, paidRoute("premium-report"), resourceServer);
