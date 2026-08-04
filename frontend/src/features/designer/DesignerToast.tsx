import { useEffect } from "react";

type Props = {
  message: string;
  tone?: "ok" | "error";
  onDismiss: () => void;
  /** Auto-hide after ms; errors stay a bit longer. */
  durationMs?: number;
};

export function DesignerToast({
  message,
  tone = "ok",
  onDismiss,
  durationMs,
}: Props) {
  const timeout = durationMs ?? (tone === "error" ? 6000 : 3200);

  useEffect(() => {
    const id = window.setTimeout(onDismiss, timeout);
    return () => window.clearTimeout(id);
  }, [message, tone, timeout, onDismiss]);

  return (
    <div
      className="pointer-events-none absolute top-3 right-3 z-[40] max-w-sm"
      role="status"
      aria-live="polite"
    >
      <div
        className={[
          "pointer-events-auto flex items-start gap-2 border px-3 py-2 text-sm shadow-lg",
          tone === "error"
            ? "border-danger/40 bg-paper-elevated text-danger"
            : "border-ok/40 bg-paper-elevated text-ok",
        ].join(" ")}
      >
        <p className="min-w-0 flex-1 leading-snug">{message}</p>
        <button
          type="button"
          className="shrink-0 text-ink-muted hover:text-ink"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
