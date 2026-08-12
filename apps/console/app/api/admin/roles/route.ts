import { getAllRolePermissions, setRolePermissions } from "../../../../lib/auth-db";
import { getSession } from "../../../../lib/auth";
import { ALL_PERMISSIONS, ROLES, type RoleId } from "../../../../lib/rbac";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLE_IDS = new Set(ROLES.map((r) => r.id));
const PERMS = new Set(ALL_PERMISSIONS);
const requireAdmin = () => {
  const s = getSession();
  return s && s.permissions.includes("admin") ? s : null;
};

export function GET(): NextResponse {
  if (!requireAdmin()) return NextResponse.json({ ok: false }, { status: 403 });
  return NextResponse.json({ ok: true, roles: ROLES, permissions: ALL_PERMISSIONS, grants: getAllRolePermissions() });
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!requireAdmin()) return NextResponse.json({ ok: false }, { status: 403 });
  let b: { role?: string; permissions?: string[] };
  try {
    b = (await req.json()) as typeof b;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid request" }, { status: 400 });
  }
  if (!b.role || !ROLE_IDS.has(b.role as RoleId) || !Array.isArray(b.permissions)) {
    return NextResponse.json({ ok: false, error: "role + permissions[] required" }, { status: 400 });
  }
  // guard: the admin role must always retain the `admin` permission (no lockout)
  const perms = b.permissions.filter((p) => PERMS.has(p));
  if (b.role === "admin" && !perms.includes("admin")) perms.push("admin");
  setRolePermissions(b.role, perms);
  return NextResponse.json({ ok: true, role: b.role, permissions: perms });
}
