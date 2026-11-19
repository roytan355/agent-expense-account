// The demo merchants: x402-paywalled endpoints that live in this app and
// pay out to the merchant wallet. The agent sees this catalog via list_merchants.
export type Merchant = {
  id: string;
  name: string;
  path: string;
  priceUsd: number;
  description: string;
  // Words in a task that mean this merchant is needed. Used by the purpose
  // check when there is no API key.
  taskHint: RegExp;
};

export const MERCHANTS: Merchant[] = [
  {
    id: "fx",
    name: "FX Rates",
    path: "/api/merchant/fx",
    priceUsd: 0.01,
    description: "Latest USD exchange rates (USD/CAD, USD/EUR, ...).",
    taskHint: /usd|cad|eur|fx|exchange|currency|rate/i,
  },
  {
    id: "sol-price",
    name: "SOL Price",
    path: "/api/merchant/sol-price",
    priceUsd: 0.02,
    description: "Current SOL/USD price and 24h change.",
    taskHint: /\bsol\b|solana/i,
  },
  {
    id: "premium-report",
    name: "Premium Market Report",
    path: "/api/merchant/premium-report",
    priceUsd: 2.0,
    description: "Long-form crypto market report. Expensive.",
    taskHint: /report|premium|analysis/i,
  },
];

export const merchantById = (id: string) => MERCHANTS.find((m) => m.id === id);
