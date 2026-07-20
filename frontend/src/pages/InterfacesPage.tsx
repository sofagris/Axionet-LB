import { useRescanInterfaces, useInterfaces } from "../features/interfaces/hooks";
import type { PhysicalInterface } from "../types/interfaces";

function linkTone(state: string): string {
  if (state === "up") return "text-ok";
  if (state === "down") return "text-danger";
  return "text-ink-muted";
}

function formatSpeed(mbps: number | null): string {
  if (mbps == null) return "—";
  if (mbps >= 1000) return `${mbps / 1000} Gbps`;
  return `${mbps} Mbps`;
}

function InterfaceRow({ iface }: { iface: PhysicalInterface }) {
  return (
    <tr className="border-t border-line align-top">
      <td className="py-3 pr-4 font-medium text-ink">{iface.name}</td>
      <td className={`py-3 pr-4 font-mono text-sm uppercase ${linkTone(iface.link_state)}`}>
        {iface.link_state}
      </td>
      <td className="py-3 pr-4 font-mono text-sm text-ink-muted">{iface.mac_address ?? "—"}</td>
      <td className="py-3 pr-4 font-mono text-sm text-ink-muted">{iface.driver ?? "—"}</td>
      <td className="py-3 pr-4 font-mono text-sm text-ink-muted">{iface.pci_address ?? "—"}</td>
      <td className="py-3 pr-4 font-mono text-sm text-ink-muted">
        {iface.numa_node == null ? "—" : iface.numa_node}
      </td>
      <td className="py-3 pr-4 font-mono text-sm text-ink-muted">{formatSpeed(iface.speed_mbps)}</td>
      <td className="py-3 font-mono text-sm text-ink-muted">{iface.mtu ?? "—"}</td>
    </tr>
  );
}

export function InterfacesPage() {
  const interfacesQuery = useInterfaces();
  const rescan = useRescanInterfaces();

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink">Physical interfaces</h2>
          <p className="mt-1 max-w-2xl text-ink-muted">
            Oppdagede NIC-er fra vertens sysfs. Virtuelle Docker-/bridge-interface filtreres bort.
          </p>
        </div>
        <button
          type="button"
          onClick={() => rescan.mutate()}
          disabled={rescan.isPending}
          className="border border-accent bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {rescan.isPending ? "Scanner…" : "Rescan"}
        </button>
      </section>

      {rescan.isSuccess ? (
        <p className="font-mono text-xs text-ink-muted">
          Siste scan: discovered={rescan.data.discovered} created={rescan.data.created} updated=
          {rescan.data.updated} removed={rescan.data.removed}
        </p>
      ) : null}

      {rescan.isError ? (
        <p className="text-danger">
          Rescan feilet: {rescan.error instanceof Error ? rescan.error.message : "ukjent feil"}
        </p>
      ) : null}

      {interfacesQuery.isLoading ? <p className="text-ink-muted">Henter interfaces…</p> : null}

      {interfacesQuery.isError ? (
        <p className="text-danger">
          Kunne ikke hente interfaces:{" "}
          {interfacesQuery.error instanceof Error ? interfacesQuery.error.message : "ukjent feil"}
        </p>
      ) : null}

      {interfacesQuery.data ? (
        <div className="overflow-x-auto rounded-lg border border-line bg-paper-elevated p-4 shadow-sm">
          {interfacesQuery.data.length === 0 ? (
            <p className="text-ink-muted">Ingen fysiske interface funnet. Kjør rescan.</p>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="text-xs tracking-wide text-ink-muted uppercase">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Link</th>
                  <th className="pb-2 pr-4 font-medium">MAC</th>
                  <th className="pb-2 pr-4 font-medium">Driver</th>
                  <th className="pb-2 pr-4 font-medium">PCI</th>
                  <th className="pb-2 pr-4 font-medium">NUMA</th>
                  <th className="pb-2 pr-4 font-medium">Speed</th>
                  <th className="pb-2 font-medium">MTU</th>
                </tr>
              </thead>
              <tbody>
                {interfacesQuery.data.map((iface) => (
                  <InterfaceRow key={iface.id} iface={iface} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}
