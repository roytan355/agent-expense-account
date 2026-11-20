"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { addrUrl, short, usd, type Ledger, type Wallets } from "./console";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f93ff" />
          <stop offset="1" stopColor="#7a3cff" />
        </linearGradient>
      </defs>
      <rect x="6" y="18" width="40" height="28" rx="6" fill="url(#lg)" />
      <circle cx="42" cy="16" r="7" fill="none" stroke="#15162b" strokeWidth="4" />
      <path d="M47 11 C 58 2, 62 30, 50 44 S 40 62, 30 58" fill="none" stroke="#14c47e" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Nav({ ledger }: { ledger: Ledger | null }) {
  const paused = ledger?.policy.paused ?? false;
  return (
    <nav className="nav glass">
      <a href="#hero" className="nav-brand"><Logo /> <span>Leash</span></a>
      <div className="nav-links">
        <a href="#flow">How it works</a>
        <a href="#rules">Rules</a>
        <a href="#console">Console</a>
      </div>
      <span className={`nav-status ${paused ? "off" : "on"}`}>{paused ? "Paused" : "Devnet"}</span>
    </nav>
  );
}

export function Hero() {
  const root = useRef<HTMLElement>(null);
  useGSAP(() => {
    if (reduced()) return;
    gsap.from(".hero-in", { y: 40, opacity: 0, duration: 1.1, ease: "power3.out", stagger: 0.09, delay: 0.15 });
    gsap.to(".hero-copy", {
      y: -120, opacity: 0, ease: "none",
      scrollTrigger: { trigger: root.current, start: "top top", end: "bottom 30%", scrub: true },
    });
  }, { scope: root });

  return (
    <section id="hero" className="hero" ref={root}>
      <div className="hero-copy">
        <h1 className="hero-title hero-in">Leash</h1>
        <p className="hero-lede hero-in">Spending limits for AI agents.</p>
        <p className="hero-sub hero-in">
          Give an agent a USDC wallet on Solana. You set the caps, approve big purchases and freeze spending with one switch.
        </p>
        <div className="hero-cta hero-in">
          <a className="btn big" href="#console">Watch it pay</a>
          <a className="btn big glassy" href="#flow">How it works</a>
        </div>
      </div>
    </section>
  );
}

const BEATS = [
  "AI agents are starting to pay for things on their own.",
  "To pay, an agent needs a wallet. Today that means handing a model a funded key and hoping.",
  "People solved this with company cards: a limit, a statement, someone to ask before a big purchase. Leash is that card, for agents.",
];

