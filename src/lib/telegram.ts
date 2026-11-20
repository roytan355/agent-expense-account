// Telegram front end for Leash. Long polling, so it works on localhost with
// no public URL. The first person to message the bot becomes its owner and
// is the only one it answers.
import { promises as fs } from "node:fs";
import path from "node:path";
import { runAgent, type AgentEvent } from "./agent";
import { decide } from "./approvals";
import { explorerTx } from "./config";
import { MERCHANTS } from "./merchants";
import { getPolicy, listReceipts, updatePolicy, type Receipt } from "./store";

const OWNER_FILE = path.join(process.cwd(), "data", "telegram.json");
const api = (method: string) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

type Button = { text: string; callback_data?: string; url?: string };
type Update = {
  update_id: number;
  message?: { chat: { id: number }; from?: { first_name?: string }; text?: string };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number }; message_id: number } };
};

async function call(method: string, body: Record<string, unknown>) {
  const res = await fetch(api(method), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) console.error(`[telegram] ${method} failed: ${json.description}`);
  return json;
}

export function send(chatId: number, text: string, buttons?: Button[][]) {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    link_preview_options: { is_disabled: true },
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
}

async function getOwner(): Promise<number | null> {
  try {
    return JSON.parse(await fs.readFile(OWNER_FILE, "utf8")).owner ?? null;
  } catch {
    return null;
  }
}

async function setOwner(chatId: number) {
  await fs.mkdir(path.dirname(OWNER_FILE), { recursive: true });
  await fs.writeFile(OWNER_FILE, JSON.stringify({ owner: chatId }));
}

const usd = (n: number) => `$${n.toFixed(2)}`;
const merchantName = (id: string) => MERCHANTS.find((m) => m.id === id)?.name ?? id;
const RULE_TEXT: Record<string, string> = {
  per_call_cap: "over your per-purchase limit",
  per_day_cap: "over your daily limit",
  per_merchant_cap: "over your per-merchant limit",
  allowlist: "not something Leash can buy",
  paused: "spending is paused",
  expired: "the card has expired",
  payee_mismatch: "paid to the wrong wallet",
  purpose_check: "the task doesn't need it",
};

async function spentToday() {
  const day = new Date().toDateString();
  return (await listReceipts())
    .filter((r) => r.status === "paid" && new Date(r.created_at).toDateString() === day)
    .reduce((s, r) => s + r.amount_usdc, 0);
}

// Called by the agent when it asks for approval, wherever the task came from.
export async function notifyApproval(r: Receipt) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  const owner = await getOwner();
  if (!owner) return;
  await send(
    owner,
    [
      `Approval needed: ${merchantName(r.merchant)}, ${usd(r.amount_usdc)}`,
      `The agent says: ${r.reason}`,
      r.task ? `Your task: ${r.task}` : "",
    ].filter(Boolean).join("\n"),
    [[{ text: `Approve ${usd(r.amount_usdc)}`, callback_data: `ap:${r.id}` }, { text: "Deny", callback_data: `dn:${r.id}` }]],
  );
}

async function statusText() {
  const p = await getPolicy();
  const spent = await spentToday();
  return [
    `Spent today: ${usd(spent)} of ${usd(p.per_day_max_usdc)}`,
    `Per purchase: up to ${usd(p.per_call_max_usdc)}`,
    `Spending: ${p.paused ? "paused" : "on"}`,
    `Purpose check: ${p.purpose_check ? "on" : "off"}`,
  ].join("\n");
}

const HELP = [
  "Send me a task and the agent will buy what it needs, inside your limits.",
  "Example: What is USD/CAD right now?",
  "",
  "/today  what the agent spent today",
  "/pause  stop all spending",
  "/resume  turn spending back on",
].join("\n");

async function runTask(chatId: number, task: string) {
  await send(chatId, "Working on it.");
  let lastMerchant = "";
  const lines: Promise<unknown>[] = [];
  const emit = (e: AgentEvent) => {
    if (e.type === "tool_call" && e.name === "pay_and_fetch") {
      lastMerchant = String((e.input as { merchant?: string }).merchant ?? "");
    } else if (e.type === "tool_result" && e.name === "pay_and_fetch") {
      const r = e.result as { paid_usd?: number; tx?: string; rule?: string; message?: string };
      const name = merchantName(lastMerchant);
      if (e.ok && r.tx) {
        lines.push(send(chatId, `Paid ${name}, ${usd(r.paid_usd ?? 0)}`, [[{ text: "View on Solana Explorer", url: explorerTx(r.tx) }]]));
      } else {
        const why = (r.rule && RULE_TEXT[r.rule]) ?? r.message ?? "blocked";
        lines.push(send(chatId, `Blocked ${name}: ${why}.${r.rule === "purpose_check" && r.message ? `\n${r.message}` : ""}`));
      }
    } else if (e.type === "done") {
      lines.push(spentToday().then(async (s) => send(chatId, `${e.text}\n\nSpent today: ${usd(s)} of ${usd((await getPolicy()).per_day_max_usdc)}`)));
    } else if (e.type === "error") {
      lines.push(send(chatId, `The agent stopped: ${e.message}`));
    }
  };
  await runAgent(task, emit);
  await Promise.all(lines);
}

