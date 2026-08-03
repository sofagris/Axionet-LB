import type { ReactNode, SVGProps } from "react";
import { useTranslation } from "react-i18next";

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
      ? "bg-accent text-white hover:brightness-110 disabled:opacity-40"
      : variant === "danger"
        ? "text-danger hover:bg-danger/10 disabled:opacity-40"
        : "text-ink hover:bg-paper-elevated disabled:opacity-40";

  return (
    <button
      type="button"
      className={`inline-flex size-9 items-center justify-center rounded-sm transition-colors disabled:pointer-events-none ${tone}`}
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
      <ToolBtn label={t("designer.apply")} onClick={onApply} variant="primary">
        <IconApply />
      </ToolBtn>
      <ToolBtn label={t("designer.delete")} onClick={onDelete} variant="danger">
        <IconDelete />
      </ToolBtn>
    </div>
  );
}
