"use client";

// The live owner console: meter, rules, merchants, agent runner and statement.
// Same behaviour as the original dashboard; the ledger is polled by the page
// (useLedger) so the 3D card and the rules section can show live values too.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon, Tile, MERCHANT_TILE } from "./icons";

export type Policy = {
  per_call_max_usdc: number;
  per_day_max_usdc: number;
  per_merchant_max_usdc: number;
  allowlist: string[];
  expires_at: string;
  paused: boolean;
  purpose_check: boolean;
  attack_demo: boolean;
  price_hike_demo: boolean;
  auto_approve_max_usdc: number;
  auto_approve_daily_usdc: number;
};
export type Receipt = {
  id: string;
  created_at: string;
  merchant: string;
  amount_usdc: number;
  reason: string;
  status: "paid" | "blocked" | "pending_approval" | "approved" | "denied" | "failed";
  rule_hit?: string;
  detail?: string;
  tx_signature?: string;
  task?: string;
  auto_approved?: boolean;
};
export type Ledger = { policy: Policy; spent_today: number; spent_by_merchant: Record<string, number>; receipts: Receipt[] };
export type Wallet = { address: string; sol: number; usdc: number };
export type Wallets = { agent: Wallet; merchant: Wallet };
type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool_call"; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; name: string; ok: boolean; result: Record<string, unknown> }
  | { type: "done"; text: string }
  | { type: "error"; message: string };

// Mirrors src/lib/merchants.ts (kept here so this stays a client bundle).
export const MERCHANTS = [
  { id: "fx", name: "FX Rates", price: 0.01 },
  { id: "sol-price", name: "SOL Price", price: 0.02 },
  { id: "usb-c-cable", name: "USB-C Cable, 2 m", price: 8.99 },
  { id: "coffee-beans", name: "Coffee Beans, 1 kg", price: 14.5 },
  { id: "gift-card", name: "Gift Card, $25", price: 25.0 },
  { id: "milk", name: "Milk, 2 L", price: 4.99 },
  { id: "eggs", name: "Eggs, dozen", price: 5.49 },
  { id: "bread", name: "Bread, 1 loaf", price: 3.99 },
];

export const usd = (n: number) => `$${n.toFixed(2)}`;
export const short = (a: string) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : "");
export const txUrl = (s: string) => `https://explorer.solana.com/tx/${s}?cluster=devnet`;
export const addrUrl = (a: string) => `https://explorer.solana.com/address/${a}?cluster=devnet`;

const STATUS_LABEL: Record<Receipt["status"], string> = {
  paid: "Paid",
  blocked: "Blocked",
  pending_approval: "Needs approval",
  approved: "Approved",
  denied: "Denied",
  failed: "Failed",
};

async function postPolicy(body: object) {
  await fetch("/api/policy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

export function useLedger() {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [wallets, setWallets] = useState<Wallets | null>(null);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/ledger", { cache: "no-store" });
    if (r.ok) setLedger(await r.json());
  }, []);
  const refreshWallets = useCallback(async () => {
    const r = await fetch("/api/wallets", { cache: "no-store" });
    if (r.ok) setWallets(await r.json());
  }, []);

  useEffect(() => {
    // first load on mount; refresh fetches and sets state when the response lands
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    refreshWallets();
    const a = setInterval(refresh, 2000);
    const b = setInterval(refreshWallets, 10000);
    return () => { clearInterval(a); clearInterval(b); };
  }, [refresh, refreshWallets]);

  return { ledger, wallets, refresh };
}

const TASKS = [
  "Buy me two milks",
  "What's USD/CAD right now?",
  "Buy a dozen eggs and a loaf of bread",
  "Buy a $25 gift card",
];

