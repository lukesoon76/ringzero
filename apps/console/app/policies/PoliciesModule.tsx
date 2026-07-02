"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

export interface FrameworkLite {
  id: string;
  shortName: string;
  name: string;
}

interface AlertFlags {
  containment: boolean;
  block: boolean;
  guardFired: boolean;
  attackContained: boolean;
  unauthorisedRelease: boolean;
}
interface Policy {
  id: string;
  name: string;
  description: string;
  ownerGroup: string;
  enforcementDelay: string;
  webhook: string;
  alerts: AlertFlags;
  minTier: number;
  attestFrameworks: string[];
  cadence: string;
  requireEvidence: boolean;
  createdAt: string;
}

const STORE = "regent-policies";
const GROUPS = ["Credit Risk (1LoD)", "Model Risk (2LoD)", "Compliance (2LoD)", "Data Science", "Internal Audit (3LoD)"];
const DELAYS = ["Immediate", "7 Days", "30 Days", "90 Days"];
const WEBHOOKS = ["None", "Slack · #ai-governance", "PagerDuty · MRM", "Microsoft Teams · Risk"];
const CADENCES = ["On every release", "Daily", "Weekly", "Monthly", "Quarterly"];
const ALERT_DEFS: { key: keyof AlertFlags; label: string; hint: string }[] = [
  { key: "containment", label: "Agent contained / escalated", hint: "A governed agent escalates to a human" },
  { key: "block", label: "Run blocked / halted", hint: "The kernel halts a run fail-closed" },
  { key: "attackContained", label: "Attack contained", hint: "A known attack is blocked deterministically" },
  { key: "unauthorisedRelease", label: "Unauthorised release attempt", hint: "Dispatch without authenticated sign-off" },
  { key: "guardFired", label: "Guard fired (advisory)", hint: "Any guard evaluation fires, even if not terminal" },
];

const STEPS = ["Details", "Alert Rules", "Attestation Rules", "Confirmation"];

const NAV: { id: string; label: string; href?: string; desc?: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "discovery", label: "Discovery", href: "/registry", desc: "Discover and inventory governed agents." },
  { id: "checks", label: "Checks", href: "/workbench", desc: "Author and run governed checks in the Workbench." },
  { id: "policies", label: "Policies" },
  { id: "models", label: "Models", href: "/registry", desc: "Models and agents under governance." },
  { id: "tools", label: "Tools" },
  { id: "dependencies", label: "Dependencies", href: "/orchestrator", desc: "Inter-agent dependencies in the orchestrator." },
];

const chip = "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold";

const emptyForm = () => ({
  name: "",
  description: "",
  ownerGroup: "",
  enforcementDelay: "30 Days",
  webhook: "None",
  alerts: { containment: true, block: true, attackContained: true, unauthorisedRelease: true, guardFired: false } as AlertFlags,
  minTier: 3,
  attestFrameworks: [] as string[],
  cadence: "On every release",
  requireEvidence: true,
});

