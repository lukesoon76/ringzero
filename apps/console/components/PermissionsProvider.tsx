"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface CurrentUser {
  username: string;
  name: string;
  role: string;
  roleName: string;
}
interface Ctx {
  user: CurrentUser;
  permissions: string[];
  has: (permission: string) => boolean;
}

const PermissionsContext = createContext<Ctx | null>(null);

export function PermissionsProvider({ user, permissions, children }: { user: CurrentUser; permissions: string[]; children: ReactNode }) {
  const has = (p: string) => permissions.includes(p);
  return <PermissionsContext.Provider value={{ user, permissions, has }}>{children}</PermissionsContext.Provider>;
}

/** Client-side permission access. Returns null outside the authenticated shell (e.g. /login). */
export function usePermissions(): Ctx | null {
  return useContext(PermissionsContext);
}
