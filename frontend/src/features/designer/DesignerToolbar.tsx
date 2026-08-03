import type { ReactNode, SVGProps } from "react";
import { useTranslation } from "react-i18next";
import type { DesignerLayoutMode } from "./autoLayout";

type IconProps = SVGProps<SVGSVGElement>;

function iconBase(props: IconProps) {
  return {
    width: 18,
    height: 18,
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

function IconSave(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M5 4h11l3 3v13H5V4Z" />
      <path d="M8 4v5h8V4" />
      <path d="M8 20v-7h8v7" />
    </svg>
  );
}

function IconValidate(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <circle cx="12" cy="12" r="8" />
      <path d="m8.5 12.5 2.2 2.2 4.8-5" />
    </svg>
  );
}

function IconPreview(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}

function IconGroup(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
      <path d="M13 7h4v4M11 17H7v-4" />
    </svg>
  );
}

function IconUngroup(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <rect x="3" y="4" width="7" height="7" rx="1" />
      <rect x="14" y="13" width="7" height="7" rx="1" />
      <path d="M14 7.5h3.5M17.5 7.5V11M10 16.5H6.5M6.5 16.5V13" />
    </svg>
  );
}

function IconApply(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M6 4.5v15l13-7.5L6 4.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconDelete(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M6 7l1 12h10l1-12" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

function IconAutoLayout(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <rect x="3" y="4" width="6" height="6" rx="1" />
      <rect x="15" y="4" width="6" height="6" rx="1" />
      <rect x="9" y="14" width="6" height="6" rx="1" />
      <path d="M9 7h6M12 10v4" />
    </svg>
  );
}

type ToolBtnProps = {
  label: string;
  title?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger";
  children: ReactNode;
};

function ToolBtn({
  label,
  title,
  onClick,
  disabled,
  variant = "default",
  children,
}: ToolBtnProps) {
  const tone =
    variant === "primary"
      ? "bg-accent text-white shadow-sm hover:brightness-125 hover:shadow-md active:brightness-95"
      : variant === "danger"
        ? "text-danger hover:bg-danger/15 hover:ring-1 hover:ring-danger/30 active:bg-danger/25"
        : "text-ink hover:bg-ink/10 hover:text-accent hover:ring-1 hover:ring-accent/25 active:bg-ink/15";

  return (
    <button
      type="button"
      className={`inline-flex size-9 items-center justify-center rounded-sm transition-[color,background-color,box-shadow,transform,filter] duration-150 ease-out hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-40 disabled:hover:scale-100 ${tone}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-line" aria-hidden />;
}

type Props = {
  saving?: boolean;
  canGroup: boolean;
  canUngroup: boolean;
  layoutMode: DesignerLayoutMode;
  onLayoutModeChange: (mode: DesignerLayoutMode) => void;
  onAutoLayout: () => void;
  onSave: () => void;
  onValidate: () => void;
  onPreview: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onApply: () => void;
  onDelete: () => void;
};

export function DesignerToolbar({
  saving,
  canGroup,
  canUngroup,
  layoutMode,
  onLayoutModeChange,
  onAutoLayout,
  onSave,
  onValidate,
  onPreview,
  onGroup,
  onUngroup,
  onApply,
  onDelete,
}: Props) {
  const { t } = useTranslation();

  return (
    <div
      className="flex shrink-0 items-center gap-0.5 border-b border-line bg-paper-elevated/80 px-2 py-1.5"
      role="toolbar"
      aria-label={t("designer.title")}
    >
      <ToolBtn label={t("designer.save")} onClick={onSave} disabled={saving}>
        <IconSave />
      </ToolBtn>
      <Divider />
      <ToolBtn label={t("designer.validate")} onClick={onValidate}>
        <IconValidate />
      </ToolBtn>
      <ToolBtn label={t("designer.preview")} onClick={onPreview}>
        <IconPreview />
      </ToolBtn>
      <Divider />
      <ToolBtn
        label={t("designer.group.action")}
        title={t("designer.group.hint")}
        onClick={onGroup}
        disabled={!canGroup}
      >
        <IconGroup />
      </ToolBtn>
      <ToolBtn
        label={t("designer.group.ungroup")}
        onClick={onUngroup}
        disabled={!canUngroup}
      >
        <IconUngroup />
      </ToolBtn>
      <Divider />
      <label className="flex items-center gap-1 px-1">
        <span className="sr-only">{t("designer.layout.mode")}</span>
        <select
          className="h-8 max-w-[7.5rem] border border-line bg-paper px-1.5 text-xs text-ink"
          value={layoutMode}
          title={t("designer.layout.mode")}
          aria-label={t("designer.layout.mode")}
          onChange={(e) => onLayoutModeChange(e.target.value as DesignerLayoutMode)}
        >
          <option value="flow">{t("designer.layout.flow")}</option>
          <option value="grid">{t("designer.layout.grid")}</option>
          <option value="stack">{t("designer.layout.stack")}</option>
        </select>
      </label>
      <ToolBtn
        label={t("designer.layout.auto")}
        title={t("designer.layout.autoHint")}
        onClick={onAutoLayout}
      >
        <IconAutoLayout />
      </ToolBtn>
      <Divider />
      <ToolBtn label={t("designer.apply")} onClick={onApply} variant="primary">
        <IconApply />
      </ToolBtn>
      <ToolBtn label={t("designer.delete")} onClick={onDelete} variant="danger">
        <IconDelete />
      </ToolBtn>
    </div>
  );
}
