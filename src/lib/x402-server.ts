// Merchant side: one x402 resource server shared by every paid route.
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";
import { x402Facilitator } from "@x402/core/facilitator";
import { HTTPFacilitatorClient, type FacilitatorClient } from "@x402/core/server";
import { x402ResourceServer } from "@x402/next";
import { toFacilitatorSvmSigner } from "@x402/svm";
import { registerExactSvmScheme } from "@x402/svm/exact/facilitator";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { SOLANA_DEVNET, env } from "./config";
import { merchantById } from "./merchants";

// Default: our own facilitator, running in-process with our fee-payer wallet
// and RPC. The shared x402.org facilitator kept failing settlement on devnet
// with RPC rate limits (429), so we only use it when FACILITATOR_URL is set.
function localFacilitator(): FacilitatorClient {
  const ready = (async () => {
    const signer = await createKeyPairSignerFromBytes(base58.decode(env("FACILITATOR_PRIVATE_KEY")));
    const f = new x402Facilitator();
    registerExactSvmScheme(f, {
      signer: toFacilitatorSvmSigner(signer, { defaultRpcUrl: process.env.SOLANA_RPC_URL }),
      networks: SOLANA_DEVNET,
    });
    return f;
  })();
  return {
    verify: async (payload, req) => (await ready).verify(payload, req),
    settle: async (payload, req) => (await ready).settle(payload, req),
    getSupported: async () => (await ready).getSupported() as Awaited<ReturnType<FacilitatorClient["getSupported"]>>,
  };
}

const facilitator: FacilitatorClient = process.env.FACILITATOR_URL
  ? new HTTPFacilitatorClient({ url: process.env.FACILITATOR_URL })
  : localFacilitator();

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
