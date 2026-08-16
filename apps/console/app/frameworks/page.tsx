import { FRAMEWORK_LIBRARY } from "@ring-zero/policy";
import { FrameworksBrowser, type FrameworkPack } from "./FrameworksBrowser";

// Must be dynamic: the auth layout authenticates per-request. force-static would
// prerender this page at build time (no session) and bake a /login redirect into
// it, causing a redirect loop for logged-in users.
export const dynamic = "force-dynamic";

export default function FrameworksPage() {
  // FRAMEWORK_LIBRARY is plain reference data — safe to hand to the client browser.
  return <FrameworksBrowser packs={FRAMEWORK_LIBRARY as unknown as FrameworkPack[]} />;
}
