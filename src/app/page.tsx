"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Policy = {
  per_call_max_usdc: number;
  per_day_max_usdc: number;
  per_merchant_max_usdc: number;
  allowlist: string[];
  expires_at: string;
  paused: boolean;
};
type Receipt = {
  id: string;
  created_at: string;
  merchant: string;
  amount_usdc: number;
  reason: string;
  status: "paid" | "blocked" | "pending_approval" | "failed";
  rule_hit?: string;
  detail?: string;
  tx_signature?: string;
};
type Ledger = { policy: Policy; spent_today: number; spent_by_merchant: Record<string, number>; receipts: Receipt[] };
type Wallet = { address: string; sol: number; usdc: number };
type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool_call"; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; name: string; ok: boolean; result: Record<string, unknown> }
  | { type: "done"; text: string }
  | { type: "error"; message: string };

// Mirrors src/lib/merchants.ts (kept here so this page stays a client bundle).
const MERCHANTS = [
  { id: "fx", name: "FX Rates", price: 0.01 },
  { id: "sol-price", name: "SOL Price", price: 0.02 },
  { id: "premium-report", name: "Premium Market Report", price: 2.0 },
];

const usd = (n: number) => `$${n.toFixed(2)}`;
const short = (a: string) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : "");
const txUrl = (s: string) => `https://explorer.solana.com/tx/${s}?cluster=devnet`;
const addrUrl = (a: string) => `https://explorer.solana.com/address/${a}?cluster=devnet`;

const STATUS_LABEL: Record<Receipt["status"], string> = {
  paid: "Paid",
  blocked: "Blocked",
  pending_approval: "Needs approval",
  failed: "Failed",
};

async function postPolicy(body: object) {
  await fetch("/api/policy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

export default function Dashboard() {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [wallets, setWallets] = useState<{ agent: Wallet; merchant: Wallet } | null>(null);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/ledger", { cache: "no-store" });
    if (r.ok) setLedger(await r.json());
  }, []);
  const refreshWallets = useCallback(async () => {
    const r = await fetch("/api/wallets", { cache: "no-store" });
    if (r.ok) setWallets(await r.json());
  }, []);

  useEffect(() => {
    refresh();
    refreshWallets();
    const a = setInterval(refresh, 2000);
    const b = setInterval(refreshWallets, 10000);
    return () => { clearInterval(a); clearInterval(b); };
  }, [refresh, refreshWallets]);

  if (!ledger) return <main className="shell"><p className="muted">Loading the account…</p></main>;

  const { policy } = ledger;
  const expired = new Date(policy.expires_at).getTime() < Date.now();
  const pct = Math.min(100, (ledger.spent_today / policy.per_day_max_usdc) * 100);

  return (
    <main className="shell">
      <header className="top">
        <h1>Agent expense account</h1>
        <div className="wallets">
          <WalletLine label="Agent wallet" w={wallets?.agent} />
          <WalletLine label="Merchant wallet" w={wallets?.merchant} />
        </div>
      </header>

      <section className="meter" aria-label="Spending today">
        <div className="meter-figures">
          <span className="meter-spent">{usd(ledger.spent_today)}</span>
          <span className="meter-of">spent today of a {usd(policy.per_day_max_usdc)} daily limit</span>
        </div>
        <div className="bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className={`bar-fill ${pct >= 100 ? "full" : ""}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="meter-state">
          <span className={`state ${policy.paused || expired ? "off" : "on"}`}>
            {policy.paused ? "Spending paused" : expired ? "Card expired" : "Spending allowed"}
          </span>
          <button className={policy.paused ? "btn" : "btn danger"} onClick={async () => { await postPolicy({ paused: !policy.paused }); refresh(); }}>
            {policy.paused ? "Resume spending" : "Pause spending"}
          </button>
        </div>
      </section>

      <div className="cols">
        <div className="col">
          <RulesForm policy={policy} onSaved={refresh} />
          <Merchants ledger={ledger} onChange={refresh} />
        </div>
        <div className="col">
          <AgentConsole onActivity={refresh} />
          <Statement receipts={ledger.receipts} />
        </div>
      </div>
    </main>
  );
}

function WalletLine({ label, w }: { label: string; w?: Wallet }) {
  return (
    <div className="wallet">
      <span className="muted">{label}</span>{" "}
      {w ? (
        <>
          <a href={addrUrl(w.address)} target="_blank" rel="noreferrer">{short(w.address)}</a>{" "}
          <strong className="num">{w.usdc.toFixed(2)} USDC</strong>
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
  });
  const [saved, setSaved] = useState(false);

  const field = (key: keyof typeof draft, label: string, type = "number") => (
    <label className="field">
      <span>{label}</span>
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
    <section className="panel">
      <h2>Spending rules</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await postPolicy({
            per_call_max_usdc: Number(draft.per_call_max_usdc),
            per_day_max_usdc: Number(draft.per_day_max_usdc),
            per_merchant_max_usdc: Number(draft.per_merchant_max_usdc),
            expires_at: new Date(`${draft.expires_at}T23:59:59Z`).toISOString(),
          });
          setSaved(true);
          onSaved();
        }}
      >
        <div className="fields">
          {field("per_call_max_usdc", "Most per purchase ($)")}
          {field("per_day_max_usdc", "Most per day ($)")}
          {field("per_merchant_max_usdc", "Most per merchant per day ($)")}
          {field("expires_at", "Card expires", "date")}
        </div>
        <div className="row">
          <button className="btn" type="submit">Save rules</button>
          {saved && <span className="muted">Rules saved.</span>}
          <button
            className="btn quiet"
            type="button"
            onClick={async () => { await postPolicy({ reset: true }); setSaved(false); onSaved(); }}
          >
            Reset account
          </button>
        </div>
      </form>
    </section>
  );
}

