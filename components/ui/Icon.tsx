// Stroke icons from the Matchday design (24×24, currentColor).

const PATHS = {
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronUp: <path d="m6 15 6-6 6 6" />,
  chart: <path d="M3 20h18M5 20v-6h4v6M10 20V8h4v12M15 20v-9h4v9" />,
  trophy: <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 21h6M10 17h4" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  refresh: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" />,
  share: <path d="M12 3v13M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  warning: <path d="M12 3 2 20h20zM12 10v4M12 17h.01" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 9V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h4" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M5 12v8h14v-8M12 8v12M12 8S10.5 3.5 8 4.5 9 8 12 8zM12 8s1.5-4.5 4-3.5S15 8 12 8z" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  wallet: (
    <>
      <path d="M4 7a2 2 0 0 1 2-2h12v4M4 7v11a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2z" />
      <circle cx="16" cy="14.5" r="1.2" />
    </>
  ),
  same: <path d="M6 12h12" />,
  up: <path d="m6 14 6-6 6 6" />,
  down: <path d="m6 10 6 6 6-6" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size,
  className,
  style,
  strokeWidth,
}: {
  name: IconName;
  size?: "sm" | "lg";
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}) {
  const cls = ["ic", size === "sm" ? "ic-sm" : size === "lg" ? "ic-lg" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <svg className={cls} viewBox="0 0 24 24" aria-hidden="true" style={strokeWidth ? { ...style, strokeWidth } : style}>
      {PATHS[name]}
    </svg>
  );
}

export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="7" fill="#C6F432" />
      <rect x="7" y="15" width="3.4" height="6" rx="1" fill="#0A1440" />
      <rect x="12.3" y="11" width="3.4" height="10" rx="1" fill="#0A1440" />
      <rect x="17.6" y="7" width="3.4" height="14" rx="1" fill="#0A1440" />
    </svg>
  );
}
