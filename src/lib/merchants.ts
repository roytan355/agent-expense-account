// The demo merchants: x402-paywalled endpoints that live in this app and
// pay out to the merchant wallet. The agent sees this catalog via list_merchants.
export type Merchant = {
  id: string;
  name: string;
  path: string;
  priceUsd: number;
  // "data" merchants return information; "product" merchants are the Leash
  // Shop demo store and return an order confirmation.
  kind: "data" | "product";
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
    kind: "data",
    description: "Latest USD exchange rates (USD/CAD, USD/EUR, ...).",
    taskHint: /usd|cad|eur|fx|exchange|currency|rate/i,
  },
  {
    id: "sol-price",
    name: "SOL Price",
    path: "/api/merchant/sol-price",
    priceUsd: 0.02,
    kind: "data",
    description: "Current SOL/USD price and 24h change.",
    taskHint: /\bsol\b|solana/i,
  },
  {
    id: "premium-report",
    name: "Premium Market Report",
    path: "/api/merchant/premium-report",
    priceUsd: 20.0,
    kind: "data",
    description: "Long-form crypto market report. Expensive.",
    taskHint: /report|premium|analysis/i,
  },
  {
    id: "usb-c-cable",
    name: "USB-C Cable, 2 m",
    path: "/api/shop/usb-c-cable",
    priceUsd: 8.99,
    kind: "product",
    description: "Leash Shop: braided USB-C to USB-C charging cable, 2 m, 100 W. Ships in 2 days.",
    taskHint: /cable|usb|charg/i,
  },
  {
    id: "coffee-beans",
    name: "Coffee Beans, 1 kg",
    path: "/api/shop/coffee-beans",
    priceUsd: 14.5,
    kind: "product",
    description: "Leash Shop: medium roast whole coffee beans, 1 kg bag. Ships in 2 days.",
    taskHint: /coffee|beans|espresso/i,
  },
  {
    id: "gift-card",
    name: "Gift Card, $25",
    path: "/api/shop/gift-card",
    priceUsd: 25.0,
    kind: "product",
    description: "Leash Shop: $25 digital gift card, delivered by email right away.",
    taskHint: /gift/i,
  },
  {
    id: "milk",
    name: "Milk, 2 L",
    path: "/api/shop/milk",
    priceUsd: 4.99,
    kind: "product",
    description: "Leash Shop: 2% milk, 2 L carton. Same-day grocery delivery.",
    taskHint: /milk/i,
  },
  {
    id: "eggs",
    name: "Eggs, dozen",
    path: "/api/shop/eggs",
    priceUsd: 5.49,
    kind: "product",
    description: "Leash Shop: one dozen large eggs. Same-day grocery delivery.",
    taskHint: /\beggs?\b/i,
  },
  {
    id: "bread",
    name: "Bread, 1 loaf",
    path: "/api/shop/bread",
    priceUsd: 3.99,
    kind: "product",
    description: "Leash Shop: whole wheat sandwich loaf. Same-day grocery delivery.",
    taskHint: /bread|loaf/i,
  },
];

export const merchantById = (id: string) => MERCHANTS.find((m) => m.id === id);
