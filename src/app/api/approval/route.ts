import { NextResponse } from "next/server";
import { payAndFetch } from "@/lib/payments";
import { listReceipts, updateReceipt } from "@/lib/store";

// The owner's answer to an approval request: { id, decision: "approve" | "deny" }.
// Approving makes one payment with the spending caps lifted.
export async function POST(req: Request) {
  const { id, decision } = await req.json();
  const request = (await listReceipts()).find((r) => r.id === id);
  if (!request || request.status !== "pending_approval") {
    return NextResponse.json({ error: "No open approval request with that id." }, { status: 404 });
  }
  if (decision === "deny") {
    await updateReceipt(id, { status: "denied", detail: "Denied by the account owner." });
    return NextResponse.json({ ok: true });
  }
  const result = await payAndFetch(request.merchant, `Approved by owner: ${request.reason}`, { approved: true });
  await updateReceipt(
    id,
    result.ok
      ? { status: "approved", detail: "Approved by the account owner and paid (see the entry above)." }
      : { detail: `Approval tried to pay but failed: ${result.error}` },
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 402 });
}
