// Checks the keys load as Solana signers and prints SOL + USDC balances.
// Usage: node --env-file=.env.local scripts/check-wallets.mjs [airdrop]
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";

const RPC = process.env.SOLANA_RPC_URL;
const USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const rpc = (method, params) =>
  fetch(RPC, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }).then(r => r.json());

for (const [name, key] of [["agent", process.env.SVM_PRIVATE_KEY], ["merchant", process.env.MERCHANT_PRIVATE_KEY]]) {
  const signer = await createKeyPairSignerFromBytes(base58.decode(key));
  if (process.argv[2] === "airdrop") console.log(name, "airdrop:", JSON.stringify(await rpc("requestAirdrop", [signer.address, 1e9])));
  const sol = (await rpc("getBalance", [signer.address])).result?.value ?? 0;
  const tok = await rpc("getTokenAccountsByOwner", [signer.address, { mint: USDC }, { encoding: "jsonParsed" }]);
  const usdc = (tok.result?.value ?? []).reduce((s, a) => s + a.account.data.parsed.info.tokenAmount.uiAmount, 0);
  console.log(`${name.padEnd(8)} ${signer.address}  SOL ${sol / 1e9}  USDC ${usdc}`);
}
