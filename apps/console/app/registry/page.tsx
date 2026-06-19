import Link from "next/link";
import { EmptyState, Panel, TerminalBadge } from "../../components/ui";
import { listAgents } from "../../lib/db";

export const dynamic = "force-dynamic";

export default function RegistryPage() {
  const agents = listAgents();
  if (agents.length === 0) return <EmptyState />;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-fg">Agent Registry & Cards (P1)</h1>
      {agents.map((a) => (
        <Panel key={a.agentId} title={`${a.name} · ${a.agentId}`}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Row k="Purpose" v={a.purpose} />
              <Row k="Owner" v={a.owner} />
              <Row k="Supervising user" v={a.supervisingUser} />
              <Row k="Risk tier" v={`Tier ${a.tier}`} />
              <Row k="Capabilities" v={a.capabilities.join(", ")} />
              <Row k="Tools" v={a.tools.join(", ")} />
              <Row k="Authority scopes" v={a.authorityScopes.join(", ")} />
            </div>
            <div>
              <div className="mb-1 text-[10px] uppercase text-muted">Live trace links</div>
              <ul className="space-y-1">
                {a.traceLinks.map((l) => (
                  <li key={l.runId} className="flex items-center gap-2">
                    <Link href={`/trace?run=${encodeURIComponent(l.runId)}`} className="text-link hover:underline">
                      {l.runId}
                    </Link>
                    <TerminalBadge kind={l.terminalKind} />
                    <span className="text-[10px] text-muted">{l.auditable ? "auditable" : "un-auditable"}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>
      ))}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-36 shrink-0 text-[10px] uppercase text-muted">{k}</span>
      <span className="text-fg">{v}</span>
    </div>
  );
}
