import type { Instance } from "../../types/instances";
import type { Vip } from "../../types/vips";
import type { DesignerEdge, DesignerNode } from "./types";

export type ValidationIssue = {
  id: string;
  severity: "error" | "warning";
  messageKey: string;
  messageParams?: Record<string, string>;
  nodeId?: string;
};

export function validateDesignerGraph(input: {
  nodes: DesignerNode[];
  edges: DesignerEdge[];
  instances: Instance[];
  vips: Vip[];
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const instanceIds = new Set(input.instances.map((i) => i.id));
  const vipIds = new Set(input.vips.map((v) => v.id));
  const nodeIds = new Set(input.nodes.map((n) => n.id));

  for (const node of input.nodes) {
    const data = node.data;
    if (data.kind === "placement.lane") continue;
    if (data.comingSoon || data.catalogStatus === "planned" || data.catalogStatus === "concept") {
      issues.push({
        id: `planned-${node.id}`,
        severity: "error",
        messageKey: "designer.validation.plannedNode",
        messageParams: { label: data.label },
        nodeId: node.id,
      });
    }
    if (data.kind === "instance.ref") {
      if (!data.serviceId) {
        issues.push({
          id: `missing-service-${node.id}`,
          severity: "error",
          messageKey: "designer.validation.missingServiceId",
          messageParams: { label: data.label },
          nodeId: node.id,
        });
      } else if (!instanceIds.has(data.serviceId)) {
        issues.push({
          id: `broken-service-${node.id}`,
          severity: "error",
          messageKey: "designer.validation.brokenInstance",
          messageParams: { label: data.label },
          nodeId: node.id,
        });
      }
    }
    if (data.kind === "vip.ref") {
      if (!data.vipId) {
        issues.push({
          id: `missing-vip-${node.id}`,
          severity: "error",
          messageKey: "designer.validation.missingVipId",
          messageParams: { label: data.label },
          nodeId: node.id,
        });
      } else if (!vipIds.has(data.vipId)) {
        issues.push({
          id: `broken-vip-${node.id}`,
          severity: "error",
          messageKey: "designer.validation.brokenVip",
          messageParams: { label: data.label },
          nodeId: node.id,
        });
      }
    }
    if (data.kind === "catalog.service" && !data.serviceId && !data.comingSoon) {
      issues.push({
        id: `unbound-${node.id}`,
        severity: "warning",
        messageKey: "designer.validation.unboundCatalog",
        messageParams: { label: data.label },
        nodeId: node.id,
      });
    }
    if (data.kind === "group.frame" && !data.serviceId && !data.comingSoon && data.serviceType) {
      issues.push({
        id: `unbound-group-${node.id}`,
        severity: "warning",
        messageKey: "designer.validation.unboundCatalog",
        messageParams: { label: data.label },
        nodeId: node.id,
      });
    }
  }

  for (const edge of input.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push({
        id: `broken-edge-${edge.id}`,
        severity: "error",
        messageKey: "designer.validation.brokenEdge",
      });
    }
  }

  return issues;
}

export type ApplySuggestion = {
  id: string;
  kind: "create-instance" | "open-instance" | "open-vips" | "guidance";
  label: string;
  href?: string;
  messageKey: string;
  messageParams?: Record<string, string>;
};

export function buildApplySuggestions(
  nodes: DesignerNode[],
  instances: Instance[],
): ApplySuggestion[] {
  const suggestions: ApplySuggestion[] = [];
  const instanceById = new Map(instances.map((i) => [i.id, i]));
  const opened = new Set<string>();
  const errorPagesOpened = new Set<string>();

  for (const node of nodes) {
    const data = node.data;
    if (data.comingSoon) continue;

    if (
      data.kind === "catalog.component" &&
      data.componentRole === "error-page" &&
      data.serviceId &&
      !errorPagesOpened.has(data.serviceId)
    ) {
      errorPagesOpened.add(data.serviceId);
      suggestions.push({
        id: `errors-${data.serviceId}`,
        kind: "open-instance",
        label: data.label,
        href: `/instances/${data.serviceId}/haproxy?tab=errors`,
        messageKey: "designer.applySteps.openErrorPages",
        messageParams: { label: data.label },
      });
    }

    if (data.kind === "catalog.component") continue;

    if (
      (data.kind === "catalog.service" || data.kind === "group.frame") &&
      data.serviceType &&
      !data.serviceId
    ) {
      suggestions.push({
        id: `create-${node.id}`,
        kind: "create-instance",
        label: data.label,
        href: `/instances/new?type=${encodeURIComponent(data.serviceType)}`,
        messageKey: "designer.applySteps.createInstance",
        messageParams: { label: data.label, type: data.serviceType },
      });
      continue;
    }

    const serviceId = data.serviceId;
    if (serviceId && !opened.has(serviceId)) {
      opened.add(serviceId);
      const inst = instanceById.get(serviceId);
      const serviceType = data.serviceType ?? inst?.service_type;
      if (serviceType) {
        const known = ["haproxy", "frr", "keycloak-mgmt", "keycloak-apps", "auth-gateway"];
        suggestions.push({
          id: `open-${serviceId}`,
          kind: "open-instance",
          label: data.label,
          href: known.includes(serviceType)
            ? `/instances/${serviceId}/${serviceType}`
            : "/instances",
          messageKey: "designer.applySteps.openInstance",
          messageParams: { label: data.label },
        });
      }
    }

    if (data.kind === "vip.ref") {
      suggestions.push({
        id: `vip-${node.id}`,
        kind: "open-vips",
        label: data.label,
        href: "/vips",
        messageKey: "designer.applySteps.openVips",
        messageParams: { label: data.label },
      });
    }
  }

  const types = new Set(
    nodes.map((n) => n.data.serviceType).filter((t): t is string => Boolean(t)),
  );
  if (types.has("haproxy") && types.has("auth-gateway")) {
    suggestions.push({
      id: "guidance-ag-hap",
      kind: "guidance",
      label: "HAProxy ↔ Auth Gateway",
      messageKey: "designer.applySteps.guidanceAuthGateway",
    });
  }

  return suggestions;
}
