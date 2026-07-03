/**
 * Compliance mesh engine — evaluate agents/workflows against ONE or a COMBINATION
 * of governance frameworks, and compare posture across jurisdictions (franchises).
 *
 * Deterministic and honest: each framework requirement is matched to a check over
 * the agent's inventory manifest + Regent's structural guarantees (can Regent
 * bind/contain it? is it governed, owned, materiality-assessed, third-party
 * documented?). Requirements Regent cannot auto-verify (fairness/ethics/
 * transparency) are marked "manual" — never silently passed or failed.
 *
 *   pass                        → compliant
 *   fail, severity critical     → breach
 *   fail, severity high/medium  → gap
 *   no automatable check        → manual
 */

import type { FrameworkPack } from "@ring-zero/policy";
import type { AgentManifest } from "./manifest.js";

export type ComplianceStatus = "compliant" | "gap" | "breach" | "manual";
export type PostureStatus = "compliant" | "gaps" | "breach";

export interface RequirementResult {
  readonly frameworkId: string;
  readonly frameworkShort: string;
  readonly requirementId: string;
  readonly title: string;
  readonly severity: string;
  readonly status: ComplianceStatus;
  readonly rationale: string;
}
export interface AgentCompliance {
  readonly agentId: string;
  readonly agentName: string;
  readonly results: readonly RequirementResult[];
  readonly counts: { compliant: number; gap: number; breach: number; manual: number };
  readonly status: PostureStatus;
  readonly score: number;
}

type CheckKey =
  | "inventory"
  | "materiality"
  | "oversight"
  | "records"
  | "technical-controls"
  | "third-party"
  | "data-governance"
  | "lifecycle"
  | "manual";

/** Keyword → check mapping. Frameworks are free data, so we match on requirement text. */
function checkFor(req: { id: string; title: string; text: string }): CheckKey {
  const s = `${req.id} ${req.title} ${req.text}`.toLowerCase();
  if (/inventor|identif/.test(s)) return "inventory";
  if (/materiality|risk management|risk assessment|impact assess/.test(s)) return "materiality";
  if (/oversight|human|accountab|intervene|approval/.test(s)) return "oversight";
  if (/record|logging|log\b|documentation|traceab/.test(s)) return "records";
  if (/technical control|containment|robust|resilien|security|cyber|monitor|accuracy/.test(s)) return "technical-controls";
  if (/third[ -]?party|vendor|provider|sub-processor|procure/.test(s)) return "third-party";
  if (/data governance|data quality|data management|data set/.test(s)) return "data-governance";
  if (/validation|development|deploy|lifecycle/.test(s)) return "lifecycle";
  return "manual"; // fairness / ethics / transparency / disclosure → human review
}

const assessed = (a: AgentManifest) => a.lifecycleStage !== "intake" && !a.materiality.tierRationale.toLowerCase().startsWith("unassessed");

/** Returns true (pass) / false (fail) / "manual". */
function runCheck(key: CheckKey, a: AgentManifest): boolean | "manual" {
  switch (key) {
    case "inventory":
      return a.owner !== "Unassigned" && !!a.owner;
    case "materiality":
      return assessed(a);
    case "oversight":
      // Regent can enforce oversight/intervention only if it can bind inline.
      return a.enforcement.bindable && a.enforcement.mode !== "observe";
    case "records":
      return a.enforcement.mode !== "observe"; // governed path is replayable; observe-only is not
    case "technical-controls":
      return a.enforcement.bindable; // Regent can deterministically contain
    case "third-party":
      return !a.thirdParty || !!a.thirdParty.provider; // documented if present
    case "data-governance":
      return a.dataCategories.length > 0 && !a.dataCategories.includes("unknown");
    case "lifecycle":
      return a.lifecycleStage === "validation" || a.lifecycleStage === "deployed";
    case "manual":
      return "manual";
  }
}

function statusFor(pass: boolean | "manual", severity: string): ComplianceStatus {
  if (pass === "manual") return "manual";
  if (pass) return "compliant";
  return severity === "critical" ? "breach" : "gap";
}

function rationaleFor(key: CheckKey, status: ComplianceStatus, a: AgentManifest): string {
  if (status === "manual") return "requires human review — not deterministically verifiable by Regent";
  const ok = status === "compliant";
  switch (key) {
    case "inventory": return ok ? "in inventory with an accountable owner" : "not attributed to an owner (shadow AI)";
    case "materiality": return ok ? "materiality assessed and tiered" : "materiality not assessed";
    case "oversight": return ok ? "Regent can bind human oversight inline" : `oversight not bindable (${a.enforcement.mode})`;
    case "records": return ok ? "governed path is replayable / logged" : "observe-only — no replayable record";
    case "technical-controls": return ok ? "Regent can deterministically contain" : `unenforced (${a.enforcement.mode})${a.autonomy.canDispatchExternally ? " while able to dispatch externally" : ""}`;
    case "third-party": return ok ? "third-party provider documented" : "third-party AI not documented";
    case "data-governance": return ok ? "data categories documented" : "data categories undocumented";
    case "lifecycle": return ok ? `lifecycle stage: ${a.lifecycleStage}` : `not through validation (${a.lifecycleStage})`;
    default: return "";
  }
}

export function evaluateAgent(agent: AgentManifest, frameworks: readonly FrameworkPack[]): AgentCompliance {
  const results: RequirementResult[] = [];
  for (const f of frameworks) {
    for (const req of f.requirements) {
      const key = checkFor(req);
      const pass = runCheck(key, agent);
      const status = statusFor(pass, req.severity);
      results.push({
        frameworkId: f.id,
        frameworkShort: f.shortName,
        requirementId: req.id,
        title: req.title,
        severity: req.severity,
        status,
        rationale: rationaleFor(key, status, agent),
      });
    }
  }
  const counts = {
    compliant: results.filter((r) => r.status === "compliant").length,
    gap: results.filter((r) => r.status === "gap").length,
    breach: results.filter((r) => r.status === "breach").length,
    manual: results.filter((r) => r.status === "manual").length,
  };
  const status: PostureStatus = counts.breach > 0 ? "breach" : counts.gap > 0 ? "gaps" : "compliant";
  const graded = counts.compliant + counts.gap + counts.breach;
  const score = graded ? Math.round((counts.compliant / graded) * 100) : 100;
  return { agentId: agent.id, agentName: agent.name, results, counts, status, score };
}

export interface Jurisdiction {
  readonly id: string;
  readonly label: string;
  readonly region: string;
  readonly frameworks: readonly string[];
}

/** Franchise / jurisdiction → applicable frameworks (drives the geography comparison). */
export const JURISDICTIONS: readonly Jurisdiction[] = [
  { id: "sg", label: "Singapore", region: "APAC", frameworks: ["mas-feat", "mas-ai-rg", "sg-mgf"] },
  { id: "eu", label: "European Union", region: "EMEA", frameworks: ["eu-ai-act", "iso-42001"] },
  { id: "us", label: "United States", region: "AMER", frameworks: ["nist-ai-rmf", "colorado-sb21-169", "nyc-ll144"] },
  { id: "intl", label: "International baseline", region: "Global", frameworks: ["iso-42001", "nist-ai-rmf"] },
];

export function worstStatus(items: readonly PostureStatus[]): PostureStatus {
  if (items.includes("breach")) return "breach";
  if (items.includes("gaps")) return "gaps";
  return "compliant";
}
