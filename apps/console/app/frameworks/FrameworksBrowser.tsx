"use client";

import { useEffect, useMemo, useState } from "react";

interface Requirement {
  id: string;
  title: string;
  text: string;
  severity: "critical" | "high" | "medium";
}
export interface FrameworkPack {
  id: string;
  name: string;
  shortName: string;
  jurisdiction: string;
  authority: string;
  status: "In force" | "Phased" | "Proposed" | "Guidance";
  effective: string;
  summary: string;
  tags: string[];
  requirements: Requirement[];
}

const chip = "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold";
const STATUS_CLS: Record<FrameworkPack["status"], string> = {
  "In force": "bg-ok/15 text-ok",
  Phased: "bg-warn/15 text-warn",
  Proposed: "bg-fg/10 text-muted",
  Guidance: "bg-fg/10 text-fg",
};
const SEV_CLS: Record<Requirement["severity"], string> = {
  critical: "bg-bad/15 text-bad",
  high: "bg-warn/15 text-warn",
  medium: "bg-fg/10 text-muted",
};
const STORE = "rz-installed-frameworks";

function download(pack: FrameworkPack) {
  const blob = new Blob([JSON.stringify({ schema: "ring-zero/framework-pack/v1", source: "Regent Governance Studio", ...pack }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${pack.id}.framework.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function FrameworksBrowser({ packs }: { packs: FrameworkPack[] }) {
  const [query, setQuery] = useState("");
  const [installed, setInstalled] = useState<string[]>([]);
  const [onlyInstalled, setOnlyInstalled] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) setInstalled(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
  }, []);

  const persist = (next: string[]) => {
    setInstalled(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  const toggleInstall = (id: string) => persist(installed.includes(id) ? installed.filter((x) => x !== id) : [...installed, id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return packs.filter((p) => {
      if (onlyInstalled && !installed.includes(p.id)) return false;
      if (!q) return true;
      return [p.name, p.shortName, p.jurisdiction, p.authority, ...p.tags].join(" ").toLowerCase().includes(q);
    });
  }, [packs, query, onlyInstalled, installed]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-fg">Governance Frameworks</h1>
          <p className="max-w-3xl text-[13px] text-muted">
            A library of known AI-governance frameworks. Choose the ones in scope for your workspace and download each as a
            portable pack. Frameworks are data — adding one is an authoring task, not a code change.
          </p>
        </div>
        <div className="text-right text-[12px] text-muted">
          <div>
            <span className="text-fg">{packs.length}</span> frameworks
          </div>
          <div>
            <span className="text-fg">{installed.length}</span> installed
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, jurisdiction, tag…"
          className="w-72 rounded-lg border border-edge bg-ink px-3 py-1.5 text-[12px] text-fg outline-none focus:border-fg/40"
        />
        <button
          onClick={() => setOnlyInstalled((v) => !v)}
          className={`rounded-lg border px-3 py-1.5 text-[12px] ${
            onlyInstalled ? "border-fg/40 bg-fg/10 text-fg" : "border-edge text-muted hover:text-fg"
          }`}
        >
          Installed only
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((p) => {
          const isInstalled = installed.includes(p.id);
          const isOpen = open[p.id];
          return (
            <div key={p.id} className="flex flex-col rounded-xl border border-edge bg-panel p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="rounded border border-edge bg-ink px-1.5 py-0.5 font-mono text-[11px] text-fg">{p.shortName}</span>
                <span className={`${chip} ${STATUS_CLS[p.status]}`}>{p.status}</span>
              </div>
              <h2 className="text-[14px] font-semibold leading-snug text-fg">{p.name}</h2>
              <p className="mt-0.5 text-[11px] text-muted">
                {p.jurisdiction} · {p.authority} · {p.effective}
              </p>
              <p className="mt-2 text-[12px] leading-snug text-muted">{p.summary}</p>

              <div className="mt-2 flex flex-wrap gap-1">
                {p.tags.map((t) => (
                  <span key={t} className={`${chip} bg-ink text-muted`}>
                    {t}
                  </span>
                ))}
              </div>

              {isOpen ? (
                <ul className="mt-3 space-y-2 border-t border-edge pt-3">
                  {p.requirements.map((r) => (
                    <li key={r.id} className="text-[11.5px]">
                      <div className="flex items-center gap-2">
                        <span className={`${chip} ${SEV_CLS[r.severity]}`}>{r.severity}</span>
                        <span className="font-semibold text-fg">{r.title}</span>
                      </div>
                      <p className="mt-0.5 text-muted">{r.text}</p>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-auto flex items-center gap-2 pt-3">
                <button
                  onClick={() => setOpen((o) => ({ ...o, [p.id]: !o[p.id] }))}
                  className="rounded-lg border border-edge px-2.5 py-1 text-[11px] text-muted hover:text-fg"
                >
                  {isOpen ? "Hide" : `${p.requirements.length} requirements`}
                </button>
                <button
                  onClick={() => download(p)}
                  className="rounded-lg border border-edge px-2.5 py-1 text-[11px] text-fg hover:bg-fg/10"
                >
                  ↓ download
                </button>
                <button
                  onClick={() => toggleInstall(p.id)}
                  className={`ml-auto rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                    isInstalled ? "border border-ok/40 bg-ok/10 text-ok" : "bg-brand text-ink"
                  }`}
                >
                  {isInstalled ? "✓ installed" : "install"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 ? <p className="text-[13px] text-muted">No frameworks match your search.</p> : null}
    </div>
  );
}
