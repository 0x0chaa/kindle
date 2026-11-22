"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useApp } from "../Providers";

// Three.js, R3F, drei and postprocessing are code-split and only fetched on the client.
const Experience = dynamic(() => import("./Experience"), { ssr: false, loading: () => null });

export function Stage() {
  const { ready, reduced } = useApp();
  const [mount, setMount] = useState(false);

  useEffect(() => {
    // Start fetching the 3D bundle while the loader is still on screen, at idle priority.
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => setMount(true), { timeout: 800 });
    else setTimeout(() => setMount(true), 200);
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-[1500ms]"
      style={{ opacity: ready ? 1 : 0 }}
    >
      {mount && <Experience reduced={reduced} />}
    </div>
  );
}
