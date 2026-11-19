// Agent side: the only code path that can move the agent's money.
// Every payment goes through the policy engine inside the x402 client's
// onBeforePaymentCreation hook, before anything gets signed.
import { createKeyPairSignerFromBytes, type KeyPairSigner } from "@solana/kit";
import { base58 } from "@scure/base";
import { decodePaymentResponseHeader, wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { SOLANA_DEVNET, USDC_DECIMALS, baseUrl, env } from "./config";
import { merchantById } from "./merchants";
import { purposeCheck } from "./guard";
import { evaluate } from "./policy";
import { addReceipt, getPolicy, listReceipts, type Receipt } from "./store";

let signerPromise: Promise<KeyPairSigner> | null = null;
function agentSigner() {
  signerPromise ??= createKeyPairSignerFromBytes(base58.decode(env("SVM_PRIVATE_KEY")));
  return signerPromise;
}

// Payments run one at a time so two calls can't both squeeze under a cap.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export type PayResult =
  | { ok: true; receipt: Receipt; data: unknown }
  | { ok: false; receipt: Receipt; error: string };

// An owner approval lifts the spending caps for one payment. Pause, expiry,
// the allowlist and the payee check still apply.
const CAP_RULES = new Set(["per_call_cap", "per_day_cap", "per_merchant_cap"]);

export function payAndFetch(
  merchantId: string,
  reason: string,
  opts: { approved?: boolean; task?: string } = {},
): Promise<PayResult> {
  return serial(() => payAndFetchInner(merchantId, reason, opts.approved ?? false, opts.task));
}

async function payAndFetchInner(merchantId: string, reason: string, approved: boolean, task?: string): Promise<PayResult> {
  const merchant = merchantById(merchantId);
  const url = merchant ? `${baseUrl()}${merchant.path}` : merchantId;

  if (!merchant) {
    const receipt = await addReceipt({
      merchant: merchantId, url, amount_usdc: 0, reason, task, status: "blocked",
      rule_hit: "allowlist", detail: `Unknown merchant "${merchantId}".`,
    });
    return { ok: false, receipt, error: receipt.detail! };
  }

  const signer = await agentSigner();
  const client = x402Client.fromConfig({
    schemes: [{ network: SOLANA_DEVNET, client: new ExactSvmScheme(signer, { rpcUrl: process.env.SOLANA_RPC_URL }) }],
    // Library safety net set well above our own caps, so every block comes
    // from our policy engine and ends up in the ledger.
    spendControls: { maxAmountPerPayment: "$100" },
  });

  let amountUsdc = merchant.priceUsd;
  let blocked: { rule: string; message: string } | null = null;

  client.onBeforePaymentCreation(async (ctx) => {
    const req = ctx.selectedRequirements;
    amountUsdc = Number(req.amount) / 10 ** USDC_DECIMALS;
    const policy = await getPolicy();
    const decision = evaluate(policy, await listReceipts(), {
      merchant: merchant.id,
      amountUsdc,
      payTo: req.payTo,
      expectedPayTo: env("MERCHANT_PAY_TO"),
    });
    if (!decision.allow && !(approved && CAP_RULES.has(decision.rule))) {
      blocked = { rule: decision.rule, message: decision.message };
      return { abort: true, reason: decision.message };
    }
    // The owner already looked at an approved payment, so it skips this check.
    if (policy.purpose_check && task && !approved) {
      const v = await purposeCheck({ task, merchant, amountUsdc, reason });
      if (!v.allow) {
        blocked = { rule: "purpose_check", message: v.reason };
        return { abort: true, reason: v.reason };
      }
    }
  });

  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  try {
    const res = await fetchWithPayment(url, { method: "GET" });
    if (!res.ok) {
      const body = await res.text();
      // On a rejected payment the facilitator's reason is in this header, not the body.
      const required = res.headers.get("PAYMENT-REQUIRED");
      let why = body.slice(0, 300);
      if (required) {
        try { why = decodePaymentRequiredHeader(required).error ?? why; } catch {}
      }
      const receipt = await addReceipt({
        merchant: merchant.id, url, amount_usdc: amountUsdc, reason, task, status: "failed",
        detail: `HTTP ${res.status}: ${why}`,
      });
      return { ok: false, receipt, error: receipt.detail! };
    }
    const header = res.headers.get("PAYMENT-RESPONSE");
    const settle = header ? decodePaymentResponseHeader(header) : null;
    const data = await res.json();
    const receipt = await addReceipt({
      merchant: merchant.id, url, amount_usdc: amountUsdc, reason, task, status: "paid",
      tx_signature: settle?.transaction,
    });
    return { ok: true, receipt, data };
  } catch (err) {
    const b = blocked as { rule: string; message: string } | null;
    if (b) {
      const receipt = await addReceipt({
        merchant: merchant.id, url, amount_usdc: amountUsdc, reason, task, status: "blocked",
        rule_hit: b.rule, detail: b.message,
      });
      return { ok: false, receipt, error: b.message };
    }
    const message = err instanceof Error ? err.message : String(err);
    const receipt = await addReceipt({
      merchant: merchant.id, url, amount_usdc: amountUsdc, reason, task, status: "failed", detail: message,
    });
    return { ok: false, receipt, error: message };
  }
}
