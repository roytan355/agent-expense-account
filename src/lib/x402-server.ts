// Merchant side: one x402 resource server shared by every paid route.
import { HTTPFacilitatorClient } from "@x402/core/server";
import { x402ResourceServer } from "@x402/next";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { SOLANA_DEVNET, env } from "./config";
import { merchantById } from "./merchants";

const facilitator = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL ?? "https://x402.org/facilitator",
});

export const resourceServer = new x402ResourceServer(facilitator).register(
  SOLANA_DEVNET,
  new ExactSvmScheme(),
);

// Payment config for a merchant route, built from the catalog so the price
// the agent sees always matches what the route charges.
export function paidRoute(merchantId: string) {
  const m = merchantById(merchantId);
  if (!m) throw new Error(`Unknown merchant ${merchantId}`);
  return {
    accepts: [
      {
        scheme: "exact" as const,
        price: `$${m.priceUsd.toFixed(2)}`,
        network: SOLANA_DEVNET,
        payTo: env("MERCHANT_PAY_TO"),
        maxTimeoutSeconds: 60,
      },
    ],
    description: m.description,
  };
}
