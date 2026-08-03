import { useEffect, useRef, useState, type ReactNode, type SVGProps } from "react";
import { useTranslation } from "react-i18next";
import type { ElkLayoutKind } from "./layoutPrefs";
import type { DesignerLayoutPrefs } from "./layoutPrefs";

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

function IconSnap(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <path d="M4 4h4v4H4zM16 4h4v4h-4zM4 16h4v4H4zM16 16h4v4h-4z" />
      <path d="M8 6h8M6 8v8M18 8v8M8 18h8" />
    </svg>
  );
}

const LAYOUT_KINDS: ElkLayoutKind[] = [
  "traffic",
  "process",
  "tree",
  "star",
  "swimlanes",
  "compact",
  "selected",
];

type ToolBtnProps = {
  label: string;
  title?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger";
  pressed?: boolean;
  children: ReactNode;
};

function ToolBtn({
  label,
  title,
  onClick,
  disabled,
  variant = "default",
  pressed,
  children,
}: ToolBtnProps) {
  const tone =
    variant === "primary"
      ? "bg-accent text-white shadow-sm hover:brightness-125 hover:shadow-md active:brightness-95"
      : variant === "danger"
        ? "text-danger hover:bg-danger/15 hover:ring-1 hover:ring-danger/30 active:bg-danger/25"
        : pressed
          ? "bg-accent/15 text-accent ring-1 ring-accent/40"
          : "text-ink hover:bg-ink/10 hover:text-accent hover:ring-1 hover:ring-accent/25 active:bg-ink/15";

  return (
    <button
      type="button"
      className={`inline-flex size-9 items-center justify-center rounded-sm transition-[color,background-color,box-shadow,transform,filter] duration-150 ease-out hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-40 disabled:hover:scale-100 ${tone}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
      aria-pressed={pressed}
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
  layoutPrefs: DesignerLayoutPrefs;
  onLayoutPrefsChange: (prefs: DesignerLayoutPrefs) => void;
  onRunLayout: (kind: ElkLayoutKind) => void;
  layoutBusy?: boolean;
  onSave: () => void;
  onValidate: () => void;
  onPreview: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onApply: () => void;
  onDelete: () => void;
  onAddSiteLane?: () => void;
  onAddSharedLane?: () => void;
};

export function DesignerToolbar({
  saving,
  canGroup,
  canUngroup,
  layoutPrefs,
  onLayoutPrefsChange,
  onRunLayout,
  layoutBusy,
  onSave,
  onValidate,
  onPreview,
  onGroup,
  onUngroup,
  onApply,
  onDelete,
  onAddSiteLane,
  onAddSharedLane,
}: Props) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [optsOpen, setOptsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen && !optsOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
        setOptsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen, optsOpen]);

  const patchPrefs = (patch: Partial<DesignerLayoutPrefs>) => {
    onLayoutPrefsChange({ ...layoutPrefs, ...patch });
  };

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
      {onAddSiteLane ? (
        <ToolBtn
          label={t("designer.placement.addSiteLane")}
          title={t("designer.placement.addSiteLaneHint")}
          onClick={onAddSiteLane}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <path d="M4 20V9l8-5 8 5v11" />
            <path d="M9 20v-6h6v6" />
            <path d="M12 11v4M10 13h4" />
          </svg>
        </ToolBtn>
      ) : null}
      {onAddSharedLane ? (
        <ToolBtn
          label={t("designer.placement.addSharedLane")}
          title={t("designer.placement.addSharedLaneHint")}
          onClick={onAddSharedLane}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <circle cx="8" cy="10" r="3" />
            <circle cx="16" cy="10" r="3" />
            <path d="M4 18c0-2 2-4 4-4M16 14c2 0 4 2 4 4M12 11v5M10 13h4" />
          </svg>
        </ToolBtn>
      ) : null}
      <Divider />
      <div className="relative flex items-center gap-0.5" ref={menuRef}>
        <ToolBtn
          label={t("designer.layout.auto")}
          title={t("designer.layout.autoHint")}
          onClick={() => {
            setMenuOpen((o) => !o);
            setOptsOpen(false);
          }}
          disabled={layoutBusy}
          pressed={menuOpen}
        >
          <IconAutoLayout />
        </ToolBtn>
        <button
          type="button"
          className="h-8 border border-line bg-paper px-1.5 text-[10px] text-ink-muted hover:border-accent hover:text-accent"
          onClick={() => {
            setOptsOpen((o) => !o);
            setMenuOpen(false);
          }}
          aria-expanded={optsOpen}
          aria-label={t("designer.layout.options")}
          title={t("designer.layout.options")}
        >
          ▾
        </button>
        {menuOpen ? (
          <div
            className="absolute top-full left-0 z-[30] mt-1 min-w-[14rem] border border-line bg-paper-elevated py-1 shadow-lg"
            role="menu"
          >
            <p className="px-3 py-1 font-mono text-[10px] tracking-wide text-ink-muted uppercase">
              {t("designer.layout.auto")}
            </p>
            {LAYOUT_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-paper"
                disabled={layoutBusy}
                onClick={() => {
                  setMenuOpen(false);
                  onRunLayout(kind);
                }}
              >
                {t(`designer.layout.kinds.${kind}`)}
              </button>
            ))}
          </div>
        ) : null}
        {optsOpen ? (
          <div className="absolute top-full left-0 z-[30] mt-1 min-w-[15rem] space-y-2 border border-line bg-paper-elevated px-3 py-2 text-xs shadow-lg">
            <p className="font-mono text-[10px] tracking-wide text-ink-muted uppercase">
              {t("designer.layout.options")}
            </p>
            {(
              [
                ["preserveGroups", "preserveGroups"],
                ["preservePinned", "preservePinned"],
                ["animate", "animate"],
                ["fitView", "fitView"],
                ["snapToGrid", "snapToGrid"],
              ] as const
            ).map(([key, labelKey]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2 text-ink">
                <input
                  type="checkbox"
                  checked={layoutPrefs[key]}
                  onChange={(e) => patchPrefs({ [key]: e.target.checked })}
                />
                {t(`designer.layout.${labelKey}`)}
              </label>
            ))}
          </div>
        ) : null}
      </div>
      <ToolBtn
        label={t("designer.layout.snapToGrid")}
        onClick={() => patchPrefs({ snapToGrid: !layoutPrefs.snapToGrid })}
        pressed={layoutPrefs.snapToGrid}
      >
        <IconSnap />
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
