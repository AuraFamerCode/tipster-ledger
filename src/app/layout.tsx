import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tipster Ledger — learns who to trust",
  description: "Cricket & markets pick journal. Credibility memories on Walrus Memory (Sui mainnet), onchain reads via Tatum Sui RPC.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
