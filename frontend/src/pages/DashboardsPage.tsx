import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MutationGate } from "../components/MutationGate";
import { useCreateDashboard, useDashboards, useDeleteDashboard } from "../features/dashboards/hooks";

export function DashboardsPage() {
  const { t } = useTranslation();
  const listQuery = useDashboards();
  const createMutation = useCreateDashboard();
  const deleteMutation = useDeleteDashboard();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
      });
      setName("");
      setDescription("");
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("dashboards.createFailed"));
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="font-mono text-[10px] tracking-[0.16em] text-domain-system uppercase">
            {t("dashboards.eyebrow")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">{t("dashboards.title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{t("dashboards.subtitle")}</p>
        </div>
        <MutationGate hide>
          <button
            type="button"
            className="border border-domain-system bg-domain-system-soft px-3 py-2 text-sm text-domain-system"
            onClick={() => setShowCreate((v) => !v)}
          >
            {t("dashboards.add")}
          </button>
        </MutationGate>
      </header>

      <MutationGate>
      {showCreate ? (
        <form
          onSubmit={onCreate}
          className="max-w-lg space-y-3 border border-line bg-paper-elevated/40 p-4"
        >
          <h2 className="text-sm font-semibold text-ink">{t("dashboards.createTitle")}</h2>
          <label className="block text-sm">
            <span className="text-ink-muted">{t("dashboards.name")}</span>
            <input
              className="mt-1 w-full border border-line bg-paper px-3 py-2 text-ink"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={128}
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-muted">{t("dashboards.description")}</span>
            <textarea
              className="mt-1 w-full border border-line bg-paper px-3 py-2 text-ink"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={2000}
            />
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="submit"
              className="border border-domain-system bg-domain-system-soft px-3 py-1.5 text-sm text-domain-system"
              disabled={createMutation.isPending || !name.trim()}
            >
              {t("dashboards.create")}
            </button>
            <button
              type="button"
              className="border border-line px-3 py-1.5 text-sm text-ink-muted"
              onClick={() => setShowCreate(false)}
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      ) : null}

      {listQuery.isLoading ? <p className="text-ink-muted">{t("common.loading")}</p> : null}
      {listQuery.isError ? (
        <p className="text-danger">{t("dashboards.loadFailed")}</p>
      ) : null}

      {!listQuery.isLoading && (listQuery.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-ink-muted">{t("dashboards.empty")}</p>
      ) : null}

      <ul className="divide-y divide-line border border-line">
        {(listQuery.data ?? []).map((dashboard) => (
          <li
            key={dashboard.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <Link
                to={`/dashboards/${dashboard.id}`}
                className="font-medium text-ink hover:text-domain-system hover:underline"
              >
                {dashboard.name}
              </Link>
              {dashboard.description ? (
                <p className="mt-0.5 truncate text-sm text-ink-muted">{dashboard.description}</p>
              ) : null}
              <p className="mt-1 font-mono text-[11px] text-ink-muted">
                {t("dashboards.widgetCount", { count: dashboard.widgets.length })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={`/dashboards/${dashboard.id}`}
                className="border border-line px-2.5 py-1 text-xs text-ink hover:border-domain-system"
              >
                {t("dashboards.open")}
              </Link>
              <button
                type="button"
                className="border border-line px-2.5 py-1 text-xs text-danger hover:border-danger"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (window.confirm(t("dashboards.confirmDelete", { name: dashboard.name }))) {
                    void deleteMutation.mutateAsync(dashboard.id);
                  }
                }}
              >
                {t("common.delete")}
              </button>
            </div>
          </li>
        ))}
      </ul>
      </MutationGate>
    </div>
  );
}
