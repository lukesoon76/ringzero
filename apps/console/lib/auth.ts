/**
 * Session layer — a signed (HMAC-SHA256) session token in an httpOnly cookie.
 * The token carries only { uid, exp }; the user's role and permissions are
 * loaded fresh from the auth db on each request, so an admin's permission change
 * takes effect immediately (no stale claims baked into the cookie). Node runtime.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getRolePermissions, getSessionSecret, getUserById, type UserRow } from "./auth-db.js";
import { ROLES, type Permission } from "./rbac.js";

export const SESSION_COOKIE = "regent_session";
const MAX_AGE_S = 60 * 60 * 12; // 12h

interface Payload {
  uid: number;
  exp: number;
}
const b64 = (s: string) => Buffer.from(s).toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString();

export function signSession(uid: number): string {
  const payload: Payload = { uid, exp: Math.floor(Date.now() / 1000) + MAX_AGE_S };
  const body = b64(JSON.stringify(payload));
  const sig = createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyToken(token: string): Payload | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", getSessionSecret()).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(unb64(body)) as Payload;
    if (typeof payload.uid !== "number" || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export interface Session {
  user: UserRow;
  roleName: string;
  permissions: Permission[];
}

/** Resolve the current session from the cookie, or null. Loads role/perms fresh. */
export function getSession(): Session | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = getUserById(payload.uid);
  if (!user || !user.active) return null;
  return {
    user,
    roleName: ROLES.find((r) => r.id === user.role)?.name ?? user.role,
    permissions: getRolePermissions(user.role),
  };
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: MAX_AGE_S,
};
