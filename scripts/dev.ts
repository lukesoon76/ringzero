/**
 * `pnpm dev` entrypoint (Phase 0 stub).
 *
 * Once the console exists (Phase 7) this orchestrates the local dev stack:
 * the verify RPC child process, the OTel collector, the SQLite store, and the
 * Next.js console. For now it prints the workspace status.
 */

const PACKAGES = [
  ["kernel", "REAL", "guard engine + transition system W (Phase 1)"],
  ["policy", "REAL", "capability catalogue + builder→W compiler (Phase 1)"],
  ["mediation", "REAL", "complete-mediation gateway + approval events (Phase 2)"],
  ["verify", "REAL", "Python logical verifiers + RPC bridge (Phase 3)"],
  ["telemetry", "THIN", "OTel governance traces + SQLite + replay (Phase 4)"],
  ["pillars", "THIN", "registry · tiering · attestation (Phase 5)"],
  ["sdk", "THIN", "routes all tool intents through mediation"],
] as const;

console.log("Ring Zero — workspace (Phase 0 scaffold)\n");
for (const [name, stance, note] of PACKAGES) {
  console.log(`  ${stance.padEnd(4)}  @ring-zero/${name.padEnd(10)}  ${note}`);
}
console.log("\nRun `pnpm demo` for the (stubbed) credit-memo banner.");
