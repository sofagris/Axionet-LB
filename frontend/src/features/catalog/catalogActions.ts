import type { TFunction } from "i18next";
import type { CatalogAction } from "./catalogTypes";

export function catalogActionLabel(t: TFunction, action: CatalogAction): string {
  switch (action) {
    case "create-instance":
      return t("catalog.actions.createInstance");
    case "create-service":
      return t("catalog.actions.createService");
    case "deploy-stack":
      return t("catalog.actions.deployStack");
    case "start-wizard":
      return t("catalog.actions.startWizard");
    case "configure-integration":
      return t("catalog.actions.configureIntegration");
    case "connect-provider":
      return t("catalog.actions.connectProvider");
    case "manage-provider":
      return t("catalog.actions.manageProvider");
    default:
      return t("catalog.actions.createInstance");
  }
}
