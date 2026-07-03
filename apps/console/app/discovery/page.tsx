"use client";

import { useEffect, useMemo, useState } from "react";

type EnforcementMode = "inline" | "native" | "observe";
interface AgentManifest {
  id: string;
  name: string;
  source: string;
  externalRef: string;
  discoveredVia: "control-plane" | "runtime" | "code";
  runtime: { platform: string; region?: string; tenant?: string };
  owner: string;
  tools: { id: string; intent: string }[];
  models: string[];
  dataSources: string[];
  autonomy: { canDispatchExternally: boolean; scopes: string[] };
  enforcement: { mode: EnforcementMode; bindable: boolean; via: string };
  riskSignals: { agency: number; authority: number; impact: number; exposure: number; recoverability: number };
}

const SOURCE_LABEL: Record<string, string> = {
  "aws-bedrock": "AWS Bedrock",
  "azure-ai-agents": "Azure AI",
  "salesforce-agentforce": "Salesforce Agentforce",
  "sap-joule": "SAP Joule",
  "code-scan": "Code scan",
  "otel-egress": "OTel egress",
};
const MODE: Record<EnforcementMode, { label: string; cls: string; note: string }> = {
  inline: { label: "INLINE · binding", cls: "bg-ok/15 text-ok", note: "Regent in the call path (MCP gateway) — deterministic" },
  native: { label: "NATIVE · binding", cls: "bg-warn/15 text-warn", note: "Regent policy pushed to the platform guardrail" },
  observe: { label: "OBSERVE · advisory", cls: "bg-edge text-muted", note: "trace ingest / post-hoc — detective, not preventive" },
};
const chip = "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold";
const STORE = "regent-discovery-triage";

function tier(m: AgentManifest) {
  const s = m.riskSignals;
  const t = [s.agency, s.authority, s.impact, s.exposure, s.recoverability].reduce((a, b) => a + b, 0);
  return t <= 3 ? 1 : t <= 7 ? 2 : t <= 11 ? 3 : 4;
}

export default function DiscoveryPage() {
  const [manifests, setManifests] = useState<AgentManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [triage, setTriage] = useState<Record<string, "governed" | "dismissed">>({});
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) setTriage(JSON.parse(raw) as Record<string, "governed" | "dismissed">);
    } catch {
      /* ignore */
    }
    void (async () => {
      const json = (await (await fetch("/api/discovery")).json()) as { manifests: AgentManifest[] };
      setManifests(json.manifests ?? []);
      setLoading(false);
    })();
  }, []);

  const persist = (next: Record<string, "governed" | "dismissed">) => {
    setTriage(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  const setStatus = (id: string, s: "governed" | "dismissed" | undefined) => {
    const next = { ...triage };
    if (s) next[id] = s;
    else delete next[id];
    persist(next);
  };

  const shown = filter === "all" ? manifests : manifests.filter((m) => m.source === filter);
  const active = manifests.filter((m) => triage[m.id] !== "dismissed");
  const governed = active.filter((m) => triage[m.id] === "governed").length;
  const coverage = active.length ? Math.round((governed / active.length) * 100) : 0;

  const bom = useMemo(() => {
    const models = new Set<string>();
    const tools = new Set<string>();
    const platforms = new Set<string>();
    for (const m of active) {
      m.models.forEach((x) => models.add(x));
      m.tools.forEach((x) => tools.add(x.id));
      platforms.add(m.runtime.platform);
    }
    return { models: models.size, tools: tools.size, platforms: platforms.size };
  }, [active]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">Discovery</h1>
        <p className="max-w-3xl text-[13px] text-muted">
          Universal, platform-agnostic agent detection. Connectors sweep AWS Bedrock, Azure AI, Salesforce Agentforce, SAP
          Joule, code repos, and runtime egress, normalise every agent to one schema, and bring them under a single control
          plane. Each agent shows how Regent can <span className="text-fg">enforce</span> on it.
        </p>
      </div>

      {/* coverage + BOM */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="col-span-2 rounded-xl border border-edge bg-panel p-3 md:col-span-2">
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="uppercase tracking-wider text-muted">Governed coverage</span>
            <span className="text-fg">{governed}/{active.length} · {coverage}%</span>
          </div>
          <div className="h-2 rounded-sm bg-ink">
            <div className="h-2 rounded-sm bg-ok" style={{ width: `${coverage}%` }} />
          </div>
        </div>
        <Stat label="Discovered" value={active.length} />
        <Stat label="Distinct models" value={bom.models} />
        <Stat label="Distinct tools (AI-BOM)" value={bom.tools} />
      </div>

      {/* source filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setFilter("all")} className={`${chip} border ${filter === "all" ? "border-fg/40 bg-fg/10 text-fg" : "border-edge text-muted hover:text-fg"}`}>all</button>
        {Object.keys(SOURCE_LABEL).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`${chip} border ${filter === s ? "border-fg/40 bg-fg/10 text-fg" : "border-edge text-muted hover:text-fg"}`}>
            {SOURCE_LABEL[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-[13px] text-muted">Sweeping platforms…</p>
      ) : (
        <div className="space-y-2">
          {shown.map((m) => {
            const st = triage[m.id];
            const mode = MODE[m.enforcement.mode];
            return (
              <div key={m.id} className={`rounded-xl border bg-panel p-3 ${st === "dismissed" ? "border-edge opacity-50" : "border-edge"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`${chip} bg-ink text-fg`}>{SOURCE_LABEL[m.source] ?? m.source}</span>
                  <span className="text-[13px] font-semibold text-fg">{m.name}</span>
                  <span className={`${chip} bg-ink text-muted`}>Tier {tier(m)}</span>
                  <span className={`${chip} ${mode.cls}`} title={mode.note}>{mode.label}</span>
                  {m.autonomy.canDispatchExternally ? <span className={`${chip} bg-bad/15 text-bad`}>can dispatch</span> : null}
                  <span className="text-[10px] text-muted">via {m.discoveredVia}</span>
                  <div className="ml-auto flex items-center gap-2">
                    {st === "governed" ? (
                      <span className={`${chip} bg-ok/15 text-ok`}>GOVERNED</span>
                    ) : st === "dismissed" ? (
                      <button onClick={() => setStatus(m.id, undefined)} className="text-[11px] text-muted hover:text-fg">restore</button>
                    ) : (
                      <>
                        <button onClick={() => setStatus(m.id, "governed")} className="rounded-lg bg-brand px-3 py-1 text-[11px] font-semibold text-ink">Govern</button>
                        <button onClick={() => setStatus(m.id, "dismissed")} className="rounded-lg border border-edge px-3 py-1 text-[11px] text-muted hover:text-fg">Dismiss</button>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                  <span>{m.runtime.platform}{m.runtime.region ? ` · ${m.runtime.region}` : ""}{m.runtime.tenant ? ` · ${m.runtime.tenant}` : ""}</span>
                  <span>owner: <span className="text-fg">{m.owner}</span></span>
                  <span>models: {m.models.join(", ") || "—"}</span>
                  <span>tools: {m.tools.map((t) => t.id).join(", ") || "—"}</span>
                </div>
                <div className="mt-1 text-[10px] text-muted">enforcement: {m.enforcement.via} · <code>{m.externalRef}</code></div>
              </div>
            );
          })}
          {shown.length === 0 ? <p className="text-[13px] text-muted">No agents from this source.</p> : null}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-edge bg-panel p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold tabular-nums text-fg">{value}</div>
    </div>
  );
}
