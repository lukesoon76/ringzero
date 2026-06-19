import Link from "next/link";

const links = [
  ["/", "Overview"],
  ["/trace", "Trace Viewer"],
  ["/registry", "Registry"],
  ["/attestation", "Attestation"],
  ["/monitoring", "Monitoring"],
] as const;

export function Nav() {
  return (
    <nav className="border-b border-edge bg-panel/60">
      <div className="mx-auto flex max-w-[1200px] items-center gap-6 px-6 py-3">
        <span className="font-bold tracking-wide text-fg">RING ZERO</span>
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="text-muted hover:text-fg">
            {label}
          </Link>
        ))}
        <span className="ml-auto text-xs text-muted">deterministic · fail-closed · replayable</span>
      </div>
    </nav>
  );
}
