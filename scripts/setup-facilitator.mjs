// Creates the facilitator fee-payer wallet (it pays Solana fees when settling
// x402 payments) and funds it with devnet SOL from the agent wallet.
// Run once: node --env-file=.env.local scripts/setup-facilitator.mjs [sol=2]
import { generateKeyPairSync } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { base58 } from "@scure/base";
import {
  appendTransactionMessageInstruction, createKeyPairSignerFromBytes, createSolanaRpc,
  createSolanaRpcSubscriptions, createTransactionMessage, lamports, pipe,
  sendAndConfirmTransactionFactory, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash, signTransactionMessageWithSigners,
  getSignatureFromTransaction, address,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";

const envPath = ".env.local";
const env = readFileSync(envPath, "utf8");
let feePayerAddress = process.env.FACILITATOR_ADDRESS;

if (!env.includes("FACILITATOR_PRIVATE_KEY=")) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const seed = privateKey.export({ format: "der", type: "pkcs8" }).subarray(-32);
  const pub = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  feePayerAddress = base58.encode(pub);
  appendFileSync(
    envPath,
    [
      "# Facilitator fee payer (pays Solana fees when settling). Server only.",
      `FACILITATOR_PRIVATE_KEY=${base58.encode(Buffer.concat([seed, pub]))}`,
      `FACILITATOR_ADDRESS=${feePayerAddress}`,
      "",
    ].join("\n"),
  );
  console.log("Created facilitator wallet:", feePayerAddress);
}

const sol = Number(process.argv[2] ?? 2);
const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const rpc = createSolanaRpc(rpcUrl);
const rpcSubscriptions = createSolanaRpcSubscriptions(rpcUrl.replace(/^http/, "ws"));
const agent = await createKeyPairSignerFromBytes(base58.decode(process.env.SVM_PRIVATE_KEY));

const { value: blockhash } = await rpc.getLatestBlockhash().send();
const message = pipe(
  createTransactionMessage({ version: 0 }),
  (m) => setTransactionMessageFeePayerSigner(agent, m),
  (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
  (m) => appendTransactionMessageInstruction(
    getTransferSolInstruction({ source: agent, destination: address(feePayerAddress), amount: lamports(BigInt(sol * 1e9)) }),
    m,
  ),
);
const tx = await signTransactionMessageWithSigners(message);
await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(tx, { commitment: "confirmed" });
console.log(`Sent ${sol} SOL to facilitator: https://explorer.solana.com/tx/${getSignatureFromTransaction(tx)}?cluster=devnet`);
