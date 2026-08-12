import { createUser, listUsers, updateUser } from "../../../../lib/auth-db";
import { getSession } from "../../../../lib/auth";
import { ROLES, type RoleId } from "../../../../lib/rbac";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLE_IDS = new Set(ROLES.map((r) => r.id));
const requireAdmin = () => {
  const s = getSession();
  return s && s.permissions.includes("admin") ? s : null;
};

export function GET(): NextResponse {
  if (!requireAdmin()) return NextResponse.json({ ok: false }, { status: 403 });
  return NextResponse.json({ ok: true, users: listUsers() });
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!requireAdmin()) return NextResponse.json({ ok: false }, { status: 403 });
  let b: { action?: string; id?: number; username?: string; name?: string; email?: string; role?: string; active?: boolean; password?: string };
  try {
    b = (await req.json()) as typeof b;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid request" }, { status: 400 });
  }
  if (b.role && !ROLE_IDS.has(b.role as RoleId)) return NextResponse.json({ ok: false, error: "unknown role" }, { status: 400 });

  if (b.action === "create") {
    if (!b.username || !b.name || !b.role || !b.password) return NextResponse.json({ ok: false, error: "missing fields" }, { status: 400 });
    try {
      const user = createUser({ username: b.username.trim().toLowerCase(), name: b.name, email: b.email ?? "", role: b.role as RoleId, password: b.password });
      return NextResponse.json({ ok: true, user });
    } catch {
      return NextResponse.json({ ok: false, error: "username already exists" }, { status: 409 });
    }
  }
  if (b.action === "update" && typeof b.id === "number") {
    const user = updateUser(b.id, { name: b.name, email: b.email, role: b.role as RoleId | undefined, active: b.active, password: b.password });
    if (!user) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, user });
  }
  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}