export function Console({ ledger, wallets, refresh }: { ledger: Ledger | null; wallets: Wallets | null; refresh: () => void }) {
  const [tab, setTab] = useState<"rules" | "tests">("rules");
  // Test scenarios are for demos only: open the page with ?demo to see them.
  const demo = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).has("demo"),
    () => false,
  );
  if (!ledger) return <p className="muted">Loading…</p>;

  const { policy } = ledger;
  // the ledger re-polls every 2s, so reading the clock on render stays current
  // eslint-disable-next-line react-hooks/purity
  const expired = new Date(policy.expires_at).getTime() < Date.now();
  const pct = Math.min(100, (ledger.spent_today / policy.per_day_max_usdc) * 100);
  const off = policy.paused || expired;

  return (
    <div className="console">
      <section className="meter" aria-label="Spending today">
        <div className="meter-spent num">{usd(ledger.spent_today)}</div>
        <div className="meter-mid">
          <div className="meter-of">of <span className="num">{usd(policy.per_day_max_usdc)}</span> today</div>
          <div className="bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
            <div className={`bar-fill ${pct >= 100 ? "full" : ""}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="wallets">
            <WalletLine label="Agent" w={wallets?.agent} />
            <WalletLine label="Merchant" w={wallets?.merchant} />
          </div>
        </div>
        <div className="meter-state">
          <span className={`state ${off ? "off" : "on"}`}>
            {policy.paused ? "Paused" : expired ? "Expired" : "Active"}
          </span>
          <button className={policy.paused ? "btn" : "btn danger"} onClick={async () => { await postPolicy({ paused: !policy.paused }); refresh(); }}>
            <Icon name={policy.paused ? "play" : "pause"} size={16} />
            {policy.paused ? "Resume" : "Pause"}
          </button>
        </div>
      </section>

      <div className="deck">
        <div className="deck-main">
          <AgentConsole onActivity={refresh} />
          <Statement receipts={ledger.receipts} onChange={refresh} />
        </div>
        <div className="deck-side">
          <Phone ledger={ledger} onChange={refresh} />
          <section>
            <div className="group-head">
              <h3>{demo && tab === "tests" ? "Test scenarios" : "Rules"}</h3>
              {demo && (
                <div className="seg" role="tablist">
                  {([["rules", "Rules"], ["tests", "Tests"]] as const).map(([k, label]) => (
                    <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{label}</button>
                  ))}
                </div>
              )}
            </div>
            {tab === "rules" || !demo ? <RulesForm policy={policy} onSaved={refresh} /> : <TestScenarios policy={policy} onChange={refresh} />}
          </section>
        </div>
      </div>
    </div>
  );
}

export function WalletLine({ label, w }: { label: string; w?: Wallet }) {
  return (
    <div className="wallet">
      <span className="muted">{label}</span>{" "}
      {w ? (
        <>
          <strong className="num">{w.usdc.toFixed(2)} USDC</strong>{" "}
          <a href={addrUrl(w.address)} target="_blank" rel="noreferrer">{short(w.address)}</a>
        </>
      ) : (
        <span className="muted">checking…</span>
      )}
    </div>
  );
}

function RulesForm({ policy, onSaved }: { policy: Policy; onSaved: () => void }) {
  const [draft, setDraft] = useState({
    per_call_max_usdc: String(policy.per_call_max_usdc),
    per_day_max_usdc: String(policy.per_day_max_usdc),
    per_merchant_max_usdc: String(policy.per_merchant_max_usdc),
    expires_at: policy.expires_at.slice(0, 10),
    auto_approve_max_usdc: String(policy.auto_approve_max_usdc),
    auto_approve_daily_usdc: String(policy.auto_approve_daily_usdc),
  });
  const [saved, setSaved] = useState(false);

  const field = (key: keyof typeof draft, label: string, icon: Parameters<typeof Tile>[0]["name"], type = "number") => (
    <label className="setting">
      <Tile name={icon} size={28} />
      <span className="setting-label">{label}</span>
      {type === "number" && <span className="setting-unit">$</span>}
      <input
        type={type}
        step="0.01"
        min="0"
        value={draft[key]}
        onChange={(e) => { setDraft({ ...draft, [key]: e.target.value }); setSaved(false); }}
      />
    </label>
  );

  return (
    <div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await postPolicy({
            per_call_max_usdc: Number(draft.per_call_max_usdc),
            per_day_max_usdc: Number(draft.per_day_max_usdc),
            per_merchant_max_usdc: Number(draft.per_merchant_max_usdc),
            expires_at: new Date(`${draft.expires_at}T23:59:59Z`).toISOString(),
            auto_approve_max_usdc: Number(draft.auto_approve_max_usdc),
            auto_approve_daily_usdc: Number(draft.auto_approve_daily_usdc),
          });
          setSaved(true);
          onSaved();
        }}
      >
        <p className="group-label">Ask me before going over</p>
        <div className="group">
          {field("per_call_max_usdc", "Per purchase", "tag")}
          {field("per_day_max_usdc", "Per day", "calendar")}
          {field("per_merchant_max_usdc", "Per merchant", "store")}
        </div>
        <p className="group-label">Auto-approve repeat buys</p>
        <div className="group">
          {field("auto_approve_max_usdc", "Up to", "sparkle")}
          {field("auto_approve_daily_usdc", "Per day", "calendar")}
        </div>
        <p className="group-foot">Only for merchants the agent has paid before. Set to 0 to turn off.</p>
        <div className="group">
          {field("expires_at", "Card expires", "clock", "date")}
        </div>
        <div className="row">
          <button className="btn" type="submit">{saved ? "Saved" : "Save"}</button>
          <button
            className="btn quiet"
            type="button"
            onClick={async () => { await postPolicy({ reset: true }); setSaved(false); onSaved(); }}
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}

function TestScenarios({ policy, onChange }: { policy: Policy; onChange: () => void }) {
  const toggle = (key: "attack_demo" | "price_hike_demo", label: string, help: string) => (
    <label className="setting toggle">
      <span className="toggle-text">
        <strong>{label}</strong>
        <span className="muted small">{help}</span>
      </span>
      <input
        type="checkbox"
        checked={policy[key]}
        onChange={async (e) => { await postPolicy({ [key]: e.target.checked }); onChange(); }}
      />
    </label>
  );
  return (
    <div className="group">
      {toggle("attack_demo", "Sneaky merchant", "The FX merchant tries to get the agent to buy something extra.")}
      {toggle("price_hike_demo", "Price change", "The coffee shop charges more at checkout than it lists.")}
    </div>
  );
}

const SAMPLE_TASK =
  "I'm moving $500 USD to Canada and buying some SOL. What's USD/CAD right now, and what's SOL trading at?";

function AgentConsole({ onActivity }: { onActivity: () => void }) {
  const [task, setTask] = useState(SAMPLE_TASK);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);
  const logRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [events]);

  async function run() {
    setRunning(true);
    setEvents([]);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as AgentEvent;
          setEvents((prev) => [...prev, e]);
          if (e.type === "tool_result") onActivity();
        }
      }
    } catch (err) {
      setEvents((prev) => [...prev, { type: "error", message: err instanceof Error ? err.message : String(err) }]);
    } finally {
      setRunning(false);
      onActivity();
    }
  }

  return (
    <section className="card composer">
      <label className="card-title" htmlFor="task">Ask the agent</label>
      <textarea id="task" value={task} onChange={(e) => setTask(e.target.value)} rows={3} />
      <div className="composer-foot">
        <div className="chips">
          {TASKS.map((t) => (
            <button key={t} type="button" className="chip" onClick={() => setTask(t)} disabled={running}>{t}</button>
          ))}
        </div>
        <button className="btn run" onClick={run} disabled={running || !task.trim()}>
          <Icon name="play" size={14} />
          {running ? "Working" : "Run"}
        </button>
      </div>
      {events.length > 0 && (
        <ol className="log" ref={logRef} data-lenis-prevent>
          {events.map((e, i) => <EventLine key={i} e={e} />)}
        </ol>
      )}
    </section>
  );
}

function EventLine({ e }: { e: AgentEvent }) {
  switch (e.type) {
    case "text":
      return <li className="ev think"><Icon name="bubble" size={15} /><span>{e.text}</span></li>;
    case "tool_call":
      if (e.name === "list_merchants") return <li className="ev call"><Icon name="search" size={15} /><span>Checked what&apos;s for sale</span></li>;
      return (
        <li className="ev call">
          <Icon name="arrow" size={15} />
          <span>
            {e.name === "pay_and_fetch" ? "Paying" : "Asking you about"} <strong>{MERCHANTS.find((m) => m.id === e.input.merchant)?.name ?? String(e.input.merchant)}</strong>
            {e.input.reason ? <span className="muted"> {String(e.input.reason)}</span> : null}
          </span>
        </li>
      );
    case "tool_result": {
      if (e.name === "list_merchants") return null;
      const r = e.result;
      if (e.name === "request_approval") return <li className="ev pending"><Icon name="clock" size={15} /><span>Sent to you for approval</span></li>;
      return e.ok ? (
        <li className="ev paid">
          <Icon name="check" size={15} />
          <span>Paid {usd(Number(r.paid_usd))}</span>
          {r.tx ? <a className="ev-link" href={txUrl(String(r.tx))} target="_blank" rel="noreferrer">Receipt</a> : null}
        </li>
      ) : (
        <li className="ev blocked"><Icon name="xmark" size={15} /><span>Not paid. {String(r.message)}</span></li>
      );
    }
    case "done":
      return <li className="ev answer"><span>{e.text}</span></li>;
    case "error":
      return <li className="ev blocked"><Icon name="xmark" size={15} /><span>Stopped: {e.message}</span></li>;
  }
}

function Statement({ receipts, onChange }: { receipts: Receipt[]; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  async function decide(id: string, decision: "approve" | "deny") {
    setBusy(id);
    await fetch("/api/approval", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, decision }),
    });
    setBusy(null);
    onChange();
  }
  const paid = receipts.filter((r) => r.status === "paid").reduce((a, r) => a + r.amount_usdc, 0);
  const stopped = receipts.filter((r) => r.status === "blocked" || r.status === "denied").length;
  const open = receipts.filter((r) => r.status === "pending_approval").length;
  return (
    <section>
      <div className="group-head">
        <h3>Activity</h3>
        <dl className="totals">
          <div><dt>Paid</dt><dd className="num">{usd(paid)}</dd></div>
          <div><dt>Stopped</dt><dd className="num">{stopped}</dd></div>
          {open > 0 && <div className="waiting"><dt>Waiting</dt><dd className="num">{open}</dd></div>}
        </dl>
      </div>
      {receipts.length === 0 ? (
        <div className="group empty">No activity yet</div>
      ) : (
        <ul className="group statement" data-lenis-prevent>
          {receipts.map((r) => {
            const tile = MERCHANT_TILE[r.merchant] ?? "wallet";
            const flagged = r.status === "blocked" && r.rule_hit && LOOKS_OFF.has(r.rule_hit);
            return (
              <li key={r.id} className={`entry ${r.status}`}>
                <Tile name={tile} size={36} />
                <div className="entry-body">
                  <div className="entry-main">
                    <span className="entry-merchant">{MERCHANTS.find((m) => m.id === r.merchant)?.name ?? r.merchant}</span>
                    <span className="entry-amount num">{usd(r.amount_usdc)}</span>
                  </div>
                  <div className="entry-sub">
                    <span className={`tag ${r.status}`}>
                      {flagged ? "Looks off" : r.auto_approved ? "Auto-approved" : STATUS_LABEL[r.status]}
                    </span>
                    <time className="muted num">{new Date(r.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
                    {r.tx_signature && (
                      <a href={txUrl(r.tx_signature)} target="_blank" rel="noreferrer">Receipt</a>
                    )}
                  </div>
                  {r.status !== "paid" && r.detail && <p className={r.status === "approved" ? "entry-note" : "entry-detail"}>{r.detail}</p>}
                  {r.auto_approved && r.detail && <p className="entry-note">{r.detail}</p>}
                  {r.status === "pending_approval" && (
                    <div className="row">
                      <button className="btn small" disabled={busy !== null} onClick={() => decide(r.id, "approve")}>
                        {busy === r.id ? "Paying" : `Approve ${usd(r.amount_usdc)}`}
                      </button>
                      <button className="btn small quiet" disabled={busy !== null} onClick={() => decide(r.id, "deny")}>Deny</button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const RULE_TEXT: Record<string, string> = {
  per_call_cap: "over your per-purchase limit",
  per_day_cap: "over your daily limit",
  per_merchant_cap: "over your per-merchant limit",
  allowlist: "not something Leash can buy",
  paused: "spending is paused",
  expired: "the card has expired",
};
const LOOKS_OFF = new Set(["payee_mismatch", "price_changed", "purpose_check"]);

type Msg =
  | { k: string; from: "me"; text: string }
  | { k: string; from: "bot"; text: string; link?: string; ask?: Receipt };

// A mirror of the Telegram bot, built from the same ledger the bot reads.
// The real @LeashSBot answers its owner only, so visitors see the feed here.
function Phone({ ledger, onChange }: { ledger: Ledger; onChange: () => void }) {
  const [extra, setExtra] = useState<Msg[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const name = (id: string) => MERCHANTS.find((m) => m.id === id)?.name ?? id;

  const msgs: Msg[] = [];
  let lastTask = "";
  for (const r of ledger.receipts.slice(0, 14).reverse()) {
    if (r.task && r.task !== lastTask) {
      lastTask = r.task;
      msgs.push({ k: `t${r.id}`, from: "me", text: r.task });
    }
    if (r.status === "paid") msgs.push({ k: r.id, from: "bot", text: `Paid ${name(r.merchant)}, ${usd(r.amount_usdc)}${r.auto_approved ? "\nOver your limit, auto-approved: small purchase from a merchant you've used." : ""}`, link: r.tx_signature });
    else if (r.status === "pending_approval" || r.status === "approved" || r.status === "denied")
      msgs.push({
        k: r.id,
        from: "bot",
        text: [`Approval needed: ${name(r.merchant)}, ${usd(r.amount_usdc)}`, `The agent says: ${r.reason}`].join("\n") +
          (r.status === "approved" ? "\n\nYou approved this." : r.status === "denied" ? "\n\nYou denied this." : ""),
        ask: r.status === "pending_approval" ? r : undefined,
      });
    else if (r.status === "blocked") msgs.push({ k: r.id, from: "bot", text: r.rule_hit && LOOKS_OFF.has(r.rule_hit) ? `${name(r.merchant)} looks off. Not paid.` : `Blocked ${name(r.merchant)}: ${(r.rule_hit && RULE_TEXT[r.rule_hit]) ?? "blocked"}.` });
  }
  msgs.push(...extra);
  const count = msgs.length;

  useEffect(() => {
    const f = feedRef.current;
    if (f) f.scrollTop = f.scrollHeight;
  }, [count]);

  async function decide(id: string, decision: "approve" | "deny") {
    setBusy(id);
    await fetch("/api/approval", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, decision }) });
    setBusy(null);
    onChange();
  }

  async function command(cmd: "/today" | "/pause" | "/resume") {
    const p = ledger.policy;
    let reply = "";
    if (cmd === "/today") {
      reply = [
        `Spent today: ${usd(ledger.spent_today)} of ${usd(p.per_day_max_usdc)}`,
        `Per purchase: up to ${usd(p.per_call_max_usdc)}`,
        `Spending: ${p.paused ? "paused" : "on"}`,
      ].join("\n");
    } else {
      await postPolicy({ paused: cmd === "/pause" });
      reply = cmd === "/pause" ? "Spending is paused. The agent can't pay for anything until you send /resume." : "Spending is back on.";
      onChange();
    }
    const n = ++seq.current;
    setExtra((x): Msg[] => [...x, { k: `c${n}`, from: "me" as const, text: cmd }, { k: `r${n}`, from: "bot" as const, text: reply }].slice(-6));
  }

  return (
    <aside className="phone" aria-label="Telegram bot preview">
      <div className="phone-head">
        <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
          <circle cx="16" cy="16" r="16" fill="#2f93ff" />
          <path d="M11 9v14h10" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          <strong>LeashSBot</strong>
          <span>bot</span>
        </div>
        <a className="phone-open" href="https://t.me/LeashSBot" target="_blank" rel="noreferrer">Open in Telegram</a>
      </div>
      <div className="phone-feed" ref={feedRef} data-lenis-prevent>
        {count === 0 && <p className="phone-empty">No messages yet</p>}
        {msgs.map((m) => (
          <div key={m.k} className={`bubble ${m.from}`}>
            <p>{m.text}</p>
            {m.from === "bot" && m.link && (
              <a className="bubble-btn" href={txUrl(m.link)} target="_blank" rel="noreferrer">View on Solana Explorer</a>
            )}
            {m.from === "bot" && m.ask && (
              <div className="bubble-row">
                <button className="bubble-btn" disabled={busy !== null} onClick={() => decide(m.ask!.id, "approve")}>
                  {busy === m.ask.id ? "Paying…" : `Approve ${usd(m.ask.amount_usdc)}`}
                </button>
                <button className="bubble-btn" disabled={busy !== null} onClick={() => decide(m.ask!.id, "deny")}>Deny</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="phone-cmds">
        {(["/today", "/pause", "/resume"] as const).map((c) => (
          <button key={c} className="cmd" onClick={() => command(c)}>{c}</button>
        ))}
      </div>
    </aside>
  );
}
