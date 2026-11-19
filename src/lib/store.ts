// Storage for the policy and the receipt ledger.
// Local JSON file for now; swap for Supabase before deploying to Vercel.
import { promises as fs } from "node:fs";
import path from "node:path";
import { MERCHANTS } from "./merchants";

export type Policy = {
  per_call_max_usdc: number;
  per_day_max_usdc: number;
  per_merchant_max_usdc: number;
  allowlist: string[]; // merchant ids
  expires_at: string; // ISO timestamp
  paused: boolean;
  purpose_check: boolean; // second AI check: does this payment serve the owner's task?
  attack_demo: boolean; // demo only: the FX merchant's reply carries a prompt injection
};

export type ReceiptStatus = "paid" | "blocked" | "pending_approval" | "approved" | "denied" | "failed";

export type Receipt = {
  id: string;
  created_at: string;
  merchant: string;
  url: string;
  amount_usdc: number;
  reason: string;
  status: ReceiptStatus;
  rule_hit?: string;
  detail?: string;
  tx_signature?: string;
  task?: string;
};

type Db = { policy: Policy; receipts: Receipt[] };

const DATA_FILE = path.join(process.cwd(), "data", "db.json");

export function defaultPolicy(): Policy {
  return {
    per_call_max_usdc: 15,
    per_day_max_usdc: 40,
    per_merchant_max_usdc: 20,
    allowlist: MERCHANTS.map((m) => m.id),
    expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    paused: false,
    purpose_check: true,
    attack_demo: false,
  };
}

async function load(): Promise<Db> {
  try {
    const db: Db = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
    db.policy = { ...defaultPolicy(), ...db.policy }; // fills fields added after the file was written
    return db;
  } catch {
    return { policy: defaultPolicy(), receipts: [] };
  }
}

async function save(db: Db) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2));
}

export async function getPolicy(): Promise<Policy> {
  return (await load()).policy;
}

export async function updatePolicy(patch: Partial<Policy>): Promise<Policy> {
  const db = await load();
  db.policy = { ...db.policy, ...patch };
  await save(db);
  return db.policy;
}

export async function listReceipts(): Promise<Receipt[]> {
  return (await load()).receipts.slice().reverse();
}

export async function addReceipt(r: Omit<Receipt, "id" | "created_at">): Promise<Receipt> {
  const db = await load();
  const receipt: Receipt = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...r };
  db.receipts.push(receipt);
  await save(db);
  return receipt;
}

export async function updateReceipt(id: string, patch: Partial<Receipt>): Promise<Receipt | null> {
  const db = await load();
  const r = db.receipts.find((x) => x.id === id);
  if (!r) return null;
  Object.assign(r, patch);
  await save(db);
  return r;
}

export async function resetAll() {
  await save({ policy: defaultPolicy(), receipts: [] });
}
