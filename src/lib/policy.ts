// The policy engine. Pure function: given the policy, the spend history and a
// proposed payment, decide allow or block. The first failing rule wins.
import type { Policy, Receipt } from "./store";

export type Proposed = {
  merchant: string;
  amountUsdc: number;
  payTo: string;
  expectedPayTo: string;
  listedUsdc: number; // the price on the merchant's listing
  name?: string;
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

// Spend that went through on auto-approval today, against its own allowance.
export function autoApprovedToday(receipts: Receipt[], now = new Date()) {
  const today = utcDay(now.toISOString());
  return receipts
    .filter((r) => r.status === "paid" && r.auto_approved && utcDay(r.created_at) === today)
    .reduce((s, r) => s + r.amount_usdc, 0);
}

export const CAP_RULES = new Set(["per_call_cap", "per_day_cap", "per_merchant_cap"]);

// Small purchases from a merchant the agent has already paid can go past a
// cap without waiting for the owner, up to a separate daily allowance.
export function autoApproves(policy: Policy, receipts: Receipt[], p: Proposed, rule: string, now = new Date()) {
  if (!CAP_RULES.has(rule) || policy.auto_approve_max_usdc <= 0) return false;
  if (p.amountUsdc > policy.auto_approve_max_usdc) return false;
  if (!receipts.some((r) => r.status === "paid" && r.merchant === p.merchant)) return false;
  return round(autoApprovedToday(receipts, now) + p.amountUsdc) <= policy.auto_approve_daily_usdc;
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
  if (p.payTo !== p.expectedPayTo) {
    return {
      allow: false,
      rule: "payee_mismatch",
      message: `Merchant asked to be paid at ${p.payTo}, expected ${p.expectedPayTo}.`,
    };
  }
  // A merchant that asks for more at checkout than its listed price is
  // refused outright. An approval can't lift this one.
  if (p.amountUsdc > p.listedUsdc + 1e-6) {
    return {
      allow: false,
      rule: "price_changed",
      message: `${p.name ?? p.merchant} is listed at $${p.listedUsdc.toFixed(2)} but asked for $${p.amountUsdc.toFixed(2)} at checkout.`,
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
