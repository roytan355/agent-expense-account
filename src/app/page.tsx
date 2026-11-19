"use client";

import { Console, useLedger } from "./console";
import { NightFall, SmoothScroll } from "./motion";
import { Scene } from "./scene";
import { Flow, Footer, Hero, Nav, Problem, Rules } from "./sections";

export default function Page() {
  const { ledger, wallets, refresh } = useLedger();
  return (
    <>
      <SmoothScroll />
      <div className="bgfield" aria-hidden><i /><i /><i /></div>
      <Scene ledger={ledger} />
      <NightFall target="#console" />
      <Nav ledger={ledger} />
      <main>
        <Hero />
        <Problem />
        <Flow />
        <Rules ledger={ledger} />
        <section id="console" className="console-section">
          <div className="console-head">
            <h2>Try it</h2>
            <p>Live on Solana devnet. Give the agent a task, watch the rules stop what they should, and answer approvals the way the Telegram bot asks you, on the phone next to the task.</p>
          </div>
          <Console ledger={ledger} wallets={wallets} refresh={refresh} />
        </section>
        <Footer wallets={wallets} />
      </main>
    </>
  );
}
