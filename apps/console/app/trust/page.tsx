"use client";

import { useEffect, useState } from "react";

interface TrustClaim {
  label: string;
  value: string;
  proof: string;
}
interface TrustCard {
  pipeline: string;
  subject: string;
  vertical: string;
  grade: string;
  score: number;
  guarantees: { deterministicBindingPath: boolean; llmFree: boolean; failClosed: boolean; replayable: boolean };
  evidence: { assurancePassRate: number; attacksTotal: number; attacksContained: number; agents: number };
  claims: TrustClaim[];
  frameworks: { id: string; shortName: string; name: string }[];
}
interface SignedCard {
  card: TrustCard;
  issuedAt: string;
  signature: string;
}

const chip = "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold";

function gradeColor(g: string) {
  return g === "A" ? "text-ok" : g === "B" ? "text-ok" : g === "C" ? "text-warn" : "text-bad";
}

function download(sc: SignedCard) {
  const blob = new Blob([JSON.stringify({ schema: "regent/trust-card/v1", ...sc }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sc.card.pipeline}.trust-card.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TrustPage() {
  const [cards, setCards] = useState<SignedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const json = (await (await fetch("/api/trust-card")).json()) as { cards: SignedCard[] };
      setCards(json.cards ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">Trust Cards</h1>
        <p className="max-w-3xl text-[13px] text-muted">
          A shareable governance scorecard for each use case, generated from <span className="text-fg">real enforcement
          evidence</span> — the assurance suite, the kernel&rsquo;s structural guarantees, and framework mapping. Unlike a
          self-attested AI card, every claim is backed by binding, replayable proof. Each card is signed and tamper-evident.
        </p>
      </div>

      {loading ? (
        <p className="text-[13px] text-muted">Generating cards from assurance evidence…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {cards.map((sc) => {
            const c = sc.card;
            return (
              <div key={c.pipeline} className="flex flex-col rounded-xl border border-edge bg-panel p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted">Regent Trust Card</div>
                    <h2 className="text-[15px] font-semibold text-fg">{c.subject}</h2>
                    <p className="text-[11px] text-muted">{c.vertical}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-4xl font-bold leading-none ${gradeColor(c.grade)}`}>{c.grade}</div>
                    <div className="text-[11px] text-muted">{c.score}/100</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {c.claims.map((cl) => (
                    <div key={cl.label} className="rounded-md border border-edge bg-ink/50 px-2 py-1.5" title={cl.proof}>
                      <div className="text-[9.5px] uppercase tracking-wide text-muted">{cl.label}</div>
                      <div className="text-[12px] font-semibold text-fg">{cl.value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-3">
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-muted">Guarantees</div>
                  <div className="flex flex-wrap gap-1">
                    {[
                      ["deterministic", c.guarantees.deterministicBindingPath],
                      ["LLM-free", c.guarantees.llmFree],
                      ["fail-closed", c.guarantees.failClosed],
                      ["replayable", c.guarantees.replayable],
                    ].map(([label, on]) => (
                      <span key={label as string} className={`${chip} ${on ? "bg-ok/15 text-ok" : "bg-ink text-muted"}`}>✓ {label as string}</span>
                    ))}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-muted">Frameworks mapped</div>
                  <div className="flex flex-wrap gap-1">
                    {c.frameworks.map((f) => (
                      <span key={f.id} className={`${chip} bg-ink text-muted`}>{f.shortName}</span>
                    ))}
                  </div>
                </div>

                <div className="mt-3 border-t border-edge pt-2 text-[10px] text-muted">
                  <div>issued {sc.issuedAt} · Regent</div>
                  <div className="truncate">sig {sc.signature.slice(0, 24)}…</div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => download(sc)} className="rounded-lg border border-edge px-2.5 py-1 text-[11px] text-fg hover:bg-panel2">↓ download</button>
                  <button
                    onClick={() => {
                      void navigator.clipboard?.writeText(JSON.stringify({ schema: "regent/trust-card/v1", ...sc })).then(() => {
                        setCopied(c.pipeline);
                      });
                    }}
                    className="rounded-lg border border-edge px-2.5 py-1 text-[11px] text-muted hover:text-fg"
                  >
                    {copied === c.pipeline ? "copied ✓" : "copy"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
