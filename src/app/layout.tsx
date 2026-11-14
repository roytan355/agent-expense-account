import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent expense account",
  description: "A USDC expense account for an AI agent, with spending rules enforced before any payment is signed.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
