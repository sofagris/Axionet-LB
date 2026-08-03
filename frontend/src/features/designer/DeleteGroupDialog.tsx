import { useState } from "react";
import { useTranslation } from "react-i18next";

type Props = {
  groupCount: number;
  onCancel: () => void;
  onConfirm: (deleteNodes: boolean) => void;
};

export function DeleteGroupDialog({ groupCount, onCancel, onConfirm }: Props) {
  const { t } = useTranslation();
  const [deleteNodes, setDeleteNodes] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="designer-delete-group-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md border border-line bg-paper-elevated p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="designer-delete-group-title" className="text-lg font-semibold text-ink">
          {groupCount > 1
            ? t("designer.deleteGroup.titleMany", { count: groupCount })
            : t("designer.deleteGroup.title")}
        </h2>
        <p className="mt-2 text-sm text-ink-muted">{t("designer.deleteGroup.body")}</p>
        <label className="mt-4 flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={deleteNodes}
            onChange={(e) => setDeleteNodes(e.target.checked)}
          />
          <span>
            <span className="font-medium">{t("designer.deleteGroup.deleteNodes")}</span>
            <span className="mt-0.5 block text-ink-muted">
              {t("designer.deleteGroup.deleteNodesHint")}
            </span>
          </span>
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="border border-line px-3 py-1.5 text-sm text-ink-muted hover:border-accent"
            onClick={onCancel}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="border border-danger bg-danger/10 px-3 py-1.5 text-sm text-danger hover:bg-danger/20"
            onClick={() => onConfirm(deleteNodes)}
          >
            {t("designer.deleteGroup.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
