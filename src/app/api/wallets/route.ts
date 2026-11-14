import { NextResponse } from "next/server";
import { DEVNET_USDC_MINT } from "@/lib/config";

const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

async function rpc(method: string, params: unknown[]) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  return res.json();
}

type TokenAccount = { account: { data: { parsed: { info: { tokenAmount: { uiAmount: number } } } } } };

async function balances(address: string) {
  const [sol, tok] = await Promise.all([
    rpc("getBalance", [address]),
    rpc("getTokenAccountsByOwner", [address, { mint: DEVNET_USDC_MINT }, { encoding: "jsonParsed" }]),
  ]);
  const usdc = ((tok.result?.value ?? []) as TokenAccount[]).reduce(
    (s, a) => s + a.account.data.parsed.info.tokenAmount.uiAmount,
    0,
  );
  return { address, sol: (sol.result?.value ?? 0) / 1e9, usdc };
}

// Public addresses and live devnet balances for the dashboard header.
export async function GET() {
  const [agent, merchant] = await Promise.all([
    balances(process.env.AGENT_ADDRESS ?? ""),
    balances(process.env.MERCHANT_PAY_TO ?? ""),
  ]);
  return NextResponse.json({ agent, merchant }, { headers: { "cache-control": "no-store" } });
}
