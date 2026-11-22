// The hero's backdrop: Kindle's flame drawn large in fine neon lines, with a soft glow and embers.
// Pure SVG (no image file), static.
const FLAME =
  "M52 4C58 26 80 36 80 62c0 19-14 32-30 32S20 81 20 62c0-14 8-22 14-28 2 10 8 14 12 14C42 30 44 16 52 4Z";
const CORE = "M50 92c-9 0-15-7-15-15 0-9 8-13 11-20 4 6 4 10 3 14 5-1 9-6 10-11 4 5 6 9 6 17 0 8-6 15-15 15Z";

// deterministic "random" embers
const embers = Array.from({ length: 70 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return { x: -30 + r(1) * 160, y: -20 + r(2) * 115, s: 0.15 + r(3) * 0.45, o: 0.25 + r(4) * 0.7 };
});

export function HeroArt() {
  return (
    <svg className="kh-flame" viewBox="-40 -25 180 140" aria-hidden="true">
      <defs>
        <radialGradient id="kh-halo" cx="50%" cy="55%" r="50%">
          <stop offset="0" stopColor="#ccff00" stopOpacity=".45" />
          <stop offset=".55" stopColor="#ccff00" stopOpacity=".1" />
          <stop offset="1" stopColor="#ccff00" stopOpacity="0" />
        </radialGradient>
        <pattern id="kh-lines" width="100" height="0.9" patternUnits="userSpaceOnUse">
          <rect width="100" height="0.55" fill="#ccff00" />
        </pattern>
        <linearGradient id="kh-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity=".55" />
        </linearGradient>
        <mask id="kh-mask">
          <path d={FLAME} fill="url(#kh-fade)" />
          <path d={CORE} fill="#000" />
        </mask>
        <filter id="kh-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <ellipse cx="50" cy="58" rx="80" ry="72" fill="url(#kh-halo)" />
      <path d={FLAME} fill="#ccff00" opacity=".55" filter="url(#kh-blur)" />
      <rect x="0" y="0" width="100" height="100" fill="url(#kh-lines)" mask="url(#kh-mask)" />
      <path d={CORE} fill="#090a09" opacity=".85" />
      <g fill="#ccff00">
        {embers.map((e, i) => (
          <circle key={i} cx={e.x} cy={e.y} r={e.s} opacity={e.o} />
        ))}
      </g>
    </svg>
  );
}