async function handleMessage(chatId: number, text: string) {
  const owner = await getOwner();
  if (owner === null) {
    await setOwner(chatId);
    await send(chatId, `You own this Leash account now. Only this chat can spend from it.\n\n${HELP}`);
    return;
  }
  if (chatId !== owner) {
    await send(chatId, "This Leash account belongs to someone else.");
    return;
  }
  const cmd = text.trim().split(/\s+/)[0].toLowerCase();
  if (cmd === "/start" || cmd === "/help") return void (await send(chatId, HELP));
  if (cmd === "/today" || cmd === "/status") return void (await send(chatId, await statusText()));
  if (cmd === "/pause") {
    await updatePolicy({ paused: true });
    return void (await send(chatId, "Spending is paused. The agent can't pay for anything until you send /resume."));
  }
  if (cmd === "/resume") {
    await updatePolicy({ paused: false });
    return void (await send(chatId, "Spending is back on."));
  }
  await runTask(chatId, text.trim());
}

async function handleCallback(q: NonNullable<Update["callback_query"]>) {
  const chatId = q.message?.chat.id;
  const [kind, id] = (q.data ?? "").split(":");
  if (!chatId || chatId !== (await getOwner()) || !id) {
    await call("answerCallbackQuery", { callback_query_id: q.id, text: "Not allowed." });
    return;
  }
  await call("answerCallbackQuery", { callback_query_id: q.id, text: kind === "ap" ? "Paying..." : "Denied." });
  // Remove the buttons so the request can't be answered twice.
  await call("editMessageReplyMarkup", { chat_id: chatId, message_id: q.message!.message_id, reply_markup: { inline_keyboard: [] } });
  const result = await decide(id, kind === "ap" ? "approve" : "deny");
  if ("denied" in result) return void (await send(chatId, "Denied. Nothing was paid."));
  if ("notFound" in result && result.notFound) {
    return void (await send(chatId, "This request was already answered, maybe on the website. Nothing was paid."));
  }
  if (!result.ok) return void (await send(chatId, `Couldn't pay: ${result.error}`));
  const tx = "receipt" in result ? result.receipt.tx_signature : undefined;
  await send(
    chatId,
    `Approved and paid ${"receipt" in result ? usd(result.receipt.amount_usdc) : ""}.`,
    tx ? [[{ text: "View on Solana Explorer", url: explorerTx(tx) }]] : undefined,
  );
}

// One poller per process, even when Next.js re-runs this module in dev.
const g = globalThis as unknown as { __leashBot?: boolean };

export function startBot() {
  if (g.__leashBot) return;
  g.__leashBot = true;
  void (async () => {
    await call("setMyCommands", {
      commands: [
        { command: "today", description: "What the agent spent today" },
        { command: "pause", description: "Stop all spending" },
        { command: "resume", description: "Turn spending back on" },
        { command: "help", description: "How to use Leash" },
      ],
    });
    let offset = 0;
    console.log("[telegram] bot polling");
    for (;;) {
      try {
        const res = await fetch(api("getUpdates"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ offset, timeout: 30, allowed_updates: ["message", "callback_query"] }),
        });
        const json = (await res.json()) as { ok: boolean; result?: Update[]; description?: string };
        if (!json.ok) {
          console.error(`[telegram] getUpdates: ${json.description}`);
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        for (const u of json.result ?? []) {
          offset = u.update_id + 1;
          // Each update runs on its own so a long agent run doesn't hold up button presses.
          if (u.message?.text) void handleMessage(u.message.chat.id, u.message.text).catch((e) => console.error("[telegram]", e));
          else if (u.callback_query) void handleCallback(u.callback_query).catch((e) => console.error("[telegram]", e));
        }
      } catch (e) {
        console.error("[telegram] poll error", e);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  })();
}
