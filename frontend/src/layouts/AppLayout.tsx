import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../features/auth/AuthProvider";
import { useTheme } from "../features/theme/ThemeProvider";
import { setAppLocale, type AppLocale } from "../i18n";

type NavItem = { to: string; labelKey: string; end?: boolean };

type NavGroup = {
  id: string;
  labelKey?: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "dashboard",
    items: [{ to: "/", labelKey: "nav.dashboard", end: true }],
  },
  {
    id: "traffic",
    labelKey: "nav.groups.traffic",
    items: [
      { to: "/catalog", labelKey: "nav.catalog" },
      { to: "/instances", labelKey: "nav.instances" },
      { to: "/vips", labelKey: "nav.vips" },
    ],
  },
  {
    id: "network",
    labelKey: "nav.groups.network",
    items: [
      { to: "/interfaces", labelKey: "nav.interfaces" },
      { to: "/networks", labelKey: "nav.networks" },
    ],
  },
  {
    id: "observe",
    labelKey: "nav.groups.observe",
    items: [{ to: "/logs", labelKey: "nav.logs" }],
  },
  {
    id: "system",
    labelKey: "nav.groups.system",
    items: [{ to: "/settings", labelKey: "nav.settings" }],
  },
];

function sideNavClass({ isActive }: { isActive: boolean }): string {
  return [
    "block rounded-md px-3 py-2 text-sm transition-colors",
    isActive
      ? "border-l-2 border-accent bg-accent-soft/60 font-medium text-ink"
      : "border-l-2 border-transparent text-ink-muted hover:bg-paper-elevated hover:text-ink",
  ].join(" ");
}

export function AppLayout() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locale = (i18n.language === "en" ? "en" : "nb") as AppLocale;
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-line/80 px-4 py-5">
        <p className="font-mono text-[10px] tracking-[0.18em] text-accent uppercase">
          {t("common.brand")}
        </p>
        <p className="mt-1 text-sm font-semibold tracking-tight text-ink">{t("common.product")}</p>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label={t("nav.main")}>
        {NAV_GROUPS.map((group) => (
          <div key={group.id}>
            {group.labelKey ? (
              <p className="mb-1.5 px-3 font-mono text-[10px] tracking-[0.14em] text-ink-muted uppercase">
                {t(group.labelKey)}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink className={sideNavClass} to={item.to} end={item.end}>
                    {t(item.labelKey)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-line/80 px-4 py-3 font-mono text-[10px] text-ink-muted">
        AxioNet LB
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 border-r border-line/80 bg-paper-elevated/90 backdrop-blur-md lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            aria-label={t("nav.closeMenu")}
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-line bg-paper-elevated shadow-lg">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-line/80 bg-paper-elevated/85 backdrop-blur-md">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="border border-line bg-paper px-2.5 py-1.5 font-mono text-xs text-ink hover:border-accent lg:hidden"
                aria-label={t("nav.openMenu")}
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen(true)}
              >
                ☰
              </button>
              <div className="lg:hidden">
                <p className="font-mono text-[10px] tracking-[0.18em] text-accent uppercase">
                  {t("common.brand")}
                </p>
                <p className="text-sm font-semibold text-ink">{t("common.product")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <span className="font-mono text-xs text-ink-muted">{user.username}</span>
              ) : null}
              <label className="sr-only" htmlFor="locale-select">
                {t("theme.language")}
              </label>
              <select
                id="locale-select"
                value={locale}
                onChange={(event) => setAppLocale(event.target.value as AppLocale)}
                className="border border-line bg-paper px-2 py-1 font-mono text-xs text-ink"
              >
                <option value="nb">nb</option>
                <option value="en">en</option>
              </select>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === "light" ? t("theme.toLight") : t("theme.toDark")}
                className="border border-line bg-paper px-2.5 py-1 font-mono text-xs text-ink hover:border-accent"
              >
                {theme === "light" ? "☾" : "☀"}
              </button>
              <button
                type="button"
                className="border border-line bg-paper px-2.5 py-1 font-mono text-xs text-ink hover:border-accent"
                onClick={() => {
                  void logout().then(() => navigate("/login", { replace: true }));
                }}
              >
                {t("auth.signOut")}
              </button>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
