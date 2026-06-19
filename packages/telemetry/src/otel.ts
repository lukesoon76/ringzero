/**
 * OpenTelemetry-shaped export. We emit governance-semantic spans in OTLP/JSON
 * shape (one trace per run, one span per step, guard/constraint evaluations as
 * span events) that the local collector (otel-collector-config.yaml) can ingest.
 *
 * IDs are derived deterministically from (runId, stepIndex) rather than randomly
 * generated, so even the emitted spans are reproducible — preserving replay. The
 * binding store of record is SQLite (store.ts); OTLP is the interop surface.
 */

import type { Trajectory } from "@ring-zero/kernel";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface OtlpKeyValue {
  readonly key: string;
  readonly value: { readonly stringValue?: string; readonly intValue?: number; readonly boolValue?: boolean };
}

export interface OtlpEvent {
  readonly name: string;
  readonly attributes: readonly OtlpKeyValue[];
}

export interface OtlpSpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly name: string;
  readonly kind: number;
  readonly attributes: readonly OtlpKeyValue[];
  readonly events: readonly OtlpEvent[];
}

export interface OtlpTrace {
  readonly resourceSpans: ReadonlyArray<{
    readonly resource: { readonly attributes: readonly OtlpKeyValue[] };
    readonly scopeSpans: ReadonlyArray<{
      readonly scope: { readonly name: string };
      readonly spans: readonly OtlpSpan[];
    }>;
  }>;
}

const str = (key: string, value: string): OtlpKeyValue => ({ key, value: { stringValue: value } });
const num = (key: string, value: number): OtlpKeyValue => ({ key, value: { intValue: value } });
const bool = (key: string, value: boolean): OtlpKeyValue => ({ key, value: { boolValue: value } });

/** Convert a kernel Trajectory to OTLP/JSON resource spans with governance semantics. */
export function toOtlpTrace(trajectory: Trajectory, runId: string): OtlpTrace {
  const spans: OtlpSpan[] = trajectory.steps.map((step) => ({
    traceId: runId,
    spanId: `${runId}-${step.index}`,
    name: step.action.id,
    kind: 1,
    attributes: [
      str("ring_zero.capability", step.action.kind === "capability" ? step.action.id : "(control)"),
      str("ring_zero.tool_intent", step.action.intent),
      str("ring_zero.resource_scope", `${step.fromNode}->${step.toNode}`),
      str("ring_zero.decision", step.decision),
      str("ring_zero.outcome", step.outcome),
    ],
    events: [
      ...step.guardEvaluations.map((g) => ({
        name: "guard.evaluation",
        attributes: [
          str("guard", g.guard),
          bool("fired", g.fired),
          bool("advisory", g.advisory),
          ...(g.score === undefined ? [] : [num("score_milli", Math.round(g.score * 1000))]),
          ...(g.threshold === undefined ? [] : [num("threshold_milli", Math.round(g.threshold * 1000))]),
        ],
      })),
      ...step.constraintChecks
        .filter((c) => c.applicable)
        .map((c) => ({
          name: "constraint.check",
          attributes: [str("constraint", c.constraint), bool("pass", c.pass), str("detail", c.detail)],
        })),
      ...(step.verifyResult
        ? [
            {
              name: "verifier.result",
              attributes: [
                num("verified", step.verifyResult.verified),
                bool("timed_out", step.verifyResult.timedOut),
                str("detail", step.verifyResult.detail),
              ],
            },
          ]
        : []),
    ],
  }));

  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            str("service.name", "ring-zero"),
            str("ring_zero.policy", trajectory.policyId),
            num("ring_zero.tier", trajectory.tier),
            str("ring_zero.terminal", trajectory.terminal.kind),
          ],
        },
        scopeSpans: [{ scope: { name: "@ring-zero/telemetry" }, spans }],
      },
    ],
  };
}

/** Append the run's OTLP trace as one JSON line (collector-compatible sink). */
export function writeOtlpJsonl(trajectory: Trajectory, runId: string, path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(toOtlpTrace(trajectory, runId))}\n`);
}
