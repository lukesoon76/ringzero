/**
 * Content guardrail detectors for the mediation boundary.
 *
 * CRITICAL (hard constraint): the GATE decision is made ONLY by DETERMINISTIC
 * detectors (regex / signature / schema — total, bounded, reproducible). Their
 * result may block a tool call / dispatch on the binding path. ADVISORY detectors
 * (heuristic "model" scores for toxicity / off-topic) are LABELLED advisory and
 * NEVER decide the gate — they only annotate telemetry and may route a run to
 * human oversight. This is exactly Regent's differentiation: probabilistic
 * signals become inputs to a deterministic gate, they never are the gate.
 */

export type DetectorFamily = "pii" | "secrets" | "jailbreak" | "output-schema" | "toxicity" | "off-topic";

export interface DetectorResult {
  readonly id: string;
  readonly family: DetectorFamily;
  readonly label: string;
  /** true ⇒ may bind the gate; false ⇒ advisory only, never binds. */
  readonly deterministic: boolean;
  readonly triggered: boolean;
  /** advisory score in [0,1]; absent for deterministic detectors. */
  readonly score?: number;
  readonly detail: string;
  readonly matches?: readonly string[];
}

export interface GuardrailReport {
  readonly results: readonly DetectorResult[];
  /** deterministic block decision — the only thing that binds. */
  readonly blocked: boolean;
  readonly blockedBy: readonly string[];
  /** advisory flags — informational; can route to oversight, never auto-block. */
  readonly advisories: readonly DetectorResult[];
}

export interface GuardrailOptions {
  /** Required top-level keys for the output-schema detector (JSON expected). */
  readonly requiredFields?: readonly string[];
  /** Allowed topic keywords for the off-topic advisory detector. */
  readonly topicKeywords?: readonly string[];
}

/* ---------------- deterministic detectors (may bind the gate) ---------------- */

const PII_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "email", re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi },
  { label: "US SSN", re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { label: "phone", re: /\b(?:\+?\d{1,3}[ -]?)?(?:\(\d{3}\)|\d{3})[ -]?\d{3}[ -]?\d{4}\b/g },
];

function luhnOk(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function detectPii(text: string): DetectorResult {
  const matches: string[] = [];
  for (const p of PII_PATTERNS) {
    const found = text.match(p.re);
    if (found) matches.push(...found.map((m) => `${p.label}: ${m}`));
  }
  // credit-card-like: 13–19 digit runs passing Luhn
  for (const m of text.match(/\b(?:\d[ -]?){13,19}\b/g) ?? []) {
    const digits = m.replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhnOk(digits)) matches.push(`card: ${m.trim()}`);
  }
  return {
    id: "pii",
    family: "pii",
    label: "Personal data (PII)",
    deterministic: true,
    triggered: matches.length > 0,
    detail: matches.length ? `${matches.length} PII item(s) detected` : "no PII detected",
    matches,
  };
}

const SECRET_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { label: "OpenAI-style key", re: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { label: "private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { label: "generic secret", re: /\b(?:api[_-]?key|secret|token|password)\b\s*[:=]\s*['"]?[A-Za-z0-9_-]{16,}/gi },
];

function detectSecrets(text: string): DetectorResult {
  const matches: string[] = [];
  for (const p of SECRET_PATTERNS) {
    const found = text.match(p.re);
    if (found) matches.push(...found.map(() => p.label));
  }
  const uniq = [...new Set(matches)];
  return {
    id: "secrets",
    family: "secrets",
    label: "Leaked secrets / credentials",
    deterministic: true,
    triggered: uniq.length > 0,
    detail: uniq.length ? `credential pattern(s): ${uniq.join(", ")}` : "no credentials detected",
    matches: uniq,
  };
}

const JAILBREAK_SIGNATURES = [
  "ignore previous instructions",
  "ignore all previous",
  "disregard the above",
  "disregard your instructions",
  "you are now dan",
  "developer mode",
  "do anything now",
  "bypass your guidelines",
  "reveal your system prompt",
  "pretend you have no rules",
];

function detectJailbreak(text: string): DetectorResult {
  const lc = text.toLowerCase();
  const hits = JAILBREAK_SIGNATURES.filter((s) => lc.includes(s));
  return {
    id: "jailbreak",
    family: "jailbreak",
    label: "Prompt-injection / jailbreak",
    deterministic: true,
    triggered: hits.length > 0,
    detail: hits.length ? `signature(s): ${hits.join("; ")}` : "no injection signature",
    matches: hits,
  };
}

function detectOutputSchema(text: string, requiredFields?: readonly string[]): DetectorResult | null {
  if (!requiredFields || requiredFields.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { id: "output-schema", family: "output-schema", label: "Output schema", deterministic: true, triggered: true, detail: "output is not valid JSON" };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { id: "output-schema", family: "output-schema", label: "Output schema", deterministic: true, triggered: true, detail: "output is not a JSON object" };
  }
  const missing = requiredFields.filter((f) => !(f in (parsed as Record<string, unknown>)));
  return {
    id: "output-schema",
    family: "output-schema",
    label: "Output schema",
    deterministic: true,
    triggered: missing.length > 0,
    detail: missing.length ? `missing required field(s): ${missing.join(", ")}` : "schema satisfied",
    matches: missing,
  };
}

/* ------------------- advisory detectors (never bind the gate) ------------------- */

const TOXIC_WORDS = ["idiot", "stupid", "hate", "kill", "worthless", "moron", "trash"];

function detectToxicity(text: string): DetectorResult {
  const lc = text.toLowerCase();
  const hits = TOXIC_WORDS.filter((w) => lc.includes(w));
  const score = Math.min(1, hits.length / 3);
  return {
    id: "toxicity",
    family: "toxicity",
    label: "Toxicity (advisory)",
    deterministic: false,
    triggered: score >= 0.34,
    score: Number(score.toFixed(2)),
    detail: `advisory toxicity score ${score.toFixed(2)} — not a gate input`,
    matches: hits,
  };
}

function detectOffTopic(text: string, topicKeywords?: readonly string[]): DetectorResult | null {
  if (!topicKeywords || topicKeywords.length === 0) return null;
  const lc = text.toLowerCase();
  const present = topicKeywords.filter((k) => lc.includes(k.toLowerCase()));
  const score = present.length === 0 ? 1 : Math.max(0, 1 - present.length / topicKeywords.length);
  return {
    id: "off-topic",
    family: "off-topic",
    label: "Off-topic (advisory)",
    deterministic: false,
    triggered: score >= 0.75,
    score: Number(score.toFixed(2)),
    detail: `advisory off-topic score ${score.toFixed(2)} — not a gate input`,
  };
}

/**
 * Run all guardrail detectors over a piece of content. The `blocked` decision is
 * derived ONLY from deterministic detectors — advisory scores never bind.
 */
export function runGuardrails(text: string, opts: GuardrailOptions = {}): GuardrailReport {
  const results: DetectorResult[] = [
    detectPii(text),
    detectSecrets(text),
    detectJailbreak(text),
    detectToxicity(text),
  ];
  const schema = detectOutputSchema(text, opts.requiredFields);
  if (schema) results.push(schema);
  const offTopic = detectOffTopic(text, opts.topicKeywords);
  if (offTopic) results.push(offTopic);

  const blockedBy = results.filter((r) => r.deterministic && r.triggered).map((r) => r.id);
  const advisories = results.filter((r) => !r.deterministic && r.triggered);
  return { results, blocked: blockedBy.length > 0, blockedBy, advisories };
}
