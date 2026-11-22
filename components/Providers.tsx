"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { MotionConfig, useAnimate } from "motion/react";
import { Loader } from "./Loader";
import { EASE_QUART } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type AppContext = {
  ready: boolean;
  reduced: boolean;
  lenis: Lenis | null;
  navigate: (href: string) => void;
  scrollTo: (target: string | number) => void;
};

const Ctx = createContext<AppContext>({
  ready: false,
  reduced: false,
  lenis: null,
  navigate: () => {},
  scrollTo: () => {},
});

export const useApp = () => useContext(Ctx);

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const [curtain, animate] = useAnimate<HTMLDivElement>();
  const pendingHash = useRef<string | null>(null);
  const busy = useRef(false);
  const prevPath = useRef(pathname);

  /* prefers-reduced-motion */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  /* Smooth scrolling (Lenis driven by the GSAP ticker so ScrollTrigger stays in sync) */
  useEffect(() => {
    if (reduced) return;
    const l = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.3,
    });
    lenisRef.current = l;
    setLenis(l);
    l.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => l.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      l.destroy();
      lenisRef.current = null;
      setLenis(null);
    };
  }, [reduced]);

  /* Lock scroll while the intro loader runs */
  useEffect(() => {
    const root = document.documentElement;
    if (!ready) {
      lenisRef.current?.stop();
      root.classList.add("is-loading");
    } else {
      lenisRef.current?.start();
      root.classList.remove("is-loading");
      ScrollTrigger.refresh();
    }
  }, [ready, lenis]);

  /* Section tone → html[data-mode] (drives the animated dark/light background) */
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-tone]"));
    if (els[0]) document.documentElement.dataset.mode = els[0].dataset.tone;
    const triggers = els.map((el) =>
      ScrollTrigger.create({
        trigger: el,
        start: "top 55%",
        end: "bottom 55%",
        onToggle: (self) => {
          if (self.isActive) document.documentElement.dataset.mode = el.dataset.tone;
        },
      }),
    );
    return () => triggers.forEach((t) => t.kill());
  }, [pathname, ready]);

  const scrollTo = useCallback((target: string | number) => {
    const l = lenisRef.current;
    if (l) {
      l.scrollTo(target, { duration: 1.6 });
      return;
    }
    if (typeof target === "number") window.scrollTo({ top: target });
    else document.querySelector(target)?.scrollIntoView();
  }, []);

  /* Page transitions: cover with the curtain, route, then reveal */
  const navigate = useCallback(
    async (href: string) => {
      const [rawPath, hash] = href.split("#");
      const path = rawPath || pathname;
      if (path === pathname) {
        scrollTo(hash ? `#${hash}` : 0);
        return;
      }
      // same page, different query (e.g. a filter): no curtain needed
      if (path.split("?")[0] === pathname) {
        router.push(path, { scroll: false });
        return;
      }
      if (busy.current) return;
      busy.current = true;
      pendingHash.current = hash ? `#${hash}` : null;
      if (!reduced && curtain.current) {
        await animate(
          curtain.current,
          { clipPath: ["inset(100% 0% 0% 0%)", "inset(0% 0% 0% 0%)"] },
          { duration: 0.75, ease: EASE_QUART },
        );
      }
      router.push(path, { scroll: false });
    },
    [pathname, reduced, router, scrollTo, animate, curtain],
  );

  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    const hash = pendingHash.current;
    pendingHash.current = null;
    lenisRef.current?.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      if (hash) {
        const el = document.querySelector<HTMLElement>(hash);
        if (el) {
          if (lenisRef.current) lenisRef.current.scrollTo(el, { immediate: true, force: true });
          else el.scrollIntoView();
        }
      }
    });
    if (reduced || !curtain.current) {
      busy.current = false;
      return;
    }
    animate(
      curtain.current,
      { clipPath: ["inset(0% 0% 0% 0%)", "inset(0% 0% 100% 0%)"] },
      { duration: 0.85, delay: 0.25, ease: EASE_QUART },
    ).then(() => {
      busy.current = false;
    });
  }, [pathname, reduced, animate, curtain]);

  return (
    <Ctx.Provider value={{ ready, reduced, lenis, navigate, scrollTo }}>
      <MotionConfig reducedMotion="user">
        {children}
        <Loader onDone={() => setReady(true)} />
        <div
          ref={curtain}
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[90] grid place-items-center bg-ink text-paper"
          style={{ clipPath: "inset(100% 0% 0% 0%)" }}
        >
          <div className="aura" />
          <span className="display relative text-[clamp(3rem,10vw,9rem)]">
            Kindle
          </span>
        </div>
      </MotionConfig>
    </Ctx.Provider>
  );
}
