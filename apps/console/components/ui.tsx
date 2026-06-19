import type { ReactNode } from "react";
import type { Stance } from "../lib/pillars";

export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-edge bg-panel p-4">
      {title ? <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2> : null}
      {children}
    </section>
  );
}

export function StanceBadge({ stance }: { stance: Stance }) {
  const cls =
    stance === "REAL" ? "bg-ok/15 text-ok" : stance === "THIN" ? "bg-link/15 text-link" : "bg-muted/15 text-muted";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>{stance}</span>;
}

export function TerminalBadge({ kind }: { kind: string }) {
  const ok = kind === "Complete";
  const cls = ok ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>{kind}</span>;
}

export function EmptyState() {
  return (
    <Panel>
      <p className="text-muted">
        No telemetry found. Run <code className="text-fg">pnpm demo</code> from the repo root to generate the
        governed runs, then refresh.
      </p>
    </Panel>
  );
}
