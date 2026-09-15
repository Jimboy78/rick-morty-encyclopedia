export default function PortalLogo({ size = 56 }: { size?: number }) {
  return (
    <svg className="portal-logo" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id="pl-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f4ffd6" />
          <stop offset="35%" stopColor="var(--accent)" />
          <stop offset="75%" stopColor="var(--accent-2)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="url(#pl-core)" />
      <g className="portal-logo__swirl">
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <path
            key={deg}
            d="M50 50 C 62 36, 80 40, 88 52"
            fill="none"
            stroke="#eaffc2"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.85"
            transform={`rotate(${deg} 50 50)`}
          />
        ))}
      </g>
      <circle cx="50" cy="50" r="9" fill="#f7ffe6" />
    </svg>
  );
}
