import { useMemo, useState, type FormEvent } from "react";
import { useInterfaces } from "../features/interfaces/hooks";
import { useCreateNetwork, useDeleteNetwork, useNetworks } from "../features/networks/hooks";
import type { Network, NetworkType } from "../types/networks";

const NETWORK_TYPES: NetworkType[] = [
  "ipvlan-l2",
  "untagged-access",
  "bridge",
  "management",
  "ipvlan-l3",
  "macvlan",
];

function StatusCell({ network }: { network: Network }) {
  if (network.docker_exists) {
    return <span className="font-mono text-sm text-ok">docker ok</span>;
  }
  return <span className="font-mono text-sm text-warn">missing</span>;
}

export function NetworksPage() {
  const networksQuery = useNetworks();
  const interfacesQuery = useInterfaces();
  const createMutation = useCreateNetwork();
  const deleteMutation = useDeleteNetwork();

  const [name, setName] = useState("");
  const [networkType, setNetworkType] = useState<NetworkType>("ipvlan-l2");
  const [parentId, setParentId] = useState("");
  const [vlanId, setVlanId] = useState("100");
  const [subnet, setSubnet] = useState("10.100.0.0/24");
  const [gateway, setGateway] = useState("10.100.0.1");

  const parents = useMemo(() => interfacesQuery.data ?? [], [interfacesQuery.data]);
  const needsParent = ["ipvlan-l2", "ipvlan-l3", "macvlan", "untagged-access"].includes(networkType);
  const needsVlan = networkType === "ipvlan-l2" || networkType === "ipvlan-l3" || networkType === "macvlan";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await createMutation.mutateAsync({
      name,
      network_type: networkType,
      parent_interface_id: needsParent ? parentId || null : null,
      vlan_id: needsVlan && vlanId.trim() ? Number(vlanId) : null,
      subnet: subnet || null,
      gateway: gateway || null,
      enabled: true,
    });
    setName("");
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold tracking-tight text-ink">Networks / VLAN</h2>
        <p className="mt-1 max-w-2xl text-ink-muted">
          Opprett logiske nettverk. Standard for tjenester er ipvlan-l2 med VLAN på valgt parent-NIC.
        </p>
      </section>

      <form
        onSubmit={onSubmit}
        className="grid gap-4 rounded-lg border border-line bg-paper-elevated p-5 shadow-sm md:grid-cols-2"
      >
        <label className="block text-sm">
          <span className="text-ink-muted">Navn</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
            placeholder="vlan100-prod"
          />
        </label>
        <label className="block text-sm">
          <span className="text-ink-muted">Type</span>
          <select
            value={networkType}
            onChange={(e) => setNetworkType(e.target.value as NetworkType)}
            className="mt-1 w-full border border-line bg-paper px-3 py-2 text-sm"
          >
            {NETWORK_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        {needsParent ? (
          <label className="block text-sm">
            <span className="text-ink-muted">Parent interface</span>
            <select
              required
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
            >
              <option value="">Velg NIC…</option>
              {parents.map((iface) => (
                <option key={iface.id} value={iface.id}>
                  {iface.name} ({iface.link_state})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {needsVlan ? (
          <label className="block text-sm">
            <span className="text-ink-muted">VLAN ID (valgfritt for untagged på parent)</span>
            <input
              value={vlanId}
              onChange={(e) => setVlanId(e.target.value)}
              className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
              placeholder="100"
            />
          </label>
        ) : null}
        <label className="block text-sm">
          <span className="text-ink-muted">Subnet</span>
          <input
            value={subnet}
            onChange={(e) => setSubnet(e.target.value)}
            className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
            placeholder="10.100.0.0/24"
          />
        </label>
        <label className="block text-sm">
          <span className="text-ink-muted">Gateway</span>
          <input
            value={gateway}
            onChange={(e) => setGateway(e.target.value)}
            className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-sm"
            placeholder="10.100.0.1"
          />
        </label>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="border border-accent bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {createMutation.isPending ? "Oppretter…" : "Opprett nettverk"}
          </button>
          {createMutation.isError ? (
            <p className="mt-2 text-sm text-danger">
              {createMutation.error instanceof Error ? createMutation.error.message : "Feil"}
            </p>
          ) : null}
        </div>
      </form>

      {networksQuery.isLoading ? <p className="text-ink-muted">Henter nettverk…</p> : null}
      {networksQuery.isError ? (
        <p className="text-danger">
          {networksQuery.error instanceof Error ? networksQuery.error.message : "Feil"}
        </p>
      ) : null}

      {networksQuery.data ? (
        <div className="overflow-x-auto rounded-lg border border-line bg-paper-elevated p-4 shadow-sm">
          {networksQuery.data.length === 0 ? (
            <p className="text-ink-muted">Ingen nettverk opprettet ennå.</p>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="text-xs tracking-wide text-ink-muted uppercase">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Parent</th>
                  <th className="pb-2 pr-4 font-medium">VLAN</th>
                  <th className="pb-2 pr-4 font-medium">Subnet</th>
                  <th className="pb-2 pr-4 font-medium">Docker</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {networksQuery.data.map((network) => (
                  <tr key={network.id} className="border-t border-line align-top">
                    <td className="py-3 pr-4 font-medium">{network.name}</td>
                    <td className="py-3 pr-4 font-mono text-xs">{network.network_type}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-ink-muted">
                      {network.parent_device ?? "—"}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-ink-muted">
                      {network.vlan_id ?? "—"}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-ink-muted">
                      {network.subnet ?? "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusCell network={network} />
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        className="text-sm text-danger hover:underline"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(network.id)}
                      >
                        Slett
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}
