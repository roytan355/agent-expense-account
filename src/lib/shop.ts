// Leash Shop: a demo store whose products are sold over x402, so the agent
// buys a cable or a gift card the same way it buys data. Nothing ships; the
// reply is an order confirmation.
import { NextResponse } from "next/server";
import { merchantById } from "./merchants";

export function orderHandler(id: string) {
  return async () => {
    const m = merchantById(id)!;
    const now = new Date();
    const digital = id === "gift-card";
    return NextResponse.json({
      store: "Leash Shop (demo store, nothing ships)",
      order_id: `LS-${now.getTime().toString(36).toUpperCase()}`,
      item: m.name,
      price_usd: m.priceUsd,
      status: "confirmed",
      ...(digital
        ? { delivery: "Code sent to the email on file", code: `LEASH-${Math.random().toString(36).slice(2, 8).toUpperCase()}` }
        : { ships_to: "Address on file", estimated_delivery: new Date(now.getTime() + 2 * 864e5).toDateString() }),
      ordered_at: now.toISOString(),
    });
  };
}
