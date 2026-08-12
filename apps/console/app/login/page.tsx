"use client";

import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setError(json.error ?? "login failed");
        return;
      }
      const from = new URLSearchParams(window.location.search).get("from") || "/";
      window.location.href = from.startsWith("/login") ? "/" : from;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-[13px] font-bold text-ink">Rg</span>
          <span className="text-lg font-bold tracking-wide text-fg">REGENT</span>
        </div>
        <div className="rounded-2xl border border-edge bg-panel p-6">
          <h1 className="text-[15px] font-semibold text-fg">Sign in</h1>
          <p className="mt-0.5 text-[12px] text-muted">Governance Studio — access is role-scoped.</p>
          <form onSubmit={submit} className="mt-4 space-y-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-muted">Username</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" className="mt-1 w-full rounded-lg border border-edge bg-ink px-3 py-2 text-[13px] text-fg outline-none focus:border-fg/40" />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-muted">Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="mt-1 w-full rounded-lg border border-edge bg-ink px-3 py-2 text-[13px] text-fg outline-none focus:border-fg/40" />
            </label>
            {error ? <p className="text-[12px] text-bad">{error}</p> : null}
            <button type="submit" disabled={busy || !username || !password} className="w-full rounded-lg bg-brand px-3 py-2 text-[13px] font-semibold text-ink disabled:opacity-50">
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
        <p className="mt-3 text-center text-[11px] text-muted">Demo users: <span className="font-mono text-fg">admin</span>, <span className="font-mono text-fg">auditor</span>, <span className="font-mono text-fg">approver</span>… · password <span className="font-mono text-fg">regent-demo</span></p>
      </div>
    </div>
  );
}
