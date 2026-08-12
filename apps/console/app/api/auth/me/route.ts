import { getSession } from "../../../../lib/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  const s = getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({
    ok: true,
    user: { username: s.user.username, name: s.user.name, role: s.user.role, roleName: s.roleName },
    permissions: s.permissions,
  });
}
