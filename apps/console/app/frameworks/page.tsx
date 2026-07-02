import { FRAMEWORK_LIBRARY } from "@ring-zero/policy";
import { FrameworksBrowser, type FrameworkPack } from "./FrameworksBrowser";

export const dynamic = "force-static";

export default function FrameworksPage() {
  // FRAMEWORK_LIBRARY is plain reference data — safe to hand to the client browser.
  return <FrameworksBrowser packs={FRAMEWORK_LIBRARY as unknown as FrameworkPack[]} />;
}
