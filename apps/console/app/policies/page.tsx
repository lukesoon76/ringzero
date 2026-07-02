import { FRAMEWORK_LIBRARY } from "@ring-zero/policy";
import { PoliciesModule, type FrameworkLite } from "./PoliciesModule";

export const dynamic = "force-static";

export default function PoliciesPage() {
  const frameworks: FrameworkLite[] = FRAMEWORK_LIBRARY.map((f) => ({ id: f.id, shortName: f.shortName, name: f.name }));
  return <PoliciesModule frameworks={frameworks} />;
}
