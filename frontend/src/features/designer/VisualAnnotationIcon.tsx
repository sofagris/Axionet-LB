import type { SVGProps } from "react";
import type { VisualAnnotationId } from "./types";

type Props = {
  visualId: VisualAnnotationId;
  size?: "sm" | "md";
  className?: string;
};

function iconBase(size: "sm" | "md", props: SVGProps<SVGSVGElement>) {
  const px = size === "sm" ? 36 : 40;
  return {
    width: px,
    height: px,
    viewBox: "0 0 96 96",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true as const,
    ...props,
  };
}

function InternetCloudIcon(props: SVGProps<SVGSVGElement> & { size: "sm" | "md" }) {
  const { size, ...rest } = props;
  return (
    <svg {...iconBase(size, rest)}>
      <path
        d="M28 62h42c8 0 14-6 14-13s-6-13-14-13c-1.2 0-2.3.1-3.4.4C64 28 56 22 46 22c-12 0-22 9-23.7 20.5C16 44 12 49 12 56c0 6.6 5.4 12 12 12h4"
        stroke="var(--icon-primary, #35D0C2)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="var(--icon-primary-fill, #DDF8F5)"
      />
      <path
        d="M36 70c4 6 10 10 16 10s12-4 16-10"
        stroke="var(--icon-secondary, #7586FF)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UserIcon(props: SVGProps<SVGSVGElement> & { size: "sm" | "md" }) {
  const { size, ...rest } = props;
  return (
    <svg {...iconBase(size, rest)}>
      <circle
        cx="48"
        cy="34"
        r="14"
        stroke="var(--icon-primary, #35D0C2)"
        strokeWidth="4"
        fill="var(--icon-primary-fill, #DDF8F5)"
      />
      <path
        d="M22 74c4-14 14-22 26-22s22 8 26 22"
        stroke="var(--icon-secondary, #7586FF)"
        strokeWidth="4"
        strokeLinecap="round"
        fill="var(--icon-secondary-fill, #E7EAFF)"
      />
    </svg>
  );
}

function GroupIcon(props: SVGProps<SVGSVGElement> & { size: "sm" | "md" }) {
  const { size, ...rest } = props;
  return (
    <svg {...iconBase(size, rest)}>
      <circle
        cx="34"
        cy="32"
        r="10"
        stroke="var(--icon-primary, #35D0C2)"
        strokeWidth="3.5"
        fill="var(--icon-primary-fill, #DDF8F5)"
      />
      <circle
        cx="62"
        cy="32"
        r="10"
        stroke="var(--icon-secondary, #7586FF)"
        strokeWidth="3.5"
        fill="var(--icon-secondary-fill, #E7EAFF)"
      />
      <path
        d="M18 72c3-11 10-17 16-17s13 6 16 17"
        stroke="var(--icon-primary, #35D0C2)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M46 72c3-11 10-17 16-17s13 6 16 17"
        stroke="var(--icon-secondary, #7586FF)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClientIcon(props: SVGProps<SVGSVGElement> & { size: "sm" | "md" }) {
  const { size, ...rest } = props;
  return (
    <svg {...iconBase(size, rest)}>
      <rect
        x="18"
        y="22"
        width="60"
        height="40"
        rx="6"
        stroke="var(--icon-primary, #35D0C2)"
        strokeWidth="4"
        fill="var(--icon-primary-fill, #DDF8F5)"
      />
      <path
        d="M34 74h28M48 62v12"
        stroke="var(--icon-secondary, #7586FF)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M28 36h40M28 46h28"
        stroke="var(--icon-muted, #8292A6)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function VisualAnnotationIcon({ visualId, size = "sm", className }: Props) {
  const common = { size, className };
  switch (visualId) {
    case "internet-cloud":
      return <InternetCloudIcon {...common} />;
    case "user":
      return <UserIcon {...common} />;
    case "group":
      return <GroupIcon {...common} />;
    case "client":
      return <ClientIcon {...common} />;
    default:
      return null;
  }
}
