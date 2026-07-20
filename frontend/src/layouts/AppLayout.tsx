import { Link, Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line/80 bg-paper-elevated/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-baseline justify-between gap-4 px-6 py-5">
          <div>
            <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">AxioNet</p>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Load Balancer</h1>
          </div>
          <nav className="flex gap-4 text-sm">
            <Link className="text-ink-muted hover:text-ink" to="/">
              Dashboard
            </Link>
            <Link className="text-ink-muted hover:text-ink" to="/interfaces">
              Interfaces
            </Link>
            <Link className="text-ink-muted hover:text-ink" to="/networks">
              Networks
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
