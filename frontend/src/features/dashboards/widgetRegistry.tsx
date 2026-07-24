import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { TrafficFlowCard } from "../dashboard/TrafficFlowCard";
import { useInstances } from "../instances/hooks";
import { useSystemHealth, useSystemMetrics, useLbMetrics } from "../system/hooks";
import { useTelemetryHistory } from "../telemetry/useTelemetryHistory";
import { useVips } from "../vips/hooks";
import type { DashboardWidget, WidgetType } from "../../types/dashboards";

export type WidgetCatalogItem = {
  type: WidgetType;
  labelKey: string;
  descriptionKey: string;
};

export const WIDGET_CATALOG: WidgetCatalogItem[] = [
  {
    type: "traffic_flow",
    labelKey: "dashboards.widgets.trafficFlow.label",
    descriptionKey: "dashboards.widgets.trafficFlow.description",
  },
];

function TrafficFlowWidget() {
  const instancesQuery = useInstances();
  const vipsQuery = useVips();
  const lbMetricsQuery = useLbMetrics();
  const metricsQuery = useSystemMetrics();
  const healthQuery = useSystemHealth();

  const history = useTelemetryHistory({
    metrics: metricsQuery.data,
    health: healthQuery.data,
    instances: instancesQuery.data,
    lbMetrics: lbMetricsQuery.data,
  });
  const latest = history.length ? history[history.length - 1] : null;

  return (
    <TrafficFlowCard
      instances={instancesQuery.data ?? []}
      vips={vipsQuery.data ?? []}
      lbMetrics={lbMetricsQuery.data}
      bitRates={{ rxBps: latest?.lbRxBps ?? null, txBps: latest?.lbTxBps ?? null }}
      loading={instancesQuery.isLoading || lbMetricsQuery.isLoading || vipsQuery.isLoading}
    />
  );
}

export function renderDashboardWidget(widget: DashboardWidget): ReactNode {
  switch (widget.type) {
    case "traffic_flow":
      return <TrafficFlowWidget key={widget.id} />;
    default:
      return null;
  }
}

export function UnknownWidgetNotice({ type }: { type: string }) {
  const { t } = useTranslation();
  return (
    <div className="border border-line bg-paper-elevated/40 px-4 py-3 text-sm text-ink-muted">
      {t("dashboards.unknownWidget", { type })}
    </div>
  );
}
