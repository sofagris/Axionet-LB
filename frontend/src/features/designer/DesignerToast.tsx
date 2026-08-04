import { useEffect, type SVGProps } from "react";

export type DesignerToastIcon = "save" | "success" | "error" | "info";

type Props = {
  message: string;
  tone?: "ok" | "error";
  icon?: DesignerToastIcon;
  onDismiss: () => void;
  /** Auto-hide after ms; errors stay a bit longer. */
  durationMs?: number;
};

type IconProps = SVGProps<SVGSVGElement>;

function iconBase(props: IconProps) {
  return {
    width: 22,
    height: 22,
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

function IconSuccess(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.5 2.5L16 9.5" />
    </svg>
  );
}

function IconError(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16.5h.01" />
    </svg>
  );
}

function IconInfo(props: IconProps) {
  return (
    <svg {...iconBase(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function ToastGlyph({ icon }: { icon: DesignerToastIcon }) {
  const flip = icon === "save";
  return (
    <span
      className="designer-toast-icon inline-flex size-10 shrink-0 items-center justify-center rounded-sm"
      aria-hidden
    >
      <span
        className={[
          "inline-flex items-center justify-center",
          flip ? "designer-toast-icon-flip" : "designer-toast-icon-pop",
        ].join(" ")}
      >
        {icon === "save" ? (
          <IconSave />
        ) : icon === "error" ? (
          <IconError />
        ) : icon === "success" ? (
          <IconSuccess />
        ) : (
          <IconInfo />
        )}
      </span>
    </span>
  );
}

export function DesignerToast({
  message,
  tone = "ok",
  icon,
  onDismiss,
  durationMs,
}: Props) {
  const resolvedIcon: DesignerToastIcon =
    icon ?? (tone === "error" ? "error" : "success");
  const timeout = durationMs ?? (tone === "error" ? 8000 : 5500);

  useEffect(() => {
    const id = window.setTimeout(onDismiss, timeout);
    return () => window.clearTimeout(id);
  }, [message, tone, timeout, onDismiss]);

  return (
    <div
      className="pointer-events-none absolute top-3 right-3 z-[40] w-[min(100%-1.5rem,22rem)]"
      role="status"
      aria-live="polite"
    >
      <div
        className={[
          "designer-toast-enter pointer-events-auto flex items-center gap-3 border px-4 py-3.5 text-base shadow-lg",
          tone === "error"
            ? "border-danger/45 bg-paper-elevated text-danger"
            : "border-ok/45 bg-paper-elevated text-ok",
        ].join(" ")}
      >
        <ToastGlyph icon={resolvedIcon} />
        <p className="min-w-0 flex-1 leading-snug text-ink">{message}</p>
        <button
          type="button"
          className="shrink-0 self-start px-1 text-lg leading-none text-ink-muted hover:text-ink"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
