import { FRAMEWORK_LIBRARY } from "@ring-zero/policy";
import { PoliciesModule, type FrameworkLite } from "./PoliciesModule";

// Dynamic (not force-static): the auth layout runs per-request; a build-time
// static render would bake a /login redirect and loop for logged-in users.
export const dynamic = "force-dynamic";

export default function PoliciesPage() {
  const frameworks: FrameworkLite[] = FRAMEWORK_LIBRARY.map((f) => ({ id: f.id, shortName: f.shortName, name: f.name }));
  return <PoliciesModule frameworks={frameworks} />;
}
