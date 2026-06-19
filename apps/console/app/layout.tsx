import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Nav } from "../components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ring Zero — Console",
  description: "Deterministic execution-governance kernel for AI agents",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="mx-auto max-w-[1200px] px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