function Merchants({ ledger, onChange }: { ledger: Ledger; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const { policy } = ledger;
  return (
    <section className="panel">
      <h2>Merchants</h2>
      <table className="merchants">
        <thead>
          <tr><th>Merchant</th><th className="r">Price</th><th className="r">Spent today</th><th>Allowed</th><th /></tr>
        </thead>
        <tbody>
          {MERCHANTS.map((m) => {
            const allowed = policy.allowlist.includes(m.id);
            const spent = ledger.spent_by_merchant[m.id] ?? 0;
            return (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td className="r num">{usd(m.price)}</td>
                <td className="r num">{usd(spent)} <span className="muted">/ {usd(policy.per_merchant_max_usdc)}</span></td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Allow ${m.name}`}
                    checked={allowed}
                    onChange={async () => {
                      const allowlist = allowed ? policy.allowlist.filter((x) => x !== m.id) : [...policy.allowlist, m.id];
                      await postPolicy({ allowlist });
                      onChange();
                    }}
                  />
                </td>
                <td className="r">
                  <button
                    className="btn small"
                    disabled={busy !== null}
                    onClick={async () => {
                      setBusy(m.id);
                      await fetch("/api/pay", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ merchant: m.id, reason: "Manual test purchase from the dashboard" }),
                      });
                      setBusy(null);
                      onChange();
                    }}
                  >
                    {busy === m.id ? "Buying…" : "Buy once"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

const SAMPLE_TASK =
  "I'm moving $500 USD to Canada and buying some SOL. What's USD/CAD right now, what's SOL trading at, and is the premium market report worth getting?";

function AgentConsole({ onActivity }: { onActivity: () => void }) {
  const [task, setTask] = useState(SAMPLE_TASK);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);
  const logRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    logRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
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
    <section className="panel">
      <h2>Give the agent a task</h2>
      <textarea value={task} onChange={(e) => setTask(e.target.value)} rows={3} />
      <div className="row">
        <button className="btn" onClick={run} disabled={running || !task.trim()}>
          {running ? "Agent is working…" : "Run agent"}
        </button>
      </div>
      {events.length > 0 && (
        <ol className="log" ref={logRef}>
          {events.map((e, i) => <EventLine key={i} e={e} />)}
        </ol>
      )}
    </section>
  );
}

function EventLine({ e }: { e: AgentEvent }) {
  switch (e.type) {
    case "text":
      return <li className="ev think">{e.text}</li>;
    case "tool_call":
      if (e.name === "list_merchants") return <li className="ev call">Checked the merchant list</li>;
      return (
        <li className="ev call">
          {e.name === "pay_and_fetch" ? "Wants to buy" : "Asked you to approve"} <strong>{String(e.input.merchant)}</strong>
          {e.input.reason ? <span className="muted"> because {String(e.input.reason)}</span> : null}
        </li>
      );
    case "tool_result": {
      if (e.name === "list_merchants") return null;
      const r = e.result;
      if (e.name === "request_approval") return <li className="ev pending">Approval request sent to you</li>;
      return e.ok ? (
        <li className="ev paid">
          Paid {usd(Number(r.paid_usd))}
          {r.tx ? <> · <a href={txUrl(String(r.tx))} target="_blank" rel="noreferrer">view transaction</a></> : null}
        </li>
      ) : (
        <li className="ev blocked">Blocked: {String(r.message)}</li>
      );
    }
    case "done":
      return <li className="ev answer">{e.text}</li>;
    case "error":
      return <li className="ev blocked">The agent stopped: {e.message}</li>;
  }
}

function Statement({ receipts }: { receipts: Receipt[] }) {
  return (
    <section className="panel">
      <h2>Statement</h2>
      {receipts.length === 0 ? (
        <p className="muted">No purchases yet. Run the agent or buy from a merchant to see entries here.</p>
      ) : (
        <ul className="statement">
          {receipts.map((r) => (
            <li key={r.id} className={`entry ${r.status}`}>
              <div className="entry-main">
                <span className="entry-merchant">{MERCHANTS.find((m) => m.id === r.merchant)?.name ?? r.merchant}</span>
                <span className="entry-amount num">{usd(r.amount_usdc)}</span>
              </div>
              <div className="entry-sub">
                <span className={`tag ${r.status}`}>{STATUS_LABEL[r.status]}</span>
                <time className="muted num">{new Date(r.created_at).toLocaleTimeString()}</time>
                {r.tx_signature && (
                  <a href={txUrl(r.tx_signature)} target="_blank" rel="noreferrer">{short(r.tx_signature)}</a>
                )}
              </div>
              <p className="entry-reason">{r.reason}</p>
              {r.status !== "paid" && r.detail && <p className="entry-detail">{r.detail}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
