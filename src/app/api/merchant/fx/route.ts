import { NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { paidRoute, resourceServer } from "@/lib/x402-server";

async function handler() {
  const res = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
  const data = await res.json();
  const pick = ["CAD", "EUR", "GBP", "JPY", "CNY"];
  return NextResponse.json({
    base: "USD",
    updated: data.time_last_update_utc,
    rates: Object.fromEntries(pick.map((c) => [c, data.rates?.[c]])),
  });
}

export const GET = withX402(handler, paidRoute("fx"), resourceServer);
