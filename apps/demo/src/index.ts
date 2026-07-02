/**
 * `pnpm demo` — the credit-memo (U3) side-by-side. The SAME thin agent composing
 * C1–C4, run (a) UNGOVERNED and (b) GOVERNED by Regent, driven through the
 * five attacks. Ungoverned: all five land. Governed: all five blocked/contained,
 * deterministically, LLM-free on the binding path, fail-closed, replayable — with
 * a one-click attestation falling out of the same telemetry.
 *
 * This side-by-side is the acceptance test for the whole prototype.
 */

import { runTrajectory } from "@ring-zero/kernel";
import { Gateway, IdentityRegistry } from "@ring-zero/mediation";
import { buildCreditMemoPolicy, seedHappyPath, thetaForTier } from "@ring-zero/policy";
import {
  generateAttestation,
  Registry,
  renderAttestationHtml,
  scoreToTier,
} from "@ring-zero/pillars";
import { replaysExactly, TelemetryStore, writeOtlpJsonl } from "@ring-zero/telemetry";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { draftCreditMemo } from "./agent.js";
import { runGovernedAttack } from "./governed.js";
import { ATTACKS, DEMO_AGENT_ID, DEMO_AGENT_SCOPES } from "./scenario.js";
import { runUngovernedAttack } from "./ungoverned.js";

const DB = resolve(process.cwd(), ".telemetry", "demo.db");
const OTLP = resolve(process.cwd(), ".telemetry", "demo-otel.jsonl");
const ATTESTATION = resolve(process.cwd(), ".telemetry", "attestation.html");
const ATTESTATION_JSON = resolve(process.cwd(), ".telemetry", "attestation.json");

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

async function main(): Promise<void> {
  console.log(bold("\n  REGENT — credit-memo side-by-side (U3)\n"));

  // P2: assess risk → tier → enforcement intensity Θ.
  const assessment = scoreToTier({ agency: 3, authority: 3, impact: 3, exposure: 3, recoverability: 2 });
  const theta = thetaForTier(assessment.tier);
  console.log(`  Risk tiering: ${assessment.rationale}`);
  console.log(
    dim(
      `  Enforcement: tier ${assessment.tier} ⇒ Θ thresholds A≥${theta.thresholds.Alignment}, ` +
        `dual-approval=${theta.requireDualApproval}, containment=${theta.defaultContainment}\n`,
    ),
  );

  const W = buildCreditMemoPolicy();
  const identities = new IdentityRegistry().register({
    agentId: DEMO_AGENT_ID,
    supervisingUser: "risk-officer@bank",
    grantedScopes: DEMO_AGENT_SCOPES,
  });
  const gateway = new Gateway(W, { identities });
  const store = new TelemetryStore(DB);
  const registry = new Registry(DB);

  const draft = await draftCreditMemo(1.82);
  console.log(dim(`  Agent draft (${draft.source}, non-binding): "${draft.memo}"\n`));

  console.log(bold("  ATTACK                                    UNGOVERNED              GOVERNED (Regent)"));
  console.log(dim("  ─────────────────────────────────────────────────────────────────────────────────────"));

  let ungovernedFailures = 0;
  let governedBlocked = 0;

  for (const attack of ATTACKS) {
    const u = runUngovernedAttack(attack.id);
    const g = runGovernedAttack(attack.id, W, theta, gateway);
    if (u.failureLanded) ungovernedFailures++;
    if (g.blocked) governedBlocked++;

    if (g.trajectory) {
      store.recordRun(g.trajectory, { runId: g.runId, agentId: DEMO_AGENT_ID, governed: true });
      writeOtlpJsonl(g.trajectory, g.runId, OTLP);
    }

    const label = `${attack.n}. ${attack.title}`.padEnd(42).slice(0, 42);
    console.log(`  ${label}${red("✗ " + u.shipped).padEnd(33)}${green("✓ blocked")}  ${dim("(" + g.terminalKind + ")")}`);
    console.log(dim(`     ungoverned: ${u.description}`));
    console.log(dim(`     governed:   ${g.reason}`));
  }

  // A clean governed release run — the auditable success path + attestation source.
  const happy = runTrajectory(W, theta, seedHappyPath);
  store.recordRun(happy, { runId: "gov-release", agentId: DEMO_AGENT_ID, governed: true });
  writeOtlpJsonl(happy, "gov-release", OTLP);

  registry.register({
    agentId: DEMO_AGENT_ID,
    name: "Credit-memo agent",
    purpose: "Draft and release a credit memo under deterministic governance.",
    owner: "Credit Risk (1LoD)",
    supervisingUser: "risk-officer@bank",
    tier: assessment.tier,
    tools: ["extract", "retrieve", "compute", "draft", "release"],
    authorityScopes: DEMO_AGENT_SCOPES,
    capabilities: ["C1", "C2", "C3", "C4"],
  });

  // Replay + audit the governed release run.
  const reconstructed = store.loadRun("gov-release");
  const audit = store.auditRun("gov-release");
  const replays = replaysExactly(happy, reconstructed);

  // Attestation from real run evidence.
  const attestation = generateAttestation(reconstructed, "credit-memo (U3)");
  writeFileSync(ATTESTATION, renderAttestationHtml(attestation, { traceViewerBase: "/trace" }));
  writeFileSync(ATTESTATION_JSON, JSON.stringify(attestation, null, 2));

  console.log(dim("\n  ─────────────────────────────────────────────────────────────────────────────────────"));
  console.log(
    `  ${bold("Result:")} ungoverned ${red(`${ungovernedFailures}/5 failed`)} · governed ${green(`${governedBlocked}/5 blocked/contained`)}`,
  );
  console.log(
    `  ${bold("Governed release run:")} replays ${replays ? green("exactly") : red("MISMATCH")} · audit ${audit.auditable ? green("auditable") : red("UN-AUDITABLE")}`,
  );
  console.log(
    `  ${bold("Attestation:")} ${attestation.coveragePct}% coverage — ` +
      `${attestation.controls.filter((c) => c.satisfied).length}/${attestation.controls.length} controls across ` +
      `EU AI Act / MAS / Singapore MGF / NIST AI RMF / ISO 42001` +
      (attestation.gaps.length ? dim(` · top gap: ${attestation.gaps[0]}`) : ""),
  );
  console.log(dim(`\n  Artifacts:  ${DB}\n              ${OTLP}\n              ${ATTESTATION}`));
  console.log(dim("  Console:    pnpm --filter @ring-zero/console dev   (Pillar map · Trace viewer · Attestation)\n"));

  store.close();
  registry.close();

  if (ungovernedFailures !== 5 || governedBlocked !== 5) {
    console.error(red("  ACCEPTANCE FAILED: expected ungoverned 5/5 and governed 5/5."));
    process.exitCode = 1;
  }
}

void main();
