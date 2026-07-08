import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AttestationView } from "./AttestationView";

export const dynamic = "force-dynamic";

function readDemoAttestation(): string | null {
  const path = process.env.RING_ZERO_ATTESTATION ?? resolve(process.cwd(), "..", "..", ".telemetry", "attestation.html");
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

export default function AttestationPage() {
  // The live coverage matrix is projected client-side from the inventory; the
  // print-ready HTML artifact from `pnpm demo` (if present) is passed through.
  return <AttestationView demoHtml={readDemoAttestation()} />;
}
