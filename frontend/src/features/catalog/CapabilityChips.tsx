type Props = {
  capabilities: string[];
  limit?: number;
};

export function CapabilityChips({ capabilities, limit = 5 }: Props) {
  const shown = capabilities.slice(0, limit);
  const rest = capabilities.length - shown.length;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {shown.map((cap) => (
        <li
          key={cap}
          className="border border-line bg-paper px-1.5 py-0.5 font-mono text-[10px] text-ink-muted"
        >
          {cap}
        </li>
      ))}
      {rest > 0 ? (
        <li className="px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">+{rest}</li>
      ) : null}
    </ul>
  );
}
