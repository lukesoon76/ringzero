"use client";

import { useState } from "react";

interface GuardEval {
  guard: string;
  fired: boolean;
  score?: number;
  threshold?: number;
  advisory: boolean;
}
interface Step {
  index: number;
  fromNode: string;
  toNode: string;
  action: { id: string; intent: string; kind: string };
  decision: string;
  outcome: string;
  guardEvaluations: GuardEval[];
  verifyResult?: { verified: number; detail: string };
  note?: string;
}
interface Trajectory {
  tier: number;
  terminal: { node: string; kind: string; detail: string };
  steps: Step[];
}
interface RunResponse {
  ok: boolean;
  released?: boolean;
  trajectory?: Trajectory;
  error?: string;
}

const HAPPY = {
  id: "credit-memo",
  tier: 4,
  states: [
    { id: "start", initial: true },
    { id: "extracted" },
    { id: "retrieved" },
    { id: "drafted" },
    { id: "approved" },
    { id: "released", terminal: true },
  ],
  transitions: [
    { from: "start", to: "extracted", action: { id: "C1.extract", intent: "read" }, effect: { attrs: { Alignment: 0.5, Information: 0.6 } } },
    {
      from: "extracted",
      to: "retrieved",
      action: { id: "C2.retrieve", intent: "retrieve" },
      guard: [
        { type: "allowlist", field: "sourceAllowlisted" },
        { type: "recency", field: "recencyMonths", maxMonths: 18 },
      ],
      effect: { attrs: { Alignment: 1, Information: 0.9 } },
    },
    { from: "retrieved", to: "drafted", action: { id: "C4.draft", intent: "compute" }, effect: { data: { draft: "v1" } } },
    { from: "drafted", to: "approved", action: { id: "approve", intent: "control", kind: "control" }, effect: { flags: { mintApproval: true } } },
    { from: "approved", to: "released", action: { id: "C4.release", intent: "dispatch" }, effect: { data: { released: true } } },
  ],
  seed: {
    attrs: { Alignment: 0, Verified: 0, Length: 0, Information: 0, Confidence: 0 },
    data: {
      sourceAllowlisted: true,
      recencyMonths: 12,
      _verify: { checks: [{ kind: "numeric", label: "coverage", claimed: 1.82, recomputed: 1.82, tolerance: 0.01 }] },
    },
  },
};

function withSeedData(patch: Record<string, unknown>) {
  return { ...HAPPY, seed: { ...HAPPY.seed, data: { ...HAPPY.seed.data, ...patch } } };
}

const TEMPLATES: Record<string, unknown> = {
  "Credit memo — happy path": HAPPY,
  "Attack — 26-month-stale data": withSeedData({ recencyMonths: 26 }),
  "Attack — double-counted EBITDA": withSeedData({
    _verify: { checks: [{ kind: "numeric", label: "coverage", claimed: 2.82, recomputed: 1.82, tolerance: 0.01 }] },
  }),
};

const pill = (bg: string, fg: string) =>
  `inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${bg} ${fg}`;

export default function WorkbenchPage() {
  const [text, setText] = useState(JSON.stringify(HAPPY, null, 2));
  const [result, setResult] = useState<RunResponse | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: text,
      });
      setResult((await res.json()) as RunResponse);
    } catch (e) {
      setResult({ ok: false, error: String(e) });
    } finally {
      setBusy(false);
    }
  }

  function loadTemplate(name: string) {
    const tpl = TEMPLATES[name];
    if (tpl) setText(JSON.stringify(tpl, null, 2));
    setResult(null);
  }

  const t = result?.trajectory;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-fg">Workbench</h1>
        <p className="text-[13px] text-muted">
          Bring your own agentic workflow. Regent compiles it to a governed transition system and runs it under the
          deterministic kernel — declarative guards only, no code on the binding path.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-edge bg-panel p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Workflow spec</h2>
            <select
              onChange={(e) => loadTemplate(e.target.value)}
              defaultValue=""
              className="rounded-md border border-edge bg-ink px-2 py-1 text-[12px] text-fg"
            >
              <option value="" disabled>
                load template…
              </option>
              {Object.keys(TEMPLATES).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            className="h-[420px] w-full resize-none rounded-md border border-edge bg-ink p-3 font-mono text-[12px] leading-relaxed text-fg outline-none focus:border-brand"
          />
          <button
            onClick={run}
            disabled={busy}
            className="mt-3 rounded-md bg-brand px-4 py-2 text-[13px] font-semibold text-ink disabled:opacity-50"
          >
            {busy ? "running…" : "Run under governance ▶"}
          </button>
        </section>

        <section className="rounded-lg border border-edge bg-panel p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Governed result</h2>

          {!result ? (
            <p className="text-[13px] text-muted">Run a spec to see the governed trajectory.</p>
          ) : !result.ok ? (
            <div className="rounded-md bg-bad/10 p-3 text-[13px] text-bad">Compile error: {result.error}</div>
          ) : t ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <span
                  className={
                    t.terminal.kind === "Complete"
                      ? pill("bg-ok/15", "text-ok")
                      : pill("bg-warn/15", "text-warn")
                  }
                >
                  {t.terminal.kind}
                </span>
                <span className={result.released ? "text-bad" : "text-ok"}>
                  {result.released ? "released externally" : "no unauthorised release"}
                </span>
                <span className="text-muted">· tier {t.tier}</span>
              </div>
              <p className="text-[12px] text-muted">{t.terminal.detail}</p>

              <ol className="space-y-2">
                {t.steps.map((s) => (
                  <li key={s.index} className="rounded-md border border-edge p-2 text-[12px]">
                    <div className="flex items-center justify-between">
                      <span className="text-fg">
                        [{s.index}] {s.action.id}{" "}
                        <span className="text-muted">
                          · {s.decision} · {s.fromNode} → {s.toNode}
                        </span>
                      </span>
                      <span className={s.outcome === "blocked" ? "text-bad" : s.outcome === "verified" ? "text-ok" : "text-muted"}>
                        {s.outcome}
                      </span>
                    </div>
                    {s.note ? <div className="mt-1 text-warn">{s.note}</div> : null}
                    {s.verifyResult ? (
                      <div className="mt-1 text-muted">
                        verifier: verified={s.verifyResult.verified} — {s.verifyResult.detail}
                      </div>
                    ) : null}
                    {s.guardEvaluations.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {s.guardEvaluations.map((g, i) => (
                          <span
                            key={i}
                            className={g.fired ? pill("bg-warn/15", "text-warn") : pill("bg-edge", "text-muted")}
                          >
                            {g.guard}
                            {g.fired ? " fired" : ""}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
