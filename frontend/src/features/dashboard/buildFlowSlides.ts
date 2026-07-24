import type { Instance } from "../../types/instances";
import type { Vip } from "../../types/vips";
import type { LbInstanceMetrics, LbMetrics } from "../../types/system";

export type FlowSlideKind = "fleet" | "vip";

export type FlowSlide = {
  id: string;
  kind: FlowSlideKind;
  /** Display title for carousel */
  title: string;
  vip?: Vip;
  frr?: Instance;
  haproxy?: Instance;
  lbRow?: LbInstanceMetrics;
};

export function buildFlowSlides(input: {
  vips: Vip[];
  instances: Instance[];
  lbMetrics: LbMetrics | undefined;
  /** When true, only VIP slides with advertised === true (fleet always kept). */
  advertisedOnly?: boolean;
}): FlowSlide[] {
  const byId = new Map(input.instances.map((item) => [item.id, item]));
  const lbById = new Map((input.lbMetrics?.instances ?? []).map((row) => [row.instance_id, row]));

  const fleet: FlowSlide = {
    id: "fleet",
    kind: "fleet",
    title: "Fleet",
  };

  let vipList = input.vips.slice();
  if (input.advertisedOnly) {
    vipList = vipList.filter((vip) => vip.advertised);
  }

  const vipSlides: FlowSlide[] = vipList
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((vip) => {
      const frr = byId.get(vip.frr_instance_id);
      const haproxy = byId.get(vip.haproxy_instance_id);
      return {
        id: `vip:${vip.id}`,
        kind: "vip" as const,
        title: vip.name,
        vip,
        frr,
        haproxy,
        lbRow: haproxy ? lbById.get(haproxy.id) : undefined,
      };
    });

  return [fleet, ...vipSlides];
}

export function haproxyAttachmentIp(instance: Instance | undefined, networkId?: string): string | null {
  if (!instance?.networks?.length) return null;
  if (networkId) {
    const match = instance.networks.find((n) => n.network_id === networkId);
    if (match?.ip_address) return match.ip_address;
  }
  return instance.networks.find((n) => n.ip_address)?.ip_address ?? null;
}
