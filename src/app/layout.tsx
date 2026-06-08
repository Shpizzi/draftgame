import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NBA Roster Draft",
  description: "Draw a random historical NBA roster, optimize it with constrained trades, simulate the season.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
