import { useTranslation } from "react-i18next";
import { usePermissions } from "../features/auth/usePermissions";

export function ReadOnlyBanner() {
  const { t } = useTranslation();
  const { isViewer } = usePermissions();
  if (!isViewer) return null;
  return (
    <div
      role="status"
      className="border-b border-warn/40 bg-warn/10 px-4 py-2 font-mono text-xs text-ink sm:px-6"
    >
      {t("auth.readOnlyBanner")}
    </div>
  );
}
