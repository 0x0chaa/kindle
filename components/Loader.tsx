"use client";

import { useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { KindleFlame } from "./KindleFlame";


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
        <KindleFlame id="kf-loader" className="ld-flame" />
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
