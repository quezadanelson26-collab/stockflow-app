import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "StockFlow - Inventory Management",
  description: "Forensic inventory management for modern retail",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
