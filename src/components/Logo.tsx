export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Polify"
      className="logo"
    >
      <defs>
        <clipPath id="polify-logo-clip">
          <rect x="0" y="0" width="64" height="64" rx="13" ry="13" />
        </clipPath>
      </defs>
      <g clipPath="url(#polify-logo-clip)">
        <rect x="0" y="0" width="64" height="32" fill="#ffffff" />
        <rect x="0" y="32" width="64" height="32" fill="#d4213d" />
      </g>
      <rect
        x="0.5"
        y="0.5"
        width="63"
        height="63"
        rx="12.5"
        ry="12.5"
        fill="none"
        stroke="#d6cfc1"
        strokeWidth="1"
      />
      <text
        x="32"
        y="46"
        textAnchor="middle"
        fontFamily="'Iowan Old Style', 'Charter', 'Georgia', serif"
        fontSize="42"
        fontWeight="700"
        fill="#2b2a26"
      >
        P
      </text>
    </svg>
  );
}
