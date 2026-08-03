import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  IconCatalog,
  IconCustomers,
  IconDashboard,
  IconDesigner,
  IconInstances,
  IconInterfaces,
  IconLogs,
  IconNetworks,
  IconSettings,
  IconUsers,
  IconVips,
} from "../components/icons/NavIcons";
import { ReadOnlyBanner } from "../components/ReadOnlyBanner";
import { useAuth } from "../features/auth/AuthProvider";
import { usePermissions } from "../features/auth/usePermissions";
import {
  DESIGNER_FULL_WIDTH_EVENT,
  readDesignerFullWidth,
} from "../features/designer/fullWidth";
import { tenancyNavLabelKey, useTenancy } from "../features/tenancy/TenancyProvider";
import { useTheme } from "../features/theme/ThemeProvider";
import { setAppLocale, type AppLocale } from "../i18n";
import {
  domainBorder,
  domainSoftBg,
  domainText,
  type UiDomain,
} from "../lib/domains";

type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

type NavItem = {
  to: string;
  labelKey: string;
  end?: boolean;
  icon: IconComp;
};

type NavGroup = {
  id: string;
  labelKey?: string;
  domain: UiDomain;
  items: NavItem[];
};

function sideNavClass(domain: UiDomain, { isActive }: { isActive: boolean }): string {
  if (isActive) {
    return [
      "flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2 text-sm font-medium text-ink",
      domainBorder[domain],
      domainSoftBg[domain],
    ].join(" ");
  }
  return [
    "flex items-center gap-2.5 rounded-md border-l-2 border-transparent px-3 py-2 text-sm",
    "text-ink-muted hover:bg-paper-elevated hover:text-ink",
  ].join(" ");
}

export function AppLayout() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { mode } = useTenancy();
  const { user, logout } = useAuth();
  const { isAdmin } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const locale = (i18n.language === "en" ? "en" : "nb") as AppLocale;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [designerFullWidth, setDesignerFullWidth] = useState(readDesignerFullWidth);
  const isDesigner = location.pathname.startsWith("/designer");
  const useFullMain = isDesigner && designerFullWidth;

  useEffect(() => {
    const sync = () => setDesignerFullWidth(readDesignerFullWidth());
    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<{ fullWidth?: boolean }>).detail;
      if (typeof detail?.fullWidth === "boolean") {
        setDesignerFullWidth(detail.fullWidth);
      } else {
        sync();
      }
    };
    window.addEventListener(DESIGNER_FULL_WIDTH_EVENT, onCustom);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(DESIGNER_FULL_WIDTH_EVENT, onCustom);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const navGroups = useMemo((): NavGroup[] => {
    const tenancyLabel = tenancyNavLabelKey(mode);
    const trafficItems: NavItem[] = [
      { to: "/catalog", labelKey: "nav.catalog", icon: IconCatalog },
      { to: "/designer", labelKey: "nav.designer", icon: IconDesigner },
      ...(tenancyLabel
        ? [{ to: "/customers", labelKey: tenancyLabel, icon: IconCustomers } satisfies NavItem]
        : []),
      { to: "/instances", labelKey: "nav.instances", icon: IconInstances },
      { to: "/vips", labelKey: "nav.vips", icon: IconVips },
    ];

    const systemItems: NavItem[] = [
      { to: "/dashboards", labelKey: "nav.dashboards", icon: IconDashboard },
      ...(isAdmin
        ? [
            { to: "/users", labelKey: "nav.users", icon: IconUsers } satisfies NavItem,
            { to: "/identity", labelKey: "nav.identity", icon: IconSettings } satisfies NavItem,
          ]
        : []),
      { to: "/settings", labelKey: "nav.settings", icon: IconSettings },
    ];

    return [
      {
        id: "dashboard",
        domain: "system",
        items: [{ to: "/", labelKey: "nav.dashboard", end: true, icon: IconDashboard }],
      },
      {
        id: "traffic",
        labelKey: "nav.groups.traffic",
        domain: "traffic",
        items: trafficItems,
      },
      {
        id: "interfaces",
        labelKey: "nav.groups.interfaces",
        domain: "interfaces",
        items: [
          { to: "/interfaces", labelKey: "nav.interfaces", icon: IconInterfaces },
          { to: "/networks", labelKey: "nav.networks", icon: IconNetworks },
        ],
      },
      {
        id: "observe",
        labelKey: "nav.groups.observe",
        domain: "observe",
        items: [{ to: "/logs", labelKey: "nav.logs", icon: IconLogs }],
      },
      {
        id: "system",
        labelKey: "nav.groups.system",
        domain: "system",
        items: systemItems,
      },
    ];
  }, [mode, isAdmin]);

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
        <p className="font-mono text-[10px] tracking-[0.18em] text-domain-traffic uppercase">
          {t("common.brand")}
        </p>
        <p className="mt-1 text-sm font-semibold tracking-tight text-ink">{t("common.product")}</p>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label={t("nav.main")}>
        {navGroups.map((group) => (
          <div key={group.id}>
            {group.labelKey ? (
              <p
                className={[
                  "mb-1.5 px-3 font-mono text-[10px] tracking-[0.14em] uppercase",
                  domainText[group.domain],
                  "opacity-80",
                ].join(" ")}
              >
                {t(group.labelKey)}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      className={(state) => sideNavClass(group.domain, state)}
                      to={item.to}
                      end={item.end}
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={
                              isActive ? domainText[group.domain] : "text-ink-muted opacity-70"
                            }
                          />
                          <span>{t(item.labelKey)}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
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
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 border-r border-line/80 bg-paper-elevated/90 backdrop-blur-md lg:block">
        {sidebar}
      </aside>

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
                className="border border-line bg-paper px-2.5 py-1.5 font-mono text-xs text-ink hover:border-domain-traffic lg:hidden"
                aria-label={t("nav.openMenu")}
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen(true)}
              >
                ☰
              </button>
              <div className="lg:hidden">
                <p className="font-mono text-[10px] tracking-[0.18em] text-domain-traffic uppercase">
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
                className="border border-line bg-paper px-2.5 py-1 font-mono text-xs text-ink hover:border-domain-traffic"
              >
                {theme === "light" ? "☾" : "☀"}
              </button>
              <button
                type="button"
                className="border border-line bg-paper px-2.5 py-1 font-mono text-xs text-ink hover:border-domain-traffic"
                onClick={() => {
                  void logout().then(() => navigate("/login", { replace: true }));
                }}
              >
                {t("auth.signOut")}
              </button>
            </div>
          </div>
        </header>
        <ReadOnlyBanner />
        <main
          className={
            useFullMain
              ? "w-full flex-1 px-3 py-4 sm:px-4 sm:py-5"
              : "mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8"
          }
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
