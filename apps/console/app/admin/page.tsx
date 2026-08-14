"use client";

import { Fragment, useCallback, useEffect, useState } from "react";

interface User { id: number; username: string; name: string; email: string; role: string; active: number; created_at: string }
interface RoleDef { id: string; name: string; persona: string; description: string }
interface RolesData { roles: RoleDef[]; permissions: string[]; grants: Record<string, string[]> }

const chip = "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold";

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [rolesData, setRolesData] = useState<RolesData | null>(null);
  const [tab, setTab] = useState<"users" | "roles">("users");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [u, r] = await Promise.all([fetch("/api/admin/users"), fetch("/api/admin/roles")]);
    if (u.ok) setUsers(((await u.json()) as { users: User[] }).users);
    if (r.ok) setRolesData((await r.json()) as RolesData);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 2500); };

  async function saveUser(action: string, payload: Record<string, unknown>) {
    const res = await fetch("/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
    const json = (await res.json()) as { ok: boolean; error?: string };
    flash(json.ok ? "Saved." : `Error: ${json.error}`);
    if (json.ok) void load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">Admin — Users &amp; Permissions</h1>
        <p className="max-w-3xl text-[13px] text-muted">Create users, assign roles, and configure exactly which features each role can see. Changes take effect on the user&rsquo;s next request — permissions are loaded fresh, never baked into the session.</p>
      </div>

      <div className="flex gap-2">
        {(["users", "roles"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold ${tab === t ? "bg-brand text-ink" : "border border-edge text-muted hover:text-fg"}`}>
            {t === "users" ? "Users" : "Role permissions"}
          </button>
        ))}
        {msg ? <span className="self-center text-[12px] text-ok">{msg}</span> : null}
      </div>

      {tab === "users" ? (
        <UsersTab users={users} roles={rolesData?.roles ?? []} onSave={saveUser} />
      ) : rolesData ? (
        <RolesTab data={rolesData} onSaved={(m) => { flash(m); void load(); }} />
      ) : null}
    </div>
  );
}

function UsersTab({ users, roles, onSave }: { users: User[]; roles: RoleDef[]; onSave: (a: string, p: Record<string, unknown>) => void }) {
  const [form, setForm] = useState({ username: "", name: "", email: "", role: "auditor", password: "" });
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState({ name: "", email: "", password: "" });
  const startEdit = (u: User) => { setEditId(u.id); setEdit({ name: u.name, email: u.email, password: "" }); };
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-edge">
        <table className="w-full min-w-[720px] text-[12px]">
          <thead className="bg-panel2 text-[10px] uppercase tracking-wide text-muted">
            <tr><th className="px-3 py-2 text-left">User</th><th className="px-3 py-2 text-left">Role</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <Fragment key={u.id}>
                <tr className="border-t border-edge">
                  <td className="px-3 py-2"><div className="text-fg">{u.name}</div><div className="font-mono text-[10px] text-muted">{u.username} · {u.email}</div></td>
                  <td className="px-3 py-2">
                    <select value={u.role} onChange={(e) => onSave("update", { id: u.id, role: e.target.value })} className="rounded border border-edge bg-ink px-2 py-1 text-[11px] text-fg">
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2"><span className={`${chip} ${u.active ? "bg-ok/15 text-ok" : "bg-bad/15 text-bad"}`}>{u.active ? "active" : "disabled"}</span></td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => (editId === u.id ? setEditId(null) : startEdit(u))} className="mr-1 rounded border border-edge px-2 py-1 text-[10px] text-muted hover:text-fg">{editId === u.id ? "Close" : "Edit profile"}</button>
                    <button onClick={() => onSave("update", { id: u.id, active: !u.active })} className="rounded border border-edge px-2 py-1 text-[10px] text-muted hover:text-fg">{u.active ? "Disable" : "Enable"}</button>
                  </td>
                </tr>
                {editId === u.id ? (
                  <tr className="border-t border-edge bg-ink/40">
                    <td colSpan={4} className="px-3 py-2">
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="text-[10px] text-muted">Name<input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="mt-0.5 block w-44 rounded border border-edge bg-ink px-2 py-1 text-[12px] text-fg" /></label>
                        <label className="text-[10px] text-muted">Email<input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} className="mt-0.5 block w-52 rounded border border-edge bg-ink px-2 py-1 text-[12px] text-fg" /></label>
                        <label className="text-[10px] text-muted">Reset password<input type="password" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} placeholder="leave blank to keep" className="mt-0.5 block w-44 rounded border border-edge bg-ink px-2 py-1 text-[12px] text-fg" /></label>
                        <button onClick={() => { onSave("update", { id: u.id, name: edit.name, email: edit.email, ...(edit.password ? { password: edit.password } : {}) }); setEditId(null); }} className="rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-ink">Save profile</button>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-edge bg-panel p-4">
        <div className="mb-2 text-[12px] font-semibold text-fg">Create user</div>
        <div className="flex flex-wrap items-end gap-2">
          <input placeholder="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-32 rounded border border-edge bg-ink px-2 py-1.5 text-[12px] text-fg" />
          <input placeholder="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-40 rounded border border-edge bg-ink px-2 py-1.5 text-[12px] text-fg" />
          <input placeholder="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-44 rounded border border-edge bg-ink px-2 py-1.5 text-[12px] text-fg" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded border border-edge bg-ink px-2 py-1.5 text-[12px] text-fg">
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <input placeholder="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-32 rounded border border-edge bg-ink px-2 py-1.5 text-[12px] text-fg" />
          <button onClick={() => { onSave("create", form); setForm({ username: "", name: "", email: "", role: "auditor", password: "" }); }} disabled={!form.username || !form.name || !form.password} className="rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-ink disabled:opacity-50">Create</button>
        </div>
      </div>
    </div>
  );
}

function RolesTab({ data, onSaved }: { data: RolesData; onSaved: (m: string) => void }) {
  const [grants, setGrants] = useState<Record<string, Set<string>>>(() => Object.fromEntries(data.roles.map((r) => [r.id, new Set(data.grants[r.id] ?? [])])));
  const toggle = (role: string, perm: string) => setGrants((g) => { const s = new Set(g[role]); s.has(perm) ? s.delete(perm) : s.add(perm); return { ...g, [role]: s }; });
  async function save(role: string) {
    const res = await fetch("/api/admin/roles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role, permissions: [...grants[role]!] }) });
    onSaved((await res.json() as { ok: boolean }).ok ? `Saved ${role} permissions.` : "Error saving.");
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-edge">
      <table className="w-full text-[11px]">
        <thead className="bg-panel2 text-[10px] uppercase tracking-wide text-muted">
          <tr>
            <th className="sticky left-0 bg-panel2 px-3 py-2 text-left">Permission</th>
            {data.roles.map((r) => <th key={r.id} className="px-2 py-2 text-center" title={r.description}>{r.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.permissions.map((perm) => (
            <tr key={perm} className="border-t border-edge">
              <td className="sticky left-0 bg-panel px-3 py-1.5 font-mono text-fg">{perm}</td>
              {data.roles.map((r) => (
                <td key={r.id} className="px-2 py-1.5 text-center">
                  <input type="checkbox" checked={grants[r.id]!.has(perm)} onChange={() => toggle(r.id, perm)} className="h-3.5 w-3.5 accent-white" />
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-edge bg-panel2/40">
            <td className="sticky left-0 bg-panel2/40 px-3 py-2 text-muted">Save</td>
            {data.roles.map((r) => (
              <td key={r.id} className="px-2 py-2 text-center">
                <button onClick={() => void save(r.id)} className="rounded bg-brand px-2 py-1 text-[10px] font-semibold text-ink">Save</button>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