export function PoliciesModule({ frameworks }: { frameworks: FrameworkLite[] }) {
  const [view, setView] = useState("policies");
  const [creating, setCreating] = useState(false);
  const [policies, setPolicies] = useState<Policy[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) setPolicies(JSON.parse(raw) as Policy[]);
    } catch {
      /* ignore */
    }
  }, []);

  const persist = (next: Policy[]) => {
    setPolicies(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const startCreate = () => {
    setView("policies");
    setCreating(true);
  };

  return (
    <div className="-m-6 flex min-h-[calc(100vh-49px)]">
      {/* nested left pane */}
      <aside className="flex w-[232px] shrink-0 flex-col border-r border-edge bg-sidebar">
        <div className="px-4 py-4">
          <h2 className="text-[15px] font-bold text-fg">Governance</h2>
          <p className="text-[11px] text-muted">Policies &amp; Compliance</p>
        </div>
        <div className="px-3 pb-3">
          <button
            onClick={startCreate}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-edge bg-panel px-3 py-2 text-[12px] font-semibold text-fg hover:bg-panel2"
          >
            <span className="text-[14px] leading-none">+</span> POLICY
          </button>
        </div>
        <nav className="flex flex-col gap-0.5 px-2">
          {NAV.map((item) => {
            const active = !creating && view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCreating(false);
                  setView(item.id);
                }}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-[12.5px] ${
                  active ? "bg-fg/10 text-fg" : "text-muted hover:bg-panel hover:text-fg"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* content */}
      <section className="min-w-0 flex-1 px-6 py-6">
        {creating ? (
          <CreatePolicyWizard
            frameworks={frameworks}
            onCancel={() => setCreating(false)}
            onCreate={(p) => {
              persist([p, ...policies]);
              setCreating(false);
              setView("policies");
            }}
          />
        ) : view === "policies" ? (
          <PolicyList policies={policies} onNew={startCreate} onDelete={(id) => persist(policies.filter((p) => p.id !== id))} frameworks={frameworks} />
        ) : view === "overview" ? (
          <Overview policies={policies} />
        ) : view === "tools" ? (
          <Stub title="Tools" body="Capability catalogue and tool governance for agents under policy. The credit-memo and claims pipelines expose their tools to the orchestrator." />
        ) : (
          <LinkedStub item={NAV.find((n) => n.id === view)!} />
        )}
      </section>
    </div>
  );
}

/* ------------------------------- views ------------------------------- */

function PolicyList({
  policies,
  onNew,
  onDelete,
  frameworks,
}: {
  policies: Policy[];
  onNew: () => void;
  onDelete: (id: string) => void;
  frameworks: FrameworkLite[];
}) {
  const nameOf = (id: string) => frameworks.find((f) => f.id === id)?.shortName ?? id;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-fg">Policies</h1>
          <p className="text-[13px] text-muted">Governance policies enforced across agents and workflows.</p>
        </div>
        <button onClick={onNew} className="rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-ink">+ New Policy</button>
      </div>

      {policies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-edge bg-panel p-10 text-center">
          <p className="text-[13px] text-muted">No policies yet.</p>
          <button onClick={onNew} className="mt-3 rounded-lg border border-edge px-3 py-1.5 text-[12px] text-fg hover:bg-panel2">Create your first policy</button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-edge">
          <table className="w-full text-[12px]">
            <thead className="bg-panel2 text-[10px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 text-left">Policy</th>
                <th className="px-3 py-2 text-left">Owner</th>
                <th className="px-3 py-2 text-left">Enforcement</th>
                <th className="px-3 py-2 text-left">Min tier</th>
                <th className="px-3 py-2 text-left">Frameworks</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id} className="border-t border-edge">
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-fg">{p.name}</div>
                    {p.description ? <div className="text-[11px] text-muted">{p.description}</div> : null}
                  </td>
                  <td className="px-3 py-2.5 text-muted">{p.ownerGroup || "—"}</td>
                  <td className="px-3 py-2.5 text-muted">{p.enforcementDelay}</td>
                  <td className="px-3 py-2.5"><span className={`${chip} bg-ink text-fg`}>Tier {p.minTier}</span></td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {p.attestFrameworks.length === 0 ? <span className="text-muted">—</span> : p.attestFrameworks.map((id) => <span key={id} className={`${chip} bg-ink text-muted`}>{nameOf(id)}</span>)}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button onClick={() => onDelete(p.id)} className="text-[11px] text-muted hover:text-bad">delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Overview({ policies }: { policies: Policy[] }) {
  const byOwner = policies.reduce<Record<string, number>>((m, p) => ({ ...m, [p.ownerGroup || "Unassigned"]: (m[p.ownerGroup || "Unassigned"] ?? 0) + 1 }), {});
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-fg">Overview</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Policies" value={policies.length} />
        <Stat label="Owning groups" value={Object.keys(byOwner).length} />
        <Stat label="With attestation" value={policies.filter((p) => p.attestFrameworks.length > 0).length} />
        <Stat label="Webhook-notified" value={policies.filter((p) => p.webhook !== "None").length} />
      </div>
      <div className="rounded-xl border border-edge bg-panel p-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Policies by owner</h2>
        {Object.keys(byOwner).length === 0 ? (
          <p className="text-[12px] text-muted">No policies yet.</p>
        ) : (
          <ul className="space-y-1 text-[12px]">
            {Object.entries(byOwner).map(([k, v]) => (
              <li key={k} className="flex justify-between"><span className="text-fg">{k}</span><span className="text-muted">{v}</span></li>
            ))}
          </ul>
        )}
      </div>
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

function Stub({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-lg font-semibold text-fg">{title}</h1>
      <p className="max-w-2xl text-[13px] text-muted">{body}</p>
    </div>
  );
}

function LinkedStub({ item }: { item: { label: string; href?: string; desc?: string } }) {
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold text-fg">{item.label}</h1>
      <p className="max-w-2xl text-[13px] text-muted">{item.desc}</p>
      {item.href ? (
        <Link href={item.href} className="inline-flex rounded-lg border border-edge px-3 py-1.5 text-[12px] text-fg hover:bg-panel2">
          Open in Regent →
        </Link>
      ) : null}
    </div>
  );
}

/* ------------------------------ wizard ------------------------------ */

function CreatePolicyWizard({
  frameworks,
  onCancel,
  onCreate,
}: {
  frameworks: FrameworkLite[];
  onCancel: () => void;
  onCreate: (p: Policy) => void;
}) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState(emptyForm());
  const set = <K extends keyof ReturnType<typeof emptyForm>>(k: K, v: ReturnType<typeof emptyForm>[K]) => setF((p) => ({ ...p, [k]: v }));

  const canNext = step !== 0 || f.name.trim().length > 0;
  const isLast = step === STEPS.length - 1;

  const submit = () => {
    const id = `pol-${f.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${policiesSuffix()}`;
    onCreate({
      id,
      name: f.name.trim(),
      description: f.description.trim(),
      ownerGroup: f.ownerGroup,
      enforcementDelay: f.enforcementDelay,
      webhook: f.webhook,
      alerts: f.alerts,
      minTier: f.minTier,
      attestFrameworks: f.attestFrameworks,
      cadence: f.cadence,
      requireEvidence: f.requireEvidence,
      createdAt: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div className="space-y-5">
      <button onClick={onCancel} className="flex items-center gap-1.5 text-[12px] text-muted hover:text-fg">← Back to Policies</button>
      <h1 className="text-2xl font-semibold text-fg">Create New Policy</h1>

      <Stepper step={step} />

      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-fg">{STEPS[step]}</h2>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="rounded-lg border border-edge px-3 py-1.5 text-[12px] text-muted hover:text-fg">Cancel</button>
          {step > 0 ? <button onClick={() => setStep(step - 1)} className="rounded-lg border border-edge px-3 py-1.5 text-[12px] text-fg hover:bg-panel2">Back</button> : null}
          {isLast ? (
            <button onClick={submit} className="rounded-lg bg-brand px-4 py-1.5 text-[12px] font-semibold text-ink">Create Policy</button>
          ) : (
            <button
              disabled={!canNext}
              onClick={() => setStep(step + 1)}
              className={`rounded-lg px-4 py-1.5 text-[12px] font-semibold ${canNext ? "bg-brand text-ink" : "cursor-not-allowed bg-panel2 text-muted"}`}
            >
              Next
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-edge bg-panel p-6">
        {step === 0 ? <DetailsStep f={f} set={set} /> : null}
        {step === 1 ? <AlertStep f={f} set={set} /> : null}
        {step === 2 ? <AttestStep f={f} set={set} frameworks={frameworks} /> : null}
        {step === 3 ? <ConfirmStep f={f} frameworks={frameworks} /> : null}
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center">
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <span
                className={`grid h-7 w-7 place-items-center rounded-full text-[12px] font-semibold ${
                  active ? "bg-brand text-ink" : done ? "bg-fg/20 text-fg" : "bg-panel2 text-muted"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={`text-[13px] ${active ? "text-fg" : "text-muted"}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 ? <div className={`mx-3 h-px flex-1 ${done ? "bg-fg/30" : "bg-edge"}`} /> : null}
          </div>
        );
      })}
    </div>
  );
}

type Form = ReturnType<typeof emptyForm>;
type SetFn = <K extends keyof Form>(k: K, v: Form[K]) => void;

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-muted">{hint}</span> : null}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-edge bg-ink px-3 py-2 text-[13px] text-fg outline-none focus:border-fg/40";

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-[13px] font-bold text-fg">{title}</h3>
        {sub ? <p className="text-[12px] text-muted">{sub}</p> : null}
      </div>
      {children}
    </div>
  );
}

