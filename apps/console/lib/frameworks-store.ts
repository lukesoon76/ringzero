/**
 * Client-side store for user-configurable frameworks: uploaded packs and
 * taxonomy edits (overrides) layered on top of the built-in library. Both the
 * Frameworks page and the Compliance page read the SAME effective set, so an
 * edit to a framework's taxonomy immediately changes the compliance posture.
 */

export type Severity = "critical" | "high" | "medium";
export interface Requirement {
  id: string;
  title: string;
  text: string;
  severity: Severity;
}
export interface Pack {
  id: string;
  name: string;
  shortName: string;
  jurisdiction?: string;
  authority?: string;
  status?: string;
  effective?: string;
  summary?: string;
  tags?: string[];
  requirements: Requirement[];
  custom?: boolean;
}

const USER_KEY = "regent-user-frameworks";
const OVR_KEY = "regent-framework-overrides";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function getUserPacks(): Pack[] {
  return read<Pack[]>(USER_KEY, []);
}
export function saveUserPacks(packs: Pack[]) {
  write(USER_KEY, packs);
}
export function getOverrides(): Record<string, Requirement[]> {
  return read<Record<string, Requirement[]>>(OVR_KEY, {});
}
export function saveOverride(id: string, requirements: Requirement[]) {
  write(OVR_KEY, { ...getOverrides(), [id]: requirements });
}
export function clearOverride(id: string) {
  const o = getOverrides();
  delete o[id];
  write(OVR_KEY, o);
}

/** Built-ins with taxonomy overrides applied, plus uploaded packs. */
export function getEffective(builtins: Pack[]): Pack[] {
  const ovr = getOverrides();
  const merged = builtins.map((b) => (ovr[b.id] ? { ...b, requirements: ovr[b.id]! } : b));
  return [...merged, ...getUserPacks()];
}

/** Validate a pasted framework pack (upload). Returns the pack or an error string. */
export function parsePack(json: string): Pack | string {
  let o: unknown;
  try {
    o = JSON.parse(json);
  } catch {
    return "not valid JSON";
  }
  const p = o as Partial<Pack>;
  if (!p || typeof p.id !== "string" || typeof p.name !== "string") return "missing id or name";
  if (!Array.isArray(p.requirements) || p.requirements.length === 0) return "missing requirements[]";
  for (const r of p.requirements) {
    if (typeof r.id !== "string" || typeof r.title !== "string") return "each requirement needs id + title";
    if (!["critical", "high", "medium"].includes(r.severity)) return `requirement "${r.id}" needs severity critical|high|medium`;
  }
  return {
    id: p.id,
    name: p.name,
    shortName: p.shortName ?? p.name,
    jurisdiction: p.jurisdiction,
    authority: p.authority,
    status: p.status ?? "Custom",
    effective: p.effective,
    summary: p.summary ?? "",
    tags: p.tags ?? ["custom"],
    requirements: p.requirements.map((r) => ({ id: r.id, title: r.title, text: r.text ?? "", severity: r.severity })),
    custom: true,
  };
}
