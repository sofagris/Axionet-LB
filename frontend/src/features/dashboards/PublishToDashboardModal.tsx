import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useCreateDashboard,
  useDashboards,
  usePublishWidget,
} from "./hooks";

type Props = {
  open: boolean;
  onClose: () => void;
  widgetType?: "traffic_flow";
};

export function PublishToDashboardModal({
  open,
  onClose,
  widgetType = "traffic_flow",
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const listQuery = useDashboards();
  const createMutation = useCreateDashboard();
  const publishMutation = usePublishWidget();

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [dashboardId, setDashboardId] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const dashboards = listQuery.data ?? [];
  const selectedId = useMemo(() => {
    if (dashboardId) return dashboardId;
    return dashboards[0]?.id ?? "";
  }, [dashboardId, dashboards]);

  if (!open) return null;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      let targetId = selectedId;
      if (mode === "new") {
        const created = await createMutation.mutateAsync({ name: newName.trim() });
        targetId = created.id;
      }
      if (!targetId) {
        setError(t("dashboards.publishNeedTarget"));
        return;
      }
      await publishMutation.mutateAsync({
        dashboardId: targetId,
        payload: { type: widgetType, config: {} },
      });
      onClose();
      navigate(`/dashboards/${targetId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("dashboards.publishFailed"));
    }
  };

  const busy = createMutation.isPending || publishMutation.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-dashboard-title"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 border border-line bg-paper p-5 shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="publish-dashboard-title" className="text-lg font-semibold text-ink">
              {t("dashboards.publishTitle")}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">{t("dashboards.publishHint")}</p>
          </div>
          <button
            type="button"
            className="font-mono text-xs text-ink-muted uppercase hover:text-ink"
            onClick={onClose}
          >
            {t("common.cancel")}
          </button>
        </div>

        <div className="flex border border-line text-xs">
          <button
            type="button"
            className={[
              "flex-1 px-3 py-2",
              mode === "existing"
                ? "bg-domain-system-soft text-domain-system"
                : "text-ink-muted",
            ].join(" ")}
            onClick={() => setMode("existing")}
          >
            {t("dashboards.publishExisting")}
          </button>
          <button
            type="button"
            className={[
              "flex-1 border-l border-line px-3 py-2",
              mode === "new" ? "bg-domain-system-soft text-domain-system" : "text-ink-muted",
            ].join(" ")}
            onClick={() => setMode("new")}
          >
            {t("dashboards.publishNew")}
          </button>
        </div>

        {mode === "existing" ? (
          dashboards.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("dashboards.publishNoDashboards")}</p>
          ) : (
            <label className="block text-sm">
              <span className="text-ink-muted">{t("dashboards.title")}</span>
              <select
                className="mt-1 w-full border border-line bg-paper px-3 py-2 text-ink"
                value={selectedId}
                onChange={(e) => setDashboardId(e.target.value)}
              >
                {dashboards.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )
        ) : (
          <label className="block text-sm">
            <span className="text-ink-muted">{t("dashboards.name")}</span>
            <input
              className="mt-1 w-full border border-line bg-paper px-3 py-2 text-ink"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              maxLength={128}
            />
          </label>
        )}

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <button
          type="submit"
          className="w-full border border-domain-system bg-domain-system-soft px-3 py-2 text-sm text-domain-system disabled:opacity-40"
          disabled={
            busy ||
            (mode === "existing" && dashboards.length === 0) ||
            (mode === "new" && !newName.trim())
          }
        >
          {t("dashboards.publishAction")}
        </button>
      </form>
    </div>
  );
}
