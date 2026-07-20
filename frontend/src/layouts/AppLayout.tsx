import { Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line/80 bg-paper-elevated/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-baseline justify-between gap-4 px-6 py-5">
          <div>
            <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">AxioNet</p>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Load Balancer</h1>
          </div>
          <p className="hidden text-sm text-ink-muted sm:block">Kontrollplan · Milestone 1</p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
