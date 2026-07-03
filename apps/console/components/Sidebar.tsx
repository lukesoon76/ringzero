"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const ICONS: Record<string, ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  box: (
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5Z" />
      <path d="M3 8l9 5 9-5" />
    </>
  ),
  pulse: <path d="M3 12h4l3 8 4-16 3 8h4" />,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6Z" />,
  file: (
    <>
      <path d="M14 3H6v18h12V7Z" />
      <path d="M14 3v4h4" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 16v-4M12 16V8M16 16v-6" />
    </>
  ),
  flask: (
    <>
      <path d="M9 3h6" />
      <path d="M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" />
      <path d="M7 16h10" />
    </>
  ),
  graph: (
    <>
      <circle cx="5" cy="6" r="2" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="12" cy="18" r="2" />
      <path d="M7 6h10M6 8l5 8M18 8l-5 8" />
    </>
  ),
  policy: (
    <>
      <path d="M9 3h6l1 2h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2Z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  guard: (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6Z" />
      <path d="M12 9v3.5M12 16h.01" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 13l2.5 5h11L20 13" />
      <path d="M4 13V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v8" />
      <path d="M4 13h4l1.2 2h5.6L16 13h4" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M8.5 13L7 21l5-2.5L17 21l-1.5-8" />
    </>
  ),
};

const NAV: Array<{ href: string; label: string; icon: keyof typeof ICONS }> = [
  { href: "/", label: "Dashboard", icon: "grid" },
  { href: "/workbench", label: "Workbench", icon: "flask" },
  { href: "/orchestrator", label: "Orchestrator", icon: "graph" },
  { href: "/guardrails", label: "Guardrails", icon: "guard" },
  { href: "/oversight", label: "Oversight", icon: "inbox" },
  { href: "/assurance", label: "Assurance", icon: "target" },
  { href: "/registry", label: "Inventory", icon: "box" },
  { href: "/trace", label: "Activity", icon: "pulse" },
  { href: "/frameworks", label: "Frameworks", icon: "shield" },
  { href: "/policies", label: "Policies", icon: "policy" },
  { href: "/trust", label: "Trust Cards", icon: "award" },
  { href: "/attestation", label: "Reports", icon: "file" },
  { href: "/monitoring", label: "Monitoring", icon: "chart" },
];

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <aside className="sticky top-0 flex h-screen w-[224px] shrink-0 flex-col border-r border-edge bg-sidebar">
      <div className="flex items-center gap-2 px-5 py-4">
        <span className="flex h-6 w-6 items-center justify-center rounded bg-brand text-[11px] font-bold text-ink">Rg</span>
        <span className="font-bold tracking-wide text-fg">REGENT</span>
      </div>
      <div className="px-3 pb-2 text-[10px] uppercase tracking-wider text-muted">Governance</div>
      <nav className="flex flex-col gap-0.5 px-2">
        {NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-[13px] ${
                active ? "bg-brand/15 text-fg" : "text-muted hover:bg-panel hover:text-fg"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={active ? "text-brand" : ""}
              >
                {ICONS[item.icon]}
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-5 py-4 text-[10px] leading-relaxed text-muted">
        deterministic · LLM-free
        <br />
        fail-closed · replayable
      </div>
    </aside>
  );
}
