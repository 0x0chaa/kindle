"use client";

import { useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";


export function Loader({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const num = useRef<HTMLSpanElement>(null);
  const [gone, setGone] = useState(false);

  useGSAP(
    () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let seen = false;
      try {
        seen = sessionStorage.getItem("kindle:seen") === "1";
        sessionStorage.setItem("kindle:seen", "1");
      } catch {}
      const dur = reduce ? 0.2 : seen ? 0.9 : 2.1;
      const counter = { v: 0 };

      const tl = gsap.timeline({ onComplete: () => setGone(true) });
      tl.from(".ld-flame", { scale: 0.6, opacity: 0, duration: 1, ease: "expo.out" }, 0)
        .to(
          counter,
          {
            v: 100,
            duration: dur,
            ease: "power2.inOut",
            onUpdate: () => {
              if (num.current) num.current.textContent = String(Math.round(counter.v)).padStart(3, "0");
            },
          },
          0,
        )
        .to(".ld-bar", { scaleX: 1, duration: dur, ease: "power2.inOut" }, 0)
        .to(".ld-flame", { scale: 1.15, opacity: 0, duration: 0.5, ease: "expo.in" }, ">-0.05")
        .add(onDone, ">-0.25")
        .to(root.current, { clipPath: "inset(0% 0% 100% 0%)", duration: 1.1, ease: "expo.inOut" }, "<");
    },
    { scope: root },
  );

  if (gone) return null;

  return (
    <div
      ref={root}
      className="fixed inset-0 z-[100] flex flex-col justify-between bg-black px-[5vw] py-8 text-white"
      style={{ clipPath: "inset(0% 0% 0% 0%)" }}
      role="status"
      aria-label="Loading"
    >
      <div />
      <div className="relative flex justify-center">
        <svg className="kf ld-flame" viewBox="0 0 100 120" aria-hidden="true">
          <defs>
            <radialGradient id="kf-halo" cx="50%" cy="58%" r="50%">
              <stop offset="0" stopColor="#ccff00" stopOpacity=".7"/>
              <stop offset=".45" stopColor="#ccff00" stopOpacity=".2"/>
              <stop offset="1" stopColor="#ccff00" stopOpacity="0"/>
            </radialGradient>
            <linearGradient id="kf-body" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#f7ffd6"/>
              <stop offset=".35" stopColor="#ccff00"/>
              <stop offset="1" stopColor="#6fae00"/>
            </linearGradient>
            <linearGradient id="kf-core" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#101400"/>
              <stop offset="1" stopColor="#000"/>
            </linearGradient>
            <linearGradient id="kf-back" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#b8f000"/>
              <stop offset="1" stopColor="#3f7f00"/>
            </linearGradient>
            <filter id="kf-blur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="7"/></filter>
            <filter id="kf-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.2"/></filter>
          </defs>
          <ellipse className="kf-halo" cx="50" cy="66" rx="58" ry="56" fill="url(#kf-halo)"/>
          <ellipse cx="50" cy="104" rx="26" ry="3.2" fill="#ccff00" opacity=".22" filter="url(#kf-soft)"/>
          <g transform="translate(0 8)">
            <g transform="translate(50 52) scale(1.16) translate(-50 -48)" opacity=".9">
              <path fill="url(#kf-back)" d="M46 2C40 24 22 34 22 60c0 19 12 32 28 32s30-13 30-32c0-14-7-22-13-28-2 10-7 14-11 14C58 30 56 14 46 2Z">
                <animate attributeName="d" dur="1.6s" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1" values="M46 2C40 24 22 34 22 60c0 19 12 32 28 32s30-13 30-32c0-14-7-22-13-28-2 10-7 14-11 14C58 30 56 14 46 2Z;M42 0C38 22 22 35 22 60c0 19 12 32 28 32s30-13 30-32c0-14-8-21-14-27-2 9-6 13-10 13C56 28 52 12 42 0Z;M50 5C43 26 22 36 22 60c0 19 12 32 28 32s30-13 30-32c0-14-7-23-12-29-2 10-8 15-12 15C60 32 59 17 50 5Z;M46 2C40 24 22 34 22 60c0 19 12 32 28 32s30-13 30-32c0-14-7-22-13-28-2 10-7 14-11 14C58 30 56 14 46 2Z"/>
              </path>
            </g>
            <path fill="#ccff00" opacity=".75" filter="url(#kf-blur)" d="M52 4C58 26 80 36 80 62c0 19-14 32-30 32S20 81 20 62c0-14 8-22 14-28 2 10 8 14 12 14C42 30 44 16 52 4Z">
              <animate attributeName="d" dur="1.2s" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1" values="M52 4C58 26 80 36 80 62c0 19-14 32-30 32S20 81 20 62c0-14 8-22 14-28 2 10 8 14 12 14C42 30 44 16 52 4Z;M47 1C56 24 80 37 80 62c0 19-14 32-30 32S20 81 20 62c0-14 9-21 15-27 2 9 7 13 11 13C40 30 39 15 47 1Z;M57 6C61 28 80 38 80 62c0 19-14 32-30 32S20 81 20 62c0-14 8-23 13-29 2 10 9 15 14 15C44 32 48 18 57 6Z;M52 4C58 26 80 36 80 62c0 19-14 32-30 32S20 81 20 62c0-14 8-22 14-28 2 10 8 14 12 14C42 30 44 16 52 4Z"/>
            </path>
            <path fill="url(#kf-body)" d="M52 4C58 26 80 36 80 62c0 19-14 32-30 32S20 81 20 62c0-14 8-22 14-28 2 10 8 14 12 14C42 30 44 16 52 4Z">
              <animate attributeName="d" dur="1.2s" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1" values="M52 4C58 26 80 36 80 62c0 19-14 32-30 32S20 81 20 62c0-14 8-22 14-28 2 10 8 14 12 14C42 30 44 16 52 4Z;M47 1C56 24 80 37 80 62c0 19-14 32-30 32S20 81 20 62c0-14 9-21 15-27 2 9 7 13 11 13C40 30 39 15 47 1Z;M57 6C61 28 80 38 80 62c0 19-14 32-30 32S20 81 20 62c0-14 8-23 13-29 2 10 9 15 14 15C44 32 48 18 57 6Z;M52 4C58 26 80 36 80 62c0 19-14 32-30 32S20 81 20 62c0-14 8-22 14-28 2 10 8 14 12 14C42 30 44 16 52 4Z"/>
            </path>
            <ellipse cx="38" cy="56" rx="4.5" ry="10" fill="#fff" opacity=".35" transform="rotate(-18 38 56)" filter="url(#kf-soft)"/>
            <path fill="url(#kf-core)" stroke="#e2ff80" strokeOpacity=".5" strokeWidth=".8" d="M50 92c-9 0-15-7-15-15 0-9 8-13 11-20 4 6 4 10 3 14 5-1 9-6 10-11 4 5 6 9 6 17 0 8-6 15-15 15Z">
              <animate attributeName="d" dur="0.9s" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" values="M50 92c-9 0-15-7-15-15 0-9 8-13 11-20 4 6 4 10 3 14 5-1 9-6 10-11 4 5 6 9 6 17 0 8-6 15-15 15Z;M50 92c-9 0-15-7-15-15 0-9 7-14 10-22 4 7 5 11 4 15 5-2 9-7 11-13 4 6 5 10 5 20 0 8-6 15-15 15Z;M50 92c-9 0-15-7-15-15 0-9 8-13 11-20 4 6 4 10 3 14 5-1 9-6 10-11 4 5 6 9 6 17 0 8-6 15-15 15Z"/>
            </path>
          </g>
          <g className="kf-embers" fill="#ccff00">
            <circle cx="40" cy="40" r="1.3"/><circle cx="58" cy="34" r="1"/><circle cx="50" cy="24" r="1.2"/>
            <circle cx="64" cy="48" r=".9"/><circle cx="34" cy="52" r="1"/><circle cx="54" cy="16" r=".8"/>
            <circle cx="45" cy="30" r=".9"/><circle cx="61" cy="22" r="1.1"/>
          </g>
        </svg>
      </div>
      <div className="relative">
        <div className="mb-3 flex justify-end">
          <span ref={num} className="font-mono text-sm tabular-nums text-[#ccff00]/80">
            000
          </span>
        </div>
        <div className="h-px w-full bg-white/10">
          <div className="ld-bar h-full origin-left scale-x-0 bg-[#ccff00] shadow-[0_0_12px_#ccff00]" />
        </div>
      </div>
    </div>
  );
}
