import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Panel } from "../../components/ui";

export const dynamic = "force-dynamic";

function readAttestation(): string | null {
  const path = process.env.RING_ZERO_ATTESTATION ?? resolve(process.cwd(), "..", "..", ".telemetry", "attestation.html");
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

export default function AttestationPage() {
  const html = readAttestation();
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-bold text-fg">Attestation Export (P6)</h1>
        <p className="text-muted">
          Generated from the same run evidence as enforcement, across EU AI Act / MAS / Singapore MGF / NIST AI RMF /
          ISO 42001. A live coverage score and a severity-ranked gap list fall out of the run; every satisfied control
          resolves to a replayable trace event; gaps are reported, never asserted satisfied. Print-to-PDF for the
          auditor artifact.
        </p>
      </header>
      {html ? (
        <iframe srcDoc={html} title="attestation" className="h-[72vh] w-full rounded-lg border border-edge" />
      ) : (
        <Panel>
          <p className="text-muted">
            No attestation yet. Run <code className="text-fg">pnpm demo</code> to produce one from a real governed run.
          </p>
        </Panel>
      )}
    </div>
  );
}
