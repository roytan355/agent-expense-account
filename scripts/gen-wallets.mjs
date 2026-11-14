// Generates the agent and merchant devnet wallets and writes them to .env.local.
// Run once: node scripts/gen-wallets.mjs
import { generateKeyPairSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { base58 } from "@scure/base";

function newWallet() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const seed = privateKey.export({ format: "der", type: "pkcs8" }).subarray(-32);
  const pub = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  return {
    secret: base58.encode(Buffer.concat([seed, pub])), // 64-byte Solana secret key
    address: base58.encode(pub),
  };
}

const envPath = ".env.local";
const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
if (existing.includes("SVM_PRIVATE_KEY=")) {
  console.log("Wallets already exist in .env.local, not overwriting.");
  process.exit(0);
}

const agent = newWallet();
const merchant = newWallet();
const lines = [
  "# Agent wallet (pays). Server only, never expose.",
  `SVM_PRIVATE_KEY=${agent.secret}`,
  `AGENT_ADDRESS=${agent.address}`,
  "# Merchant wallet (receives).",
  `MERCHANT_PRIVATE_KEY=${merchant.secret}`,
  `MERCHANT_PAY_TO=${merchant.address}`,
  "SOLANA_RPC_URL=https://api.devnet.solana.com",
  "# FACILITATOR_URL=https://x402.org/facilitator  (unset = in-process facilitator)",
  "ANTHROPIC_API_KEY=",
  "",
];
writeFileSync(envPath, existing + lines.join("\n"));
console.log("Agent address:   ", agent.address);
console.log("Merchant address:", merchant.address);
