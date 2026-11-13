import { NextResponse } from "next/server";
import { spentToday, spentWithMerchant } from "@/lib/policy";
import { MERCHANTS } from "@/lib/merchants";
import { getPolicy, listReceipts } from "@/lib/store";

export async function GET() {
  const [policy, receipts] = await Promise.all([getPolicy(), listReceipts()]);
  return NextResponse.json({
    policy,
    spent_today: spentToday(receipts),
    spent_by_merchant: Object.fromEntries(MERCHANTS.map((m) => [m.id, spentWithMerchant(receipts, m.id)])),
    receipts,
  });
}
