/**
 * Auth persistence — a SQLite store (separate from the read-only telemetry db)
 * for users, per-role permission grants, and a per-instance session secret.
 * Seeds 7 demo users (one per role) and the default role→permission grants on
 * first run. Node runtime only.
 *
 * NOTE ON PERSISTENCE: this file lives under .telemetry/, which survives within a
 * running instance but NOT across a Render redeploy unless a persistent Disk is
 * mounted. Swap `AUTH_DB_PATH` (env REGENT_AUTH_DB) to a mounted path for that.
 */

import Database from "better-sqlite3";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DEFAULT_ROLE_PERMISSIONS, ROLES, type Permission, type RoleId } from "./rbac.js";

const AUTH_DB_PATH = process.env.REGENT_AUTH_DB ?? resolve(process.cwd(), "..", "..", ".telemetry", "auth.db");

export interface UserRow {
  id: number;
  username: string;
  name: string;
  email: string;
  role: RoleId;
  active: number;
  created_at: string;
}
interface UserAuthRow extends UserRow {
  salt: string;
  hash: string;
}

/* ---- password hashing (scrypt, per-user salt) ---- */
export function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const s = salt ?? randomBytes(16).toString("hex");
  const hash = scryptSync(password, s, 64).toString("hex");
  return { salt: s, hash };
}
export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

let _db: Database.Database | null = null;

function db(): Database.Database {
  if (_db) return _db;
  mkdirSync(dirname(AUTH_DB_PATH), { recursive: true });
  const d = new Database(AUTH_DB_PATH);
  d.pragma("journal_mode = WAL");
  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL,
      role TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS role_permissions (role TEXT NOT NULL, permission TEXT NOT NULL, PRIMARY KEY (role, permission));
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  _db = d;
  seed(d);
  return d;
}

function seed(d: Database.Database): void {
  // session secret (per-instance; no secret in source)
  const hasSecret = d.prepare("SELECT value FROM meta WHERE key = 'session_secret'").get();
  if (!hasSecret) d.prepare("INSERT INTO meta (key, value) VALUES ('session_secret', ?)").run(randomBytes(32).toString("hex"));

  // default role → permission grants
  const rpCount = (d.prepare("SELECT COUNT(*) AS n FROM role_permissions").get() as { n: number }).n;
  if (rpCount === 0) {
    const ins = d.prepare("INSERT OR IGNORE INTO role_permissions (role, permission) VALUES (?, ?)");
    const tx = d.transaction(() => {
      for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) for (const p of perms) ins.run(role, p);
    });
    tx();
  }

  // demo users, one per role (password documented to the operator; change in prod)
  const userCount = (d.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
  if (userCount === 0) {
    const usernames: Record<RoleId, string> = {
      admin: "admin", "gov-lead": "gov.lead", "model-risk": "model.risk", approver: "approver",
      engineer: "engineer", auditor: "auditor", exec: "exec",
    };
    const now = new Date().toISOString();
    const ins = d.prepare("INSERT INTO users (username, name, email, role, salt, hash, active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)");
    const tx = d.transaction(() => {
      for (const r of ROLES) {
        const { salt, hash } = hashPassword("regent-demo");
        ins.run(usernames[r.id], r.name, `${usernames[r.id]}@regent.local`, r.id, salt, hash, now);
      }
    });
    tx();
  }
}

export function getSessionSecret(): string {
  return (db().prepare("SELECT value FROM meta WHERE key = 'session_secret'").get() as { value: string }).value;
}

export function getUserByUsername(username: string): UserAuthRow | undefined {
  return db().prepare("SELECT * FROM users WHERE username = ?").get(username) as UserAuthRow | undefined;
}
export function getUserById(id: number): UserRow | undefined {
  return db().prepare("SELECT id, username, name, email, role, active, created_at FROM users WHERE id = ?").get(id) as UserRow | undefined;
}
export function listUsers(): UserRow[] {
  return db().prepare("SELECT id, username, name, email, role, active, created_at FROM users ORDER BY id").all() as UserRow[];
}
export function createUser(u: { username: string; name: string; email: string; role: RoleId; password: string }): UserRow {
  const { salt, hash } = hashPassword(u.password);
  const info = db()
    .prepare("INSERT INTO users (username, name, email, role, salt, hash, active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)")
    .run(u.username, u.name, u.email, u.role, salt, hash, new Date().toISOString());
  return getUserById(Number(info.lastInsertRowid))!;
}
export function updateUser(id: number, patch: { name?: string; email?: string; role?: RoleId; active?: boolean; password?: string }): UserRow | undefined {
  const cur = getUserById(id);
  if (!cur) return undefined;
  const name = patch.name ?? cur.name;
  const email = patch.email ?? cur.email;
  const role = patch.role ?? cur.role;
  const active = patch.active === undefined ? cur.active : patch.active ? 1 : 0;
  if (patch.password) {
    const { salt, hash } = hashPassword(patch.password);
    db().prepare("UPDATE users SET name=?, email=?, role=?, active=?, salt=?, hash=? WHERE id=?").run(name, email, role, active, salt, hash, id);
  } else {
    db().prepare("UPDATE users SET name=?, email=?, role=?, active=? WHERE id=?").run(name, email, role, active, id);
  }
  return getUserById(id);
}

export function getRolePermissions(role: string): Permission[] {
  return (db().prepare("SELECT permission FROM role_permissions WHERE role = ?").all(role) as { permission: string }[]).map((r) => r.permission);
}
export function getAllRolePermissions(): Record<string, Permission[]> {
  const out: Record<string, Permission[]> = {};
  for (const r of ROLES) out[r.id] = getRolePermissions(r.id);
  return out;
}
export function setRolePermissions(role: string, permissions: Permission[]): void {
  const d = db();
  const del = d.prepare("DELETE FROM role_permissions WHERE role = ?");
  const ins = d.prepare("INSERT OR IGNORE INTO role_permissions (role, permission) VALUES (?, ?)");
  d.transaction(() => {
    del.run(role);
    for (const p of permissions) ins.run(role, p);
  })();
}
