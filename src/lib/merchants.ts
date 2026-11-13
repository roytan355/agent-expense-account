// The demo merchants: x402-paywalled endpoints that live in this app and
// pay out to the merchant wallet. The agent sees this catalog via list_merchants.
export type Merchant = {
  id: string;
  name: string;
  path: string;
  priceUsd: number;
  description: string;
};

export const MERCHANTS: Merchant[] = [
  {
    id: "fx",
    name: "FX Rates",
    path: "/api/merchant/fx",
    priceUsd: 0.01,
    description: "Latest USD exchange rates (USD/CAD, USD/EUR, ...).",
  },
  {
    id: "sol-price",
    name: "SOL Price",
    path: "/api/merchant/sol-price",
    priceUsd: 0.02,
    description: "Current SOL/USD price and 24h change.",
  },
  {
    id: "premium-report",
    name: "Premium Market Report",
    path: "/api/merchant/premium-report",
    priceUsd: 2.0,
    description: "Long-form crypto market report. Expensive.",
  },
];

export const merchantById = (id: string) => MERCHANTS.find((m) => m.id === id);
