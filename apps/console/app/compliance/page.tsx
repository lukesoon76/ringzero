import { FRAMEWORK_LIBRARY } from "@ring-zero/policy";
import { ComplianceModule } from "./ComplianceModule";
import type { Pack } from "../../lib/frameworks-store";

export const dynamic = "force-static";

export default function CompliancePage() {
  const builtins: Pack[] = FRAMEWORK_LIBRARY.map((f) => ({
    id: f.id,
    name: f.name,
    shortName: f.shortName,
    jurisdiction: f.jurisdiction,
    authority: f.authority,
    status: f.status,
    effective: f.effective,
    summary: f.summary,
    tags: [...f.tags],
    requirements: f.requirements.map((r) => ({ id: r.id, title: r.title, text: r.text, severity: r.severity })),
  }));
  return <ComplianceModule builtins={builtins} />;
}
