// Line glyphs drawn in the style of iOS system symbols, plus the rounded
// tile that iOS Settings puts behind them.
const PATHS: Record<string, React.ReactNode> = {
  cart: (<><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2" /><circle cx="9.5" cy="20" r="1.3" /><circle cx="17" cy="20" r="1.3" /></>),
  chart: (<path d="M4 4v15h16M8 15l3.5-4.5 3 2.5L20 6.5" />),
  bolt: (<path d="M13 3 5 14h6l-1 7 8-11h-6l1-7z" />),
  cup: (<><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9z" /><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8.5 3.5v2.5M12 3.5v2.5" /></>),
  gift: (<><path d="M4.5 11.5h15V20h-15zM3.5 7.5h17v4h-17zM12 7.5V20" /><path d="M12 7.5C10.5 4 7 4 7 6c0 1.2 1.5 1.5 5 1.5M12 7.5C13.5 4 17 4 17 6c0 1.2-1.5 1.5-5 1.5" /></>),
  check: (<path d="M5 12.5 9.5 17 19 7" />),
  xmark: (<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />),
  clock: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>),
  pause: (<path d="M9 6v12M15 6v12" />),
  play: (<path d="M8 5.5v13L18.5 12z" fill="currentColor" />),
  calendar: (<><rect x="4" y="5.5" width="16" height="14.5" rx="2.5" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>),
  tag: (<><path d="M3.5 12V4.5a1 1 0 0 1 1-1H12l8.5 8.5-8 8z" /><circle cx="8" cy="8" r="1.3" /></>),
  store: (<><path d="M4 9.5 5.5 4.5h13L20 9.5M5 10.5V20h14v-9.5M10 20v-5h4v5" /><path d="M4 9.5c0 1.4 1.2 2.5 2.7 2.5S9.3 10.9 9.3 9.5c0 1.4 1.2 2.5 2.7 2.5s2.7-1.1 2.7-2.5c0 1.4 1.2 2.5 2.6 2.5S20 10.9 20 9.5" /></>),
  search: (<><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></>),
  arrow: (<path d="M7 17 17 7M8.5 7H17v8.5" />),
  bubble: (<path d="M4 6.5a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H9.5L5 20.5V17H6.5" />),
  flag: (<path d="M5.5 21V4M5.5 4.5h11l-2 4 2 4h-11" />),
  sparkle: (<path d="M12 3.5c.6 4.3 2.2 5.9 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5 4.3-.6 5.9-2.2 6.5-6.5zM18.5 15.5c.3 1.8.9 2.4 2.5 2.7-1.6.3-2.2.9-2.5 2.6-.3-1.7-.9-2.3-2.5-2.6 1.6-.3 2.2-.9 2.5-2.7z" />),
  wallet: (<><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" /><rect x="4" y="8" width="16.5" height="11.5" rx="2.5" /><circle cx="16" cy="13.75" r="1.2" /></>),
  reset: (<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9M4.5 4.5V9H9" />),
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className ? `icon ${className}` : "icon"} viewBox="0 0 24 24" width={size} height={size}
      fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

// Tiles stay in the site's own blue so the console reads as one product.
export function Tile({ name, size = 30 }: { name: IconName; size?: number }) {
  return (
    <span className="tile" style={{ width: size, height: size }}>
      <Icon name={name} size={Math.round(size * 0.56)} />
    </span>
  );
}

// What each merchant looks like in a list.
export const MERCHANT_TILE: Record<string, IconName> = {
  fx: "chart",
  "sol-price": "chart",
  "usb-c-cable": "bolt",
  "coffee-beans": "cup",
  "gift-card": "gift",
  milk: "cart",
  eggs: "cart",
  bread: "cart",
};
