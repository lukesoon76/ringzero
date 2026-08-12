/**
 * Role-based access control model — pure data, safe to import anywhere (server,
 * client, Edge middleware). Roles bundle capabilities; the sidebar, route guard,
 * and action buttons all gate on the SAME permission set. Admins can override a
 * role's grants at runtime (persisted in the auth db); these are the defaults.
 */

export type Permission = string;
export type RoleId = "admin" | "gov-lead" | "model-risk" | "approver" | "engineer" | "auditor" | "exec";

/** Every view (nav/route) capability. */
export const ALL_VIEWS = [
  "view:dashboard", "view:coverage", "view:inventory", "view:discovery", "view:autonomy",
  "view:frameworks", "view:compliance", "view:attestation", "view:trace", "view:assurance",
  "view:orchestrator", "view:import", "view:guardrails", "view:oversight", "view:finance",
  "view:budget", "view:policies", "view:trust", "view:monitoring",
] as const;

/** Sensitive action capabilities (finer than a view). */
export const ACTIONS = ["attest:export", "oversight:approve", "admin"] as const;

export const ALL_PERMISSIONS: readonly Permission[] = [...ALL_VIEWS, ...ACTIONS];

export interface RoleDef {
  readonly id: RoleId;
  readonly name: string;
  readonly persona: string;
  readonly description: string;
}

export const ROLES: readonly RoleDef[] = [
  { id: "admin", name: "Platform Admin", persona: "Runs Regent for the org", description: "Everything, plus user management and permission configuration." },
  { id: "gov-lead", name: "Governance Lead", persona: "Head of AI Governance / CISO", description: "All read, authors policies/frameworks, sets tiers, exports attestation. No user admin." },
  { id: "model-risk", name: "Model Risk / Validator", persona: "MRM · SR 11-7 / MAS AIMRM", description: "Inventory, autonomy, compliance, attestation (read + export), trace. Cannot change enforcement config." },
  { id: "approver", name: "Approver / Oversight", persona: "Authorized human-in-the-loop (P8)", description: "Oversight inbox (approve/reject), trace, dashboard. Deliberately narrow." },
  { id: "engineer", name: "Agent Engineer", persona: "Builds & governs the agents", description: "Orchestrator, import, guardrails, budget, discovery, assurance, trace. No attestation export or user admin." },
  { id: "auditor", name: "Auditor / Regulator", persona: "External examiner", description: "Attestation, coverage, compliance, frameworks, trace — read-only + export the auditor artifacts." },
  { id: "exec", name: "Executive / Viewer", persona: "Board / exec", description: "Dashboard, coverage, trust cards, monitoring — read-only summary." },
];

const OVERVIEW: Permission[] = ["view:dashboard", "view:coverage", "view:trust", "view:monitoring"];

/** Default capability bundle per role (admin-overridable at runtime). */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleId, Permission[]> = {
  admin: [...ALL_VIEWS, ...ACTIONS],
  "gov-lead": [...ALL_VIEWS, "attest:export"],
  "model-risk": [...OVERVIEW, "view:inventory", "view:discovery", "view:autonomy", "view:compliance", "view:frameworks", "view:attestation", "view:trace", "view:assurance", "attest:export"],
  approver: ["view:dashboard", "view:trace", "view:oversight", "oversight:approve"],
  engineer: ["view:dashboard", "view:coverage", "view:inventory", "view:discovery", "view:autonomy", "view:orchestrator", "view:import", "view:guardrails", "view:budget", "view:finance", "view:policies", "view:assurance", "view:trace"],
  auditor: [...OVERVIEW, "view:inventory", "view:autonomy", "view:compliance", "view:frameworks", "view:attestation", "view:trace", "view:assurance", "attest:export"],
  exec: [...OVERVIEW],
};

/** Route → the view permission it requires. */
const ROUTE_PERMISSION: Record<string, Permission> = {
  "/coverage": "view:coverage", "/inventory": "view:inventory", "/discovery": "view:discovery",
  "/autonomy": "view:autonomy", "/frameworks": "view:frameworks", "/compliance": "view:compliance",
  "/attestation": "view:attestation", "/trace": "view:trace", "/assurance": "view:assurance",
  "/orchestrator": "view:orchestrator", "/workbench": "view:import", "/guardrails": "view:guardrails",
  "/oversight": "view:oversight", "/finance": "view:finance", "/budget": "view:budget",
  "/policies": "view:policies", "/trust": "view:trust", "/monitoring": "view:monitoring",
  "/registry": "view:inventory", "/admin": "admin",
};

/** The permission required to view a path (longest-prefix), or null if unguarded. */
export function requiredPermissionForPath(pathname: string): Permission | null {
  if (pathname === "/") return "view:dashboard";
  const key = Object.keys(ROUTE_PERMISSION)
    .filter((p) => pathname === p || pathname.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0];
  return key ? ROUTE_PERMISSION[key]! : null;
}
