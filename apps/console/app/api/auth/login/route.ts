import { getUserByUsername, verifyPassword } from "../../../../lib/auth-db";
import { cookieOptions, SESSION_COOKIE, signSession } from "../../../../lib/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  let body: { username?: string; password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid request" }, { status: 400 });
  }
  const username = (body.username ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const user = getUserByUsername(username);
  // constant-ish response: same generic error whether user missing or bad password
  if (!user || !user.active || !verifyPassword(password, user.salt, user.hash)) {
    return NextResponse.json({ ok: false, error: "invalid username or password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, user: { username: user.username, name: user.name, role: user.role } });
  res.cookies.set(SESSION_COOKIE, signSession(user.id), cookieOptions);
  return res;
}
