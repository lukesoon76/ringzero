import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Sidebar } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ring Zero — Governance Console",
  description: "Deterministic execution-governance kernel for AI agents",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <Topbar />
            <main className="px-6 py-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
