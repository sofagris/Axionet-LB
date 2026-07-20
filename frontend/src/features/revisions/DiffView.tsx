export function DiffView({
  text,
  emptyLabel = "Ingen diff",
}: {
  text: string | null | undefined;
  emptyLabel?: string;
}) {
  const content = text?.trim() ? text : emptyLabel;
  const isDiff = Boolean(text?.includes("\n") && (text.includes("\n+") || text.includes("\n-") || text.startsWith("---") || text.startsWith("@@")));

  if (!isDiff) {
    return (
      <pre className="max-h-[28rem] overflow-auto border border-line bg-ink p-4 font-mono text-xs text-paper whitespace-pre-wrap">
        {content}
      </pre>
    );
  }

  return (
    <pre className="max-h-[28rem] overflow-auto border border-line bg-ink p-4 font-mono text-xs whitespace-pre-wrap">
      {content.split("\n").map((line, index) => {
        let className = "text-paper";
        if (line.startsWith("+") && !line.startsWith("+++")) className = "text-ok";
        else if (line.startsWith("-") && !line.startsWith("---")) className = "text-danger";
        else if (line.startsWith("@@")) className = "text-accent";
        else if (line.startsWith("---") || line.startsWith("+++")) className = "text-ink-muted";
        return (
          <span key={index} className={`block ${className}`}>
            {line || " "}
          </span>
        );
      })}
    </pre>
  );
}
