import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  domainBorder,
  domainFill,
  domainText,
  type UiDomain,
} from "../lib/domains";

type Props = {
  domain: UiDomain;
  title: string;
  value: ReactNode;
  hint?: ReactNode;
  to?: string;
  linkLabel?: string;
  icon?: ReactNode;
};

/** Compact summary module — domain identity via border + icon, neutral body. */
export function DomainCard({ domain, title, value, hint, to, linkLabel, icon }: Props) {
  return (
    <div
      className={[
        "border-l-2 bg-paper-elevated/50 px-4 py-3",
        domainBorder[domain],
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={[
            "flex items-center gap-1.5 text-xs tracking-wide uppercase",
            domainText[domain],
          ].join(" ")}
        >
          {icon ? (
            <span className={["inline-flex opacity-90", domainText[domain]].join(" ")}>{icon}</span>
          ) : null}
          {title}
        </p>
        <span className={["mt-1.5 size-1.5 shrink-0 rounded-full", domainFill[domain]].join(" ")} />
      </div>
      <div className="mt-2 font-mono text-lg text-ink">{value}</div>
      {hint ? <p className="mt-1 font-mono text-[11px] text-ink-muted">{hint}</p> : null}
      {to && linkLabel ? (
        <Link
          to={to}
          className={["mt-2 inline-block text-xs hover:underline", domainText[domain]].join(" ")}
        >
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}
