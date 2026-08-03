import { useState, type SVGProps } from "react";
import { useTranslation } from "react-i18next";

type Props = {
  groupCount: number;
  onCancel: () => void;
  onConfirm: (deleteNodes: boolean) => void;
};

type IconProps = SVGProps<SVGSVGElement>;

function iconBase(props: IconProps) {
  return {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    ...props,
  };
}

function IconWarning(props: IconProps) {
  return (
    <svg {...iconBase({ width: 22, height: 22, ...props })}>
      <path d="M12 3.5 21 19H3L12 3.5Z" />
      <path d="M12 10v4" />
      <path d="M12 16.5h.01" />
    </svg>
  );
}

function IconCancel(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <circle cx="12" cy="12" r="8" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </svg>
  );
}

function IconTrash(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M6 7l1 12h10l1-12" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

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
        <div className="flex items-start gap-3">
          <span
            className={[
              "mt-0.5 inline-flex shrink-0 rounded-md border p-2",
              deleteNodes
                ? "border-danger/40 bg-danger/10 text-danger"
                : "border-warn/40 bg-warn/10 text-warn",
            ].join(" ")}
            aria-hidden
          >
            <IconWarning />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="designer-delete-group-title" className="text-lg font-semibold text-ink">
              {groupCount > 1
                ? t("designer.deleteGroup.titleMany", { count: groupCount })
                : t("designer.deleteGroup.title")}
            </h2>
            <p className="mt-2 text-sm text-ink-muted">{t("designer.deleteGroup.body")}</p>
          </div>
        </div>

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
            className="inline-flex items-center gap-1.5 border border-line px-3 py-1.5 text-sm text-ink-muted hover:border-accent hover:text-ink"
            onClick={onCancel}
          >
            <IconCancel />
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className={[
              "inline-flex items-center gap-1.5 border px-3 py-1.5 text-sm",
              deleteNodes
                ? "border-danger bg-danger/15 text-danger hover:bg-danger/25"
                : "border-warn/60 bg-warn/10 text-warn hover:bg-warn/20",
            ].join(" ")}
            onClick={() => onConfirm(deleteNodes)}
          >
            <IconTrash />
            {t("designer.deleteGroup.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
