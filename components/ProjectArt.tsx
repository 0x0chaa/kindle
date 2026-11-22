import type { Agent } from "@/lib/content";

/**
 * Generative cover art for each project — pure CSS/SVG so there are no
 * image assets to load. Swap for <Image> once real project media exists.
 */
export function ProjectArt({ project, shift = 0 }: { project: Agent; shift?: number }) {
  const { bg, a, b, c } = project.palette;
  const id = `${project.slug}-${shift}`;

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: bg }} aria-hidden>
      {/* soft light fields */}
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: "70%",
          aspectRatio: "1",
          left: `${10 + shift * 25}%`,
          top: "-20%",
          background: `radial-gradient(circle, ${a} 0%, transparent 65%)`,
          opacity: 0.55,
        }}
      />
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: "55%",
          aspectRatio: "1",
          right: `${-10 + shift * 15}%`,
          bottom: "-25%",
          background: `radial-gradient(circle, ${b} 0%, transparent 65%)`,
          opacity: 0.6,
        }}
      />

      {project.variant === "orb" && (
        <>
          <div
            className="bob absolute left-1/2 top-1/2 w-[38%] max-w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              aspectRatio: "1",
              background: `radial-gradient(circle at 32% 28%, #fff 0%, ${b} 18%, ${a} 48%, #0b0b0b 80%)`,
              boxShadow: `0 60px 120px -30px ${a}, inset -30px -40px 80px rgba(0,0,0,.45), inset 20px 20px 60px rgba(255,255,255,.35)`,
            }}
          />
          <div
            className="spin-slow absolute left-1/2 top-1/2 w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full border"
            style={{ aspectRatio: "1", borderColor: `${c}33` }}
          />
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: `${3 + i}%`,
                aspectRatio: "1",
                left: `${15 + i * 17}%`,
                top: `${20 + ((i * 37) % 60)}%`,
                background: `radial-gradient(circle at 30% 30%, #fff, ${i % 2 ? a : b})`,
                opacity: 0.85,
              }}
            />
          ))}
        </>
      )}

      {project.variant === "waves" && (
        <svg className="absolute inset-0 size-full" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id={`g-${id}`} x1="0" x2="1">
              <stop offset="0" stopColor={b} />
              <stop offset=".35" stopColor="#fff" />
              <stop offset=".55" stopColor={c} />
              <stop offset="1" stopColor={a} />
            </linearGradient>
          </defs>
          {Array.from({ length: 22 }).map((_, i) => {
            const y = 120 + i * 11;
            const amp = 40 + Math.sin(i * 0.6 + shift) * 30;
            return (
              <path
                key={i}
                d={`M -20 ${y} C 160 ${y - amp}, 300 ${y + amp}, 420 ${y} S 680 ${y - amp}, 820 ${y}`}
                fill="none"
                stroke={`url(#g-${id})`}
                strokeWidth={i % 4 === 0 ? 3 : 1.2}
                opacity={0.25 + (i / 22) * 0.75}
              />
            );
          })}
        </svg>
      )}

      {project.variant === "rings" && (
        <svg className="absolute inset-0 size-full" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice">
          {Array.from({ length: 9 }).map((_, i) => (
            <ellipse
              key={i}
              cx={400 + shift * 40}
              cy="225"
              rx={60 + i * 42}
              ry={30 + i * 20}
              fill={i === 0 ? a : "none"}
              stroke={i % 2 ? b : c}
              strokeWidth={i % 3 === 0 ? 2.5 : 1}
              opacity={1 - i * 0.08}
              transform={`rotate(${-12 + i * 3} 400 225)`}
            />
          ))}
          <circle cx={400 + shift * 40} cy="225" r="34" fill={b} />
          <circle cx={392 + shift * 40} cy="215" r="10" fill="#fff" opacity=".8" />
        </svg>
      )}

      {project.variant === "grid" && (
        <>
          <div
            className="absolute inset-x-[-20%] bottom-[-10%] h-[70%]"
            style={{
              transform: "perspective(500px) rotateX(62deg)",
              backgroundImage: `linear-gradient(${a}55 1px, transparent 1px), linear-gradient(90deg, ${a}55 1px, transparent 1px)`,
              backgroundSize: "48px 48px",
              maskImage: "linear-gradient(to top, #000 30%, transparent)",
            }}
          />
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bob absolute rounded-full"
              style={{
                width: `${16 - i * 3}%`,
                aspectRatio: "1",
                left: `${22 + i * 22 + shift * 6}%`,
                top: `${22 + (i % 2) * 14}%`,
                animationDelay: `${i * -1.4}s`,
                background: `radial-gradient(circle at 34% 30%, #fff 0%, ${i === 1 ? b : a} 30%, #0b0b0b 88%)`,
                boxShadow: `0 40px 80px -20px ${i === 1 ? b : a}`,
              }}
            />
          ))}
        </>
      )}

      {/* fine film texture */}
      <div
        className="absolute inset-0 opacity-[0.18] mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,.08) 0 1px, transparent 1px 3px)",
        }}
      />
    </div>
  );
}
