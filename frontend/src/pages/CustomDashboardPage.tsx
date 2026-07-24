import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useAppendDashboardWidget,
  useDashboard,
  useDeleteDashboard,
  useUpdateDashboard,
} from "../features/dashboards/hooks";
import {
  UnknownWidgetNotice,
  WIDGET_CATALOG,
  renderDashboardWidget,
} from "../features/dashboards/widgetRegistry";
import type { WidgetType } from "../types/dashboards";

export function CustomDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { dashboardId = "" } = useParams();
  const dashboardQuery = useDashboard(dashboardId);
  const updateMutation = useUpdateDashboard(dashboardId);
  const appendMutation = useAppendDashboardWidget(dashboardId);
  const deleteMutation = useDeleteDashboard();

  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [showCatalog, setShowCatalog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dashboard = dashboardQuery.data;

  const startRename = () => {
    if (!dashboard) return;
    setName(dashboard.name);
    setRenaming(true);
  };

  const onRename = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await updateMutation.mutateAsync({ name: name.trim() });
      setRenaming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("dashboards.renameFailed"));
    }
  };

  const addWidget = async (type: WidgetType) => {
    setError(null);
    try {
      await appendMutation.mutateAsync({ type, config: {} });
      setShowCatalog(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("dashboards.addWidgetFailed"));
    }
  };

  const removeWidget = async (widgetId: string) => {
    if (!dashboard) return;
    setError(null);
    try {
      await updateMutation.mutateAsync({
        widgets: dashboard.widgets.filter((w) => w.id !== widgetId),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("dashboards.removeWidgetFailed"));
    }
  };

  if (dashboardQuery.isLoading) {
    return <p className="text-ink-muted">{t("common.loading")}</p>;
  }

  if (dashboardQuery.isError || !dashboard) {
    return (
      <div className="space-y-3">
        <p className="text-danger">{t("dashboards.notFound")}</p>
        <Link to="/dashboards" className="text-sm text-domain-system hover:underline">
          {t("dashboards.backToList")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div className="min-w-0">
          <Link
            to="/dashboards"
            className="font-mono text-[10px] tracking-[0.14em] text-domain-system uppercase hover:underline"
          >
            {t("dashboards.eyebrow")}
          </Link>
          {renaming ? (
            <form onSubmit={onRename} className="mt-2 flex flex-wrap items-center gap-2">
              <input
                className="border border-line bg-paper px-3 py-1.5 text-lg font-semibold text-ink"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={128}
                autoFocus
              />
              <button
                type="submit"
                className="border border-domain-system px-2.5 py-1.5 text-xs text-domain-system"
                disabled={updateMutation.isPending}
              >
                {t("common.save")}
              </button>
              <button
                type="button"
                className="border border-line px-2.5 py-1.5 text-xs text-ink-muted"
                onClick={() => setRenaming(false)}
              >
                {t("common.cancel")}
              </button>
            </form>
          ) : (
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-ink">{dashboard.name}</h1>
              <button
                type="button"
                className="font-mono text-[11px] text-ink-muted uppercase hover:text-ink"
                onClick={startRename}
              >
                {t("dashboards.rename")}
              </button>
            </div>
          )}
          {dashboard.description ? (
            <p className="mt-1 max-w-2xl text-sm text-ink-muted">{dashboard.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="border border-domain-system bg-domain-system-soft px-3 py-2 text-sm text-domain-system"
            onClick={() => setShowCatalog((v) => !v)}
          >
            {t("dashboards.addWidget")}
          </button>
          <button
            type="button"
            className="border border-line px-3 py-2 text-sm text-danger"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (window.confirm(t("dashboards.confirmDelete", { name: dashboard.name }))) {
                void deleteMutation.mutateAsync(dashboard.id).then(() => {
                  navigate("/dashboards");
                });
              }
            }}
          >
            {t("common.delete")}
          </button>
        </div>
      </header>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {showCatalog ? (
        <div className="border border-line bg-paper-elevated/40 p-4">
          <h2 className="text-sm font-semibold text-ink">{t("dashboards.catalogTitle")}</h2>
          <ul className="mt-3 space-y-2">
            {WIDGET_CATALOG.map((item) => (
              <li
                key={item.type}
                className="flex flex-wrap items-center justify-between gap-3 border border-line bg-paper px-3 py-2"
              >
                <div>
                  <p className="font-medium text-ink">{t(item.labelKey)}</p>
                  <p className="text-sm text-ink-muted">{t(item.descriptionKey)}</p>
                </div>
                <button
                  type="button"
                  className="border border-domain-system px-2.5 py-1 text-xs text-domain-system"
                  disabled={appendMutation.isPending}
                  onClick={() => void addWidget(item.type)}
                >
                  {t("dashboards.addWidget")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dashboard.widgets.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("dashboards.noWidgets")}</p>
      ) : (
        <div className="space-y-6">
          {dashboard.widgets.map((widget) => {
            const node = renderDashboardWidget(widget);
            return (
              <div key={widget.id} className="relative">
                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    className="font-mono text-[11px] text-ink-muted uppercase hover:text-danger"
                    onClick={() => void removeWidget(widget.id)}
                    disabled={updateMutation.isPending}
                  >
                    {t("dashboards.removeWidget")}
                  </button>
                </div>
                {node ?? <UnknownWidgetNotice type={String(widget.type)} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
