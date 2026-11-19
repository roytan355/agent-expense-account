// Devnet only: moves the merchant wallet's USDC back to the agent so the demo
// can be run again. The facilitator wallet pays the fee.
// Usage: node --env-file=.env.local scripts/refill.mjs
import {
  appendTransactionMessageInstruction, createKeyPairSignerFromBytes, createSolanaRpc, createTransactionMessage,
  getBase64EncodedWireTransaction, getSignatureFromTransaction, pipe, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash, signTransactionMessageWithSigners, address,
} from "@solana/kit";
import { findAssociatedTokenPda, getTransferCheckedInstruction, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { base58 } from "@scure/base";

const USDC = address("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const rpc = createSolanaRpc(process.env.SOLANA_RPC_URL);
const merchant = await createKeyPairSignerFromBytes(base58.decode(process.env.MERCHANT_PRIVATE_KEY));
const payer = await createKeyPairSignerFromBytes(base58.decode(process.env.FACILITATOR_PRIVATE_KEY));
const agent = address(process.env.AGENT_ADDRESS);

const ata = async (owner) => (await findAssociatedTokenPda({ owner, mint: USDC, tokenProgram: TOKEN_PROGRAM_ADDRESS }))[0];
const source = await ata(merchant.address);
const destination = await ata(agent);
const bal = await rpc.getTokenAccountBalance(source).send();
const amount = BigInt(bal.value.amount);
if (amount === 0n) { console.log("Merchant has no USDC to move."); process.exit(0); }

const { value: blockhash } = await rpc.getLatestBlockhash().send();
const msg = pipe(
  createTransactionMessage({ version: 0 }),
  (m) => setTransactionMessageFeePayerSigner(payer, m),
  (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
  (m) => appendTransactionMessageInstruction(
    getTransferCheckedInstruction({ source, mint: USDC, destination, authority: merchant, amount, decimals: 6 }), m),
);
const tx = await signTransactionMessageWithSigners(msg);
await rpc.sendTransaction(getBase64EncodedWireTransaction(tx), { encoding: "base64" }).send();
console.log(`Moved ${bal.value.uiAmountString} USDC to the agent: https://explorer.solana.com/tx/${getSignatureFromTransaction(tx)}?cluster=devnet`);