export function Problem() {
  const root = useRef<HTMLElement>(null);
  useGSAP(() => {
    const beats = gsap.utils.toArray<HTMLElement>(".beat");
    if (reduced()) { gsap.set(beats, { opacity: 1, position: "static" }); return; }
    gsap.set(beats, { opacity: 0, y: 40 });
    gsap.set(beats[0], { opacity: 1, y: 0 });
    const tl = gsap.timeline({
      defaults: { ease: "power2.inOut" },
      scrollTrigger: { trigger: root.current, start: "top top", end: "bottom bottom", scrub: 0.6 },
    });
    tl.to({}, { duration: 0.4 });
    beats.slice(1).forEach((b, i) => {
      tl.to(beats[i], { opacity: 0, y: -40, duration: 0.5 })
        .to(b, { opacity: 1, y: 0, duration: 0.5 }, "<0.25")
        .to({}, { duration: 0.6 });
    });
  }, { scope: root });

  return (
    <section id="problem" className="problem" ref={root}>
      <div className="sticky">
        <div className="beats">
          {BEATS.map((b) => <p key={b} className="beat">{b}</p>)}
        </div>
      </div>
    </section>
  );
}

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="facts">
      {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

const STEPS: { title: string; detail: React.ReactNode }[] = [
  {
    title: "The agent asks for data.",
    detail: (
      <>
        <div className="big-code"><span>GET</span> /api/merchant/fx</div>
        <p>The agent needs today&apos;s USD/CAD rate, so it calls the FX merchant like any other API.</p>
        <Facts rows={[["Caller", "Research agent"], ["Merchant", "FX Rates"]]} />
      </>
    ),
  },
  {
    title: "The merchant answers 402.",
    detail: (
      <>
        <div className="big-fig">402<small>Payment Required</small></div>
        <p>Under the x402 standard, the price and the payee come back with the response.</p>
        <Facts rows={[["Price", "$0.01 USDC"], ["Pay to", "DYPd…m2CA"], ["Network", "Solana devnet"]]} />
      </>
    ),
  },
  {
    title: "Leash checks the rules before anything is signed.",
    detail: (
      <ul className="checks">
        {["Under your per-purchase limit", "Under your daily limit", "Paid to the wallet on file", "Spending is not paused", "Serves the task you gave it"].map((c) => (
          <li key={c}><span>{c}</span><span className="pass">Pass</span></li>
        ))}
      </ul>
    ),
  },
  {
    title: "Solana settles the payment.",
    detail: (
      <>
        <div className="big-fig">~2s<small>to settle on devnet</small></div>
        <p>Leash signs with the agent&apos;s wallet and the facilitator settles it on chain.</p>
        <Facts rows={[["Signed by", "Agent wallet"], ["Settled by", "Facilitator"], ["Key seen by the model", "Never"]]} />
      </>
    ),
  },
  {
    title: "The statement records it.",
    detail: (
      <>
        <div className="mini-entry">
          <div><strong>FX Rates</strong><span className="num">$0.01</span></div>
          <div><span className="tag paid">Paid</span><span className="muted">12:22:41 PM</span><span className="ev-link">41o9…14gR</span></div>
        </div>
        <p>Every purchase lands on the statement with its explorer link, and so does every refusal, with the rule that stopped it.</p>
      </>
    ),
  },
];

export function Flow() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  useGSAP(() => {
    ScrollTrigger.create({
      trigger: root.current, start: "top top", end: "bottom bottom",
      onUpdate: (s) => setActive(Math.min(STEPS.length - 1, Math.floor(s.progress * STEPS.length * 0.999))),
    });
    if (reduced()) return;
    gsap.fromTo(".flow-line-fill", { scaleY: 0 }, {
      scaleY: 1, ease: "none",
      scrollTrigger: { trigger: root.current, start: "top top", end: "bottom bottom", scrub: 0.4 },
    });
  }, { scope: root });

  return (
    <section id="flow" className="flow" ref={root}>
      <div className="sticky">
        <div className="flow-grid">
          <div className="flow-left">
            <h2>What happens when the agent pays</h2>
            <ol className="steps">
              <div className="flow-line" aria-hidden><div className="flow-line-fill" /></div>
              {STEPS.map((s, i) => (
                <li key={s.title} className={i === active ? "step on" : i < active ? "step done" : "step"}>
                  <span className="step-n">{i + 1}</span>
                  <span className="step-t">{s.title}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flow-right">
            <div className="detail glass">
              {STEPS.map((s, i) => (
                <div key={s.title} className={i === active ? "detail-pane on" : "detail-pane"} aria-hidden={i !== active}>
                  {s.detail}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Rules({ ledger }: { ledger: Ledger | null }) {
  const p = ledger?.policy;
  const rows: [string, string][] = p
    ? [
        ["Per purchase", usd(p.per_call_max_usdc)],
        ["Per day", usd(p.per_day_max_usdc)],
        ["Per merchant, per day", usd(p.per_merchant_max_usdc)],
        ["Card expires", new Date(p.expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })],
        ["Spending", p.paused ? "Paused" : "On"],
        ["Purpose check", p.purpose_check ? "On" : "Off"],
      ]
    : [];
  return (
    <section id="rules" className="rules">
      <div className="rules-inner">
        <div className="rules-copy">
          <h2>You set the rules. The agent can&apos;t argue with them.</h2>
          <p>
            The rules run in code, between the agent and the money. A purchase that breaks one is refused before a signature
            exists, and the statement says which rule stopped it. If the agent still needs it, it asks you to approve.
          </p>
        </div>
        <div className="rules-card glass">
          <p className="muted small">The rules on this account right now</p>
          <dl>
            {rows.map(([k, v]) => (
              <div key={k} className="rule-row"><dt>{k}</dt><dd className={v === "Paused" ? "num off" : "num"}>{v}</dd></div>
            ))}
          </dl>
          <a className="btn" href="#console">Change them in the console</a>
        </div>
      </div>
    </section>
  );
}

export function Footer({ wallets }: { wallets: Wallets | null }) {
  return (
    <footer className="footer">
      <div className="footer-brand"><Logo size={18} /> Leash</div>
      <div className="footer-links">
        {wallets && (
          <>
            <a href={addrUrl(wallets.agent.address)} target="_blank" rel="noreferrer">Agent wallet {short(wallets.agent.address)}</a>
            <a href={addrUrl(wallets.merchant.address)} target="_blank" rel="noreferrer">Merchant wallet {short(wallets.merchant.address)}</a>
          </>
        )}
        <a href="https://github.com/roytan355/agent-expense-account" target="_blank" rel="noreferrer">GitHub</a>
      </div>
      <p className="muted small">Built with x402, Solana devnet USDC, Next.js and Claude.</p>
    </footer>
  );
}
