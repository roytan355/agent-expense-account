import { NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { paidRoute, resourceServer } from "@/lib/x402-server";

async function handler() {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true",
    { cache: "no-store" },
  );
  const data = await res.json();
  return NextResponse.json({
    pair: "SOL/USD",
    price: data.solana?.usd,
    change_24h_pct: data.solana?.usd_24h_change,
    as_of: new Date().toISOString(),
  });
}

export const GET = withX402(handler, paidRoute("sol-price"), resourceServer);
