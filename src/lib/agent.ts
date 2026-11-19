// The agent runner. Claude decides what to buy; our code decides whether the
// money moves. Claude never sees the wallet key or the x402 client.
import Anthropic from "@anthropic-ai/sdk";
import { MERCHANTS } from "./merchants";
import { payAndFetch } from "./payments";
import { addReceipt, getPolicy } from "./store";

const MODEL = process.env.AGENT_MODEL ?? "claude-haiku-5-5";
const MAX_TURNS = 12;

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool_call"; name: string; input: unknown }
  | { type: "tool_result"; name: string; ok: boolean; result: unknown }
  | { type: "done"; text: string }
  | { type: "error"; message: string };

const tools: Anthropic.Tool[] = [
  {
    name: "list_merchants",
    description: "List the data merchants you can buy from, with their ids and prices in USD.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    name: "pay_and_fetch",
    description:
      "Pay a merchant in USDC and get its data. Payments are checked against the account's spending policy. If a payment is blocked, the result explains which rule blocked it.",
    input_schema: {
      type: "object",
      properties: {
        merchant: { type: "string", description: "Merchant id from list_merchants." },
        reason: { type: "string", description: "One sentence on why this purchase is needed for the task." },
      },
      required: ["merchant", "reason"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "request_approval",
    description:
      "Ask the account owner to approve a purchase that the policy blocked. Use only when the purchase is necessary for the task.",
    input_schema: {
      type: "object",
      properties: {
        merchant: { type: "string" },
        amount_usd: { type: "number" },
        reason: { type: "string" },
      },
      required: ["merchant", "amount_usd", "reason"],
      additionalProperties: false,
    },
    strict: true,
  },
];

async function runTool(name: string, input: Record<string, unknown>): Promise<{ ok: boolean; result: unknown }> {
  switch (name) {
    case "list_merchants":
      return {
        ok: true,
        result: MERCHANTS.map((m) => ({ id: m.id, name: m.name, price_usd: m.priceUsd, description: m.description })),
      };
    case "pay_and_fetch": {
      const r = await payAndFetch(String(input.merchant), String(input.reason));
      return r.ok
        ? { ok: true, result: { paid_usd: r.receipt.amount_usdc, tx: r.receipt.tx_signature, data: r.data } }
        : { ok: false, result: { status: r.receipt.status, rule: r.receipt.rule_hit, message: r.error } };
    }
    case "request_approval": {
      const receipt = await addReceipt({
        merchant: String(input.merchant),
        url: "",
        amount_usdc: Number(input.amount_usd),
        reason: String(input.reason),
        status: "pending_approval",
      });
      return {
        ok: true,
        result: { status: "pending_approval", approval_id: receipt.id, message: "Sent to the owner. Do not wait for it; finish with what you have." },
      };
    }
    default:
      return { ok: false, result: { message: `Unknown tool ${name}` } };
  }
}

async function systemPrompt() {
  const p = await getPolicy();
  return [
    "You are a research agent with a USDC expense account. You buy data from paid merchants to complete the user's task.",
    `Your account owner set a budget: up to $${p.per_call_max_usdc} per purchase, $${p.per_day_max_usdc} per day, $${p.per_merchant_max_usdc} per merchant.`,
    "Buy only what the task needs. Give a short, honest reason for every purchase.",
    "If a purchase is blocked, do not retry it. Use cheaper data or request approval if the purchase is essential, then finish the task with what you have.",
    "End with a concise answer for the user that cites what you paid for.",
  ].join("\n");
}

// No-key mode: a fixed planner picks merchants from keywords in the task and
// goes through the same tools, so payments, policy checks and receipts are
// all real. Only the reasoning is scripted.
async function runScripted(task: string, emit: (e: AgentEvent) => void) {
  const t = task.toLowerCase();
  const wanted = [
    { id: "fx", hit: /usd|cad|fx|exchange|currency/ },
    { id: "sol-price", hit: /\bsol\b|solana/ },
    { id: "premium-report", hit: /report|premium|analysis/ },
  ].filter((w) => w.hit.test(t)).map((w) => w.id);

  emit({ type: "text", text: "Running without an API key: scripted planner, real payments." });
  emit({ type: "tool_call", name: "list_merchants", input: {} });
  const list = await runTool("list_merchants", {});
  emit({ type: "tool_result", name: "list_merchants", ok: true, result: list.result });

  const bought: string[] = [];
  const asked: string[] = [];
  for (const id of wanted) {
    const m = MERCHANTS.find((x) => x.id === id)!;
    const input = { merchant: id, reason: `The task asks for ${m.name.toLowerCase()}.` };
    emit({ type: "tool_call", name: "pay_and_fetch", input });
    const r = await runTool("pay_and_fetch", input);
    emit({ type: "tool_result", name: "pay_and_fetch", ok: r.ok, result: r.result });
    if (r.ok) {
      bought.push(`${m.name} ($${m.priceUsd.toFixed(2)})`);
    } else {
      const ask = { merchant: id, amount_usd: m.priceUsd, reason: `Blocked by policy; needed for: ${task.slice(0, 80)}` };
      emit({ type: "tool_call", name: "request_approval", input: ask });
      const a = await runTool("request_approval", ask);
      emit({ type: "tool_result", name: "request_approval", ok: a.ok, result: a.result });
      asked.push(`${m.name} ($${m.priceUsd.toFixed(2)})`);
    }
  }
  emit({
    type: "done",
    text: !wanted.length
      ? "Nothing in the task matched a merchant, so nothing was bought."
      : [
          bought.length ? `Bought ${bought.join(", ")}.` : "Nothing was paid.",
          asked.length ? `Sent ${asked.join(", ")} to you for approval.` : "",
        ].join(" ").trim(),
  });
}

export async function runAgent(task: string, emit: (e: AgentEvent) => void) {
  if (!process.env.ANTHROPIC_API_KEY) return runScripted(task, emit);
  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: task }];
  const system = await systemPrompt();

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.messages.create({ model: MODEL, max_tokens: 2000, system, tools, messages });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    if (response.stop_reason !== "tool_use") {
      emit({ type: "done", text });
      return;
    }
    if (text) emit({ type: "text", text });

    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      emit({ type: "tool_call", name: block.name, input: block.input });
      const { ok, result } = await runTool(block.name, block.input as Record<string, unknown>);
      emit({ type: "tool_result", name: block.name, ok, result });
      results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result), is_error: !ok });
    }
    messages.push({ role: "user", content: results });
  }
  emit({ type: "error", message: `Stopped after ${MAX_TURNS} turns.` });
}
