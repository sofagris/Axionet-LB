import type { Instance } from "../../types/instances";
import type { Vip } from "../../types/vips";
import {
  DESIGNER_CROSS_GUIDANCE,
  designerManifestByServiceType,
  expandDesignerPathTemplate,
} from "../catalog/designerManifests";
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
    if (data.kind === "placement.lane" || data.kind === "visual.annotation") continue;
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
  const componentExtraOpened = new Set<string>();

  for (const node of nodes) {
    const data = node.data;
    if (data.comingSoon) continue;
    if (data.kind === "visual.annotation" || data.kind === "placement.lane") continue;

    const serviceType = data.serviceType;
    const manifest = serviceType ? designerManifestByServiceType(serviceType) : undefined;

    if (
      data.kind === "catalog.component" &&
      data.componentRole &&
      data.serviceId &&
      serviceType &&
      manifest?.applySteps?.componentExtras
    ) {
      for (const extra of manifest.applySteps.componentExtras) {
        if (extra.whenRole !== data.componentRole) continue;
        const key = `${extra.whenRole}:${data.serviceId}`;
        if (componentExtraOpened.has(key)) continue;
        componentExtraOpened.add(key);
        suggestions.push({
          id: `extra-${key}`,
          kind: "open-instance",
          label: data.label,
          href: expandDesignerPathTemplate(extra.hrefTemplate, {
            serviceId: data.serviceId,
            serviceType,
          }),
          messageKey: extra.messageKey,
          messageParams: { label: data.label },
        });
      }
    }

    if (data.kind === "catalog.component") continue;

    if (
      (data.kind === "catalog.service" || data.kind === "group.frame") &&
      serviceType &&
      !data.serviceId
    ) {
      const create =
        manifest?.applySteps?.createUnbound ?? {
          hrefTemplate: "/instances/new?type={serviceType}",
          messageKey: "designer.applySteps.createInstance",
        };
      suggestions.push({
        id: `create-${node.id}`,
        kind: "create-instance",
        label: data.label,
        href: expandDesignerPathTemplate(create.hrefTemplate, { serviceType }),
        messageKey: create.messageKey,
        messageParams: { label: data.label, type: serviceType },
      });
      continue;
    }

    const serviceId = data.serviceId;
    if (serviceId && !opened.has(serviceId)) {
      opened.add(serviceId);
      const inst = instanceById.get(serviceId);
      const resolvedType = serviceType ?? inst?.service_type;
      if (resolvedType) {
        const open =
          designerManifestByServiceType(resolvedType)?.applySteps?.openBound ?? {
            hrefTemplate: "/instances/{serviceId}/{serviceType}",
            messageKey: "designer.applySteps.openInstance",
          };
        suggestions.push({
          id: `open-${serviceId}`,
          kind: "open-instance",
          label: data.label,
          href: designerManifestByServiceType(resolvedType)
            ? expandDesignerPathTemplate(open.hrefTemplate, {
                serviceId,
                serviceType: resolvedType,
              })
            : "/instances",
          messageKey: open.messageKey,
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
  for (const rule of DESIGNER_CROSS_GUIDANCE) {
    if (rule.whenAll.every((t) => types.has(t))) {
      suggestions.push({
        id: rule.id,
        kind: "guidance",
        label: rule.label,
        messageKey: rule.messageKey,
      });
    }
  }

  return suggestions;
}
