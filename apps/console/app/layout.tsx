import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PermissionsProvider } from "../components/PermissionsProvider";
import { Sidebar } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";
import { getSession } from "../lib/auth";
import { requiredPermissionForPath } from "../lib/rbac";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Regent — Governance Studio",
  description: "Deterministic execution-governance kernel for AI agents",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const pathname = headers().get("x-pathname") ?? "/";
  const shell = pathname !== "/login";

  let session = null;
  let allowed = true;
  let requiredPerm: string | null = null;
  if (shell) {
    session = getSession();
    if (!session) redirect(`/login?from=${encodeURIComponent(pathname)}`);
    requiredPerm = requiredPermissionForPath(pathname);
    allowed = !requiredPerm || session.permissions.includes(requiredPerm);
  }

  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>
        {shell && session ? (
          <PermissionsProvider
            user={{ username: session.user.username, name: session.user.name, role: session.user.role, roleName: session.roleName }}
            permissions={session.permissions}
          >
            <div className="flex min-h-screen">
              <Sidebar />
              <div className="flex min-w-0 flex-1 flex-col">
                <Topbar />
                <main className="min-w-0 flex-1 px-6 py-6">
                  {allowed ? children : <NoAccess perm={requiredPerm} role={session.roleName} />}
                </main>
              </div>
            </div>
          </PermissionsProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}

function NoAccess({ perm, role }: { perm: string | null; role: string }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-edge bg-panel p-6 text-center">
      <div className="text-[13px] font-semibold text-fg">Access restricted</div>
      <p className="mt-1 text-[12px] text-muted">
        Your role (<span className="text-fg">{role}</span>) doesn&rsquo;t include <span className="font-mono text-fg">{perm}</span>. Ask a Platform Admin to grant it, or pick a surface from the sidebar.
      </p>
    </div>
  );
}
