// The policy engine. Pure function: given the policy, the spend history and a
// proposed payment, decide allow or block. The first failing rule wins.
import type { Policy, Receipt } from "./store";

export type Proposed = {
  merchant: string;
  amountUsdc: number;
  payTo: string;
  expectedPayTo: string;
};

export type Decision = { allow: true } | { allow: false; rule: string; message: string };

// Day boundary is UTC so it never shifts with the server's timezone.
const utcDay = (iso: string) => iso.slice(0, 10);

export function spentToday(receipts: Receipt[], now = new Date()) {
  const today = utcDay(now.toISOString());
  return receipts
    .filter((r) => r.status === "paid" && utcDay(r.created_at) === today)
    .reduce((s, r) => s + r.amount_usdc, 0);
}

export function spentWithMerchant(receipts: Receipt[], merchant: string) {
  return receipts
    .filter((r) => r.status === "paid" && r.merchant === merchant)
    .reduce((s, r) => s + r.amount_usdc, 0);
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

export function evaluate(
  policy: Policy,
  receipts: Receipt[],
  p: Proposed,
  now = new Date(),
): Decision {
  if (policy.paused) {
    return { allow: false, rule: "paused", message: "Spending is paused by the account owner." };
  }
  if (now > new Date(policy.expires_at)) {
    return { allow: false, rule: "expired", message: `Policy expired at ${policy.expires_at}.` };
  }
  if (!policy.allowlist.includes(p.merchant)) {
    return { allow: false, rule: "allowlist", message: `Merchant "${p.merchant}" is not on the allowlist.` };
  }
  if (p.payTo !== p.expectedPayTo) {
    return {
      allow: false,
      rule: "payee_mismatch",
      message: `Merchant asked to be paid at ${p.payTo}, expected ${p.expectedPayTo}.`,
    };
  }
  if (p.amountUsdc > policy.per_call_max_usdc) {
    return {
      allow: false,
      rule: "per_call_cap",
      message: `$${p.amountUsdc} is over the per-call cap of $${policy.per_call_max_usdc}.`,
    };
  }
  const day = round(spentToday(receipts, now) + p.amountUsdc);
  if (day > policy.per_day_max_usdc) {
    return {
      allow: false,
      rule: "per_day_cap",
      message: `This would bring today's spend to $${day}, over the daily cap of $${policy.per_day_max_usdc}.`,
    };
  }
  const merch = round(spentWithMerchant(receipts, p.merchant) + p.amountUsdc);
  if (merch > policy.per_merchant_max_usdc) {
    return {
      allow: false,
      rule: "per_merchant_cap",
      message: `This would bring spend with "${p.merchant}" to $${merch}, over the per-merchant cap of $${policy.per_merchant_max_usdc}.`,
    };
  }
  return { allow: true };
}