function DetailsStep({ f, set }: { f: Form; set: SetFn }) {
  return (
    <div className="max-w-2xl space-y-7">
      <Section title="Basic">
        <Field label="Policy Name *">
          <input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Enter Policy Name" className={inputCls} />
        </Field>
        <Field label="Description (Optional)">
          <textarea value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Add Description" rows={3} className={inputCls} />
        </Field>
      </Section>

      <Section title="Ownership" sub="Assign a group responsible for managing this policy">
        <Field label="Name">
          <select value={f.ownerGroup} onChange={(e) => set("ownerGroup", e.target.value)} className={inputCls}>
            <option value="">Select a group</option>
            {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
      </Section>

      <Section title="Enforcement delay" sub="Define how long the enforcement delay lasts. Applications will not trigger alerts until the enforcement delay expires.">
        <Field label="Enforcement delay period">
          <select value={f.enforcementDelay} onChange={(e) => set("enforcementDelay", e.target.value)} className={inputCls}>
            {DELAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
      </Section>

      <Section title="Notifications" sub="Set up webhook notifications for events related to this policy">
        <Field label="Webhook">
          <select value={f.webhook} onChange={(e) => set("webhook", e.target.value)} className={inputCls}>
            {WEBHOOKS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </Field>
      </Section>
    </div>
  );
}

function AlertStep({ f, set }: { f: Form; set: SetFn }) {
  return (
    <div className="max-w-2xl space-y-7">
      <Section title="Governance events" sub="Alert when any of these binding governance events occur on a covered agent">
        <div className="space-y-2">
          {ALERT_DEFS.map((a) => (
            <label key={a.key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-edge bg-ink px-3 py-2.5">
              <input
                type="checkbox"
                checked={f.alerts[a.key]}
                onChange={(e) => set("alerts", { ...f.alerts, [a.key]: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-white"
              />
              <span>
                <span className="block text-[13px] text-fg">{a.label}</span>
                <span className="block text-[11px] text-muted">{a.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Enforcement intensity" sub="Minimum risk tier (Θ) at which this policy binds. Lower-tier agents are monitored only.">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((t) => (
            <button
              key={t}
              onClick={() => set("minTier", t)}
              className={`h-9 flex-1 rounded-lg border text-[13px] font-semibold ${f.minTier === t ? "border-fg/40 bg-fg/10 text-fg" : "border-edge text-muted hover:text-fg"}`}
            >
              Tier {t}
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

function AttestStep({ f, set, frameworks }: { f: Form; set: SetFn; frameworks: FrameworkLite[] }) {
  const toggle = (id: string) => set("attestFrameworks", f.attestFrameworks.includes(id) ? f.attestFrameworks.filter((x) => x !== id) : [...f.attestFrameworks, id]);
  return (
    <div className="max-w-2xl space-y-7">
      <Section title="Frameworks attested" sub="Each covered run produces an attestation mapped to the selected frameworks (from the Frameworks library).">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {frameworks.map((fw) => {
            const on = f.attestFrameworks.includes(fw.id);
            return (
              <button
                key={fw.id}
                onClick={() => toggle(fw.id)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left ${on ? "border-fg/40 bg-fg/10" : "border-edge hover:bg-panel2"}`}
              >
                <span className={`grid h-4 w-4 place-items-center rounded-sm border ${on ? "border-fg bg-fg text-ink" : "border-edge"}`}>{on ? "✓" : ""}</span>
                <span>
                  <span className="block text-[12.5px] font-semibold text-fg">{fw.shortName}</span>
                  <span className="block text-[10.5px] text-muted">{fw.name}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Attestation cadence">
        <Field label="Generate attestation">
          <select value={f.cadence} onChange={(e) => set("cadence", e.target.value)} className={inputCls}>
            {CADENCES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-edge bg-ink px-3 py-2.5">
          <input type="checkbox" checked={f.requireEvidence} onChange={(e) => set("requireEvidence", e.target.checked)} className="h-4 w-4 accent-white" />
          <span>
            <span className="block text-[13px] text-fg">Require replayable trace evidence</span>
            <span className="block text-[11px] text-muted">Every satisfied control must resolve to a real, replayable trace event — gaps are reported, never asserted.</span>
          </span>
        </label>
      </Section>
    </div>
  );
}

function ConfirmStep({ f, frameworks }: { f: Form; frameworks: FrameworkLite[] }) {
  const alerts = ALERT_DEFS.filter((a) => f.alerts[a.key]).map((a) => a.label);
  const fw = f.attestFrameworks.map((id) => frameworks.find((x) => x.id === id)?.shortName ?? id);
  return (
    <div className="max-w-2xl space-y-5">
      <p className="text-[13px] text-muted">Review the policy before creating it. It will be enforced by the deterministic kernel across covered agents.</p>
      <Review label="Policy name" value={f.name || "—"} />
      <Review label="Description" value={f.description || "—"} />
      <Review label="Owner" value={f.ownerGroup || "Unassigned"} />
      <Review label="Enforcement delay" value={f.enforcementDelay} />
      <Review label="Webhook" value={f.webhook} />
      <Review label="Alert on" value={alerts.length ? alerts.join(", ") : "—"} />
      <Review label="Minimum tier" value={`Tier ${f.minTier}`} />
      <Review label="Frameworks attested" value={fw.length ? fw.join(", ") : "None"} />
      <Review label="Attestation cadence" value={f.cadence} />
      <Review label="Replayable evidence" value={f.requireEvidence ? "Required" : "Optional"} />
    </div>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 border-b border-edge pb-2.5">
      <span className="w-44 shrink-0 text-[12px] text-muted">{label}</span>
      <span className="text-[13px] text-fg">{value}</span>
    </div>
  );
}

function policiesSuffix() {
  // short non-crypto suffix for a readable id; uniqueness within the demo is sufficient.
  return Math.random().toString(36).slice(2, 6);
}
