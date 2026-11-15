/** Brendbukdakı korporativ naxış elementlərinə (qövslər və xətlər) əsaslanan dekorativ fon */
export function BrandPattern({ className = "", opacity = 0.18 }: { className?: string; opacity?: number }) {
  return (
    <svg className={className} viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeOpacity={opacity}>
        <path d="M0 80 H140 A60 60 0 0 1 200 140 V400" />
        <path d="M0 120 H120 A40 40 0 0 1 160 160 V400" />
        <circle cx="330" cy="70" r="46" />
        <path d="M284 70 A46 46 0 0 0 376 70" />
        <path d="M250 0 V40 A40 40 0 0 0 290 80 H600" />
        <path d="M420 400 V300 A60 60 0 0 1 480 240 H600" />
        <path d="M460 400 V320 A40 40 0 0 1 500 280 H600" />
        <circle cx="520" cy="140" r="30" />
        <path d="M200 260 H300 A50 50 0 0 0 350 210 V160" />
        <path d="M560 0 V60 A40 40 0 0 1 520 100" />
        <path d="M60 400 A60 60 0 0 1 120 340 H160" />
        <path d="M330 400 V350 A30 30 0 0 1 360 320 H400" />
      </g>
    </svg>
  );
}
