import { EmptyState, Panel } from "../../components/ui";
import { listRuns, loadRun } from "../../lib/db";

export const dynamic = "force-dynamic";

export default function MonitoringPage() {
  const runs = listRuns();
  if (runs.length === 0) return <EmptyState />;

  const details = runs.map((r) => loadRun(r.runId)).filter((d): d is NonNullable<typeof d> => d !== null);
  const totalSteps = details.reduce((n, d) => n + d.steps.length, 0);
  const guardEvals = details.reduce((n, d) => n + d.steps.reduce((m, s) => m + s.guards.length, 0), 0);
  const guardsFired = details.reduce(
    (n, d) => n + d.steps.reduce((m, s) => m + s.guards.filter((g) => g.outcome === "fired").length, 0),
    0,
  );
  const contained = runs.filter((r) => r.terminalKind !== "Complete").length;
  const completed = runs.filter((r) => r.terminalKind === "Complete").length;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-fg">Monitoring (P5)</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Governed runs" value={`${runs.length}`} />
        <Stat label="Steps governed" value={`${totalSteps}`} />
        <Stat label="Guard evaluations" value={`${guardEvals}`} />
        <Stat label="Guards fired" value={`${guardsFired}`} />
        <Stat label="Contained (Escalate/Halt)" value={`${contained}`} tone="warn" />
        <Stat label="Completed" value={`${completed}`} tone="ok" />
        <Stat label="Auditable" value={`${runs.filter((r) => r.auditable).length}/${runs.length}`} tone="ok" />
        <Stat label="Tier" value={`${runs[0]?.tier ?? "—"}`} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel title="Capability / trajectory signals (real)">
          <ul className="space-y-1 text-muted">
            {details.map((d) => (
              <li key={d.runId} className="flex justify-between">
                <span className="text-fg">{d.runId}</span>
                <span>
                  {d.steps.length} steps · {d.terminalKind}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Orchestration drift">
          <div className="mb-2 inline-block rounded bg-muted/15 px-2 py-0.5 text-[10px] font-semibold text-muted">
            MOCK — illustrative sample
          </div>
          <p className="mb-3 text-muted">
            Orchestration drift (distinct from data/model drift) tracks divergence of the agent's trajectory from its
            governed reference over time. Wired to a labelled sample for the pitch; real detector is post-seed (P5).
          </p>
          <svg viewBox="0 0 320 80" className="w-full">
            <polyline
              points="0,70 40,66 80,68 120,60 160,55 200,40 240,30 280,18 320,10"
              fill="none"
              stroke="#ff9d6b"
              strokeWidth="2"
            />
            <line x1="0" y1="35" x2="320" y2="35" stroke="#1f2a3a" strokeDasharray="4 4" />
          </svg>
          <p className="text-[10px] text-muted">dashed = governed reference · orange = sampled drift signal</p>
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-fg";
  return (
    <div className="rounded-lg border border-edge bg-panel p-3">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}
