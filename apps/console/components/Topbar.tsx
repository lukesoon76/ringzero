export function Topbar() {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-edge bg-ink/80 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-2 text-[13px]">
        <span className="text-muted">Workspace</span>
        <span className="text-muted">/</span>
        <span className="text-fg">Regulated financial services</span>
      </div>
      <div className="flex items-center gap-3 text-[11px]">
        <span className="rounded-md border border-edge px-2 py-1 text-muted">environment: local</span>
        <span className="rounded-md bg-ok/15 px-2 py-1 text-ok">kernel: online</span>
      </div>
    </header>
  );
}
