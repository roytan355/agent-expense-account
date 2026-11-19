// The owner's answer to an approval request, shared by the web console and
// the Telegram bot. Approving makes one payment with the spending caps lifted.
import { payAndFetch, type PayResult } from "./payments";
import { listReceipts, updateReceipt } from "./store";

export type Decision = "approve" | "deny";

export async function decide(
  id: string,
  decision: Decision,
): Promise<{ ok: false; error: string; notFound?: boolean } | { ok: true; denied: true } | PayResult> {
  const request = (await listReceipts()).find((r) => r.id === id);
  if (!request || request.status !== "pending_approval") {
    return { ok: false, error: "No open approval request with that id.", notFound: true };
  }
  if (decision === "deny") {
    await updateReceipt(id, { status: "denied", detail: "Denied by the account owner." });
    return { ok: true, denied: true };
  }
  const result = await payAndFetch(request.merchant, `Approved by owner: ${request.reason}`, { approved: true, task: request.task });
  await updateReceipt(
    id,
    result.ok
      ? { status: "approved", detail: "Approved by the account owner and paid (see the entry above)." }
      : { detail: `Approval tried to pay but failed: ${result.error}` },
  );
  return result;
}
