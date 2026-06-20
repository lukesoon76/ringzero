import Link from "next/link";
import { EmptyState, TerminalBadge } from "../components/ui";
import {
  frameworkCoverage,
  listAgents,
  listRuns,
  readAttestation,
  type FrameworkCoverage,
} from "../lib/db";

export const dynamic = "force-dynamic";

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" }) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-fg";
  return (
    <div className="rounded-lg border border-edge bg-panel p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
      {sub ? <div className="text-[11px] text-muted">{sub}</div> : null}
    </div>
  );
}

function CoverageBar({ c }: { c: FrameworkCoverage }) {
  const pct = c.total > 0 ? Math.round((c.satisfied / c.total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[12px]">
        <span className="text-fg">{c.framework}</span>
        <span className="text-muted">
          {c.satisfied}/{c.total} controls · {pct}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-edge">
        <div className="h-full rounded bg-brand" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const runs = listRuns();
  if (runs.length === 0) return <EmptyState />;

  const agents = listAgents();
  const att = readAttestation();
  const coverage = frameworkCoverage(att);
  const auditable = runs.filter((r) => r.auditable).length;
  const contained = runs.filter((r) => r.terminalKind !== "Complete").length;
  const satisfied = att ? att.controls.filter((c) => c.satisfied).length : 0;
  const totalControls = att ? att.controls.length : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-fg">Governance dashboard</h1>
        <p className="text-[13px] text-muted">
          Deterministic runtime enforcement over agent execution — every decision binding, fail-closed, and replayable.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric label="Agents governed" value={`${agents.length}`} sub="bound to a supervising user" />
        <Metric label="Governed runs" value={`${runs.length}`} sub={`${contained} contained`} />
        <Metric label="Auditable" value={`${auditable}/${runs.length}`} sub="replayable from telemetry" tone="ok" />
        <Metric
          label="Controls satisfied"
          value={totalControls ? `${satisfied}/${totalControls}` : "—"}
          sub="from real run evidence"
          tone="ok"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-lg border border-edge bg-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Governance activity</h2>
            <Link href="/trace" className="text-[12px] text-brand hover:underline">
              open trace viewer →
            </Link>
          </div>
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted">
                <th className="py-2 pr-3">Run</th>
                <th className="py-2 pr-3">Tier</th>
                <th className="py-2 pr-3">Outcome</th>
                <th className="py-2">Audit</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.runId} className="border-t border-edge">
                  <td className="py-2 pr-3">
                    <Link href={`/trace?run=${encodeURIComponent(r.runId)}`} className="text-brand hover:underline">
                      {r.runId}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-muted">{r.tier}</td>
                  <td className="py-2 pr-3">
                    <TerminalBadge kind={r.terminalKind} />
                  </td>
                  <td className="py-2 text-[12px]">
                    {r.auditable ? <span className="text-ok">auditable</span> : <span className="text-bad">un-auditable</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-lg border border-edge bg-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Framework coverage</h2>
            <Link href="/attestation" className="text-[12px] text-brand hover:underline">
              report →
            </Link>
          </div>
          <div className="space-y-3">
            {coverage.map((c) => (
              <CoverageBar key={c.framework} c={c} />
            ))}
          </div>
          {att && att.gaps.length === 0 ? (
            <p className="mt-4 text-[12px] text-ok">No open gaps — every mapped control resolves to a real trace event.</p>
          ) : (
            <p className="mt-4 text-[12px] text-warn">{att ? `${att.gaps.length} gap(s) reported` : "Run the demo to populate."}</p>
          )}
        </section>
      </div>
    </div>
  );
}
