import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "../features/theme/ThemeProvider";
import { setAppLocale, type AppLocale } from "../i18n";

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? "border-b-2 border-accent pb-0.5 font-medium text-ink"
    : "text-ink-muted hover:text-ink";
}

export function AppLayout() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const locale = (i18n.language === "en" ? "en" : "nb") as AppLocale;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-paper-elevated/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-6 py-5">
          <div>
            <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">
              {t("common.brand")}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{t("common.product")}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <nav className="flex flex-wrap gap-4 text-sm">
              <NavLink className={navClass} to="/" end>
                {t("nav.dashboard")}
              </NavLink>
              <NavLink className={navClass} to="/interfaces">
                {t("nav.interfaces")}
              </NavLink>
              <NavLink className={navClass} to="/networks">
                {t("nav.networks")}
              </NavLink>
              <NavLink className={navClass} to="/catalog">
                {t("nav.catalog")}
              </NavLink>
              <NavLink className={navClass} to="/instances">
                {t("nav.instances")}
              </NavLink>
            </nav>
            <div className="flex items-center gap-2 border-l border-line pl-4">
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
                aria-label={theme === "light" ? t("theme.toDark") : t("theme.toLight")}
                className="border border-line bg-paper px-2.5 py-1 font-mono text-xs text-ink hover:border-accent"
              >
                {theme === "light" ? "☾" : "☀"}
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
