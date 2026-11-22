"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Float,
  Lightformer,
  MeshTransmissionMaterial,
  PerformanceMonitor,
  RoundedBox,
} from "@react-three/drei";
import { Bloom, ChromaticAberration, EffectComposer } from "@react-three/postprocessing";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { sceneState } from "@/lib/scene-state";

/* ------------------------------------------------------------------ */
/* Scroll choreography: one pose per [data-scene] section.            */
/* x / y are fractions of the visible half-width / half-height.        */
/* ------------------------------------------------------------------ */
type Pose = { x: number; y: number; s: number; ry: number; rx: number; cz: number; blob: number; float: number };
type SceneKey = "hero" | "about" | "services" | "work" | "process" | "contact";
const KEYS = ["x", "y", "s", "ry", "rx", "cz", "blob", "float"] as const;

const DESKTOP: Record<SceneKey, Pose> = {
  hero: { x: 0.42, y: 0.02, s: 1, ry: -0.35, rx: 0.02, cz: 6, blob: 0, float: 1 },
  about: { x: -0.58, y: -0.12, s: 0.82, ry: 0.75, rx: 0.06, cz: 6.6, blob: 0, float: 0 },
  services: { x: 0.7, y: 0.5, s: 0.42, ry: -0.9, rx: 0.12, cz: 6, blob: 0, float: 0 },
  work: { x: 0.95, y: -1.3, s: 0.3, ry: -1.4, rx: 0, cz: 6, blob: 0, float: 0 },
  process: { x: 0.08, y: -0.08, s: 0.95, ry: Math.PI * 2 - 0.35, rx: 0.04, cz: 5.6, blob: 0, float: 0 },
  contact: { x: 0.78, y: 0.55, s: 0.34, ry: Math.PI * 2 - 0.8, rx: 0.1, cz: 6.2, blob: 1, float: 0 },
};
const MOBILE: Record<SceneKey, Pose> = {
  hero: { x: 0, y: 0.32, s: 0.62, ry: -0.2, rx: 0.02, cz: 6, blob: 0, float: 1 },
  about: { x: 0.55, y: 0.62, s: 0.36, ry: -0.6, rx: 0.06, cz: 6.4, blob: 0, float: 0 },
  services: { x: -0.6, y: 0.7, s: 0.3, ry: 0.8, rx: 0.1, cz: 6, blob: 0, float: 0 },
  work: { x: 0.9, y: -1.4, s: 0.25, ry: -1.4, rx: 0, cz: 6, blob: 0, float: 0 },
  process: { x: 0.45, y: 0.6, s: 0.4, ry: Math.PI * 2 - 0.4, rx: 0.04, cz: 6, blob: 0, float: 0 },
  contact: { x: 0.6, y: 0.72, s: 0.26, ry: Math.PI * 2 - 0.8, rx: 0.1, cz: 6.2, blob: 1, float: 0 },
};

function Director({
  mascot,
  floaters,
  mobile,
  reduced,
}: {
  mascot: RefObject<THREE.Group>;
  floaters: RefObject<THREE.Group>;
  mobile: boolean;
  reduced: boolean;
}) {
  const { camera, invalidate } = useThree();
  const sections = useRef<HTMLElement[]>([]);
  const cur = useRef<Pose>({ ...(mobile ? MOBILE : DESKTOP).hero });

  useEffect(() => {
    const collect = () => {
      sections.current = Array.from(document.querySelectorAll<HTMLElement>("[data-scene]"));
    };
    collect();
    const t = setTimeout(collect, 500);
    window.addEventListener("resize", collect);
    // in reduced-motion mode we render on demand: redraw on scroll only
    const onScroll = () => invalidate();
    if (reduced) window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", collect);
      window.removeEventListener("scroll", onScroll);
    };
  }, [reduced, invalidate]);

  useFrame((state, dt) => {
    const vh = window.innerHeight;
    const table = mobile ? MOBILE : DESKTOP;
    const target: Pose = { x: 0, y: 0, s: 0, ry: 0, rx: 0, cz: 0, blob: 0, float: 0 };
    let total = 0;
    for (const el of sections.current) {
      const r = el.getBoundingClientRect();
      const cover = (Math.min(r.bottom, vh) - Math.max(r.top, 0)) / vh;
      if (cover <= 0) continue;
      const pose = table[el.dataset.scene as SceneKey];
      if (!pose) continue;
      const w = cover * cover;
      total += w;
      for (const k of KEYS) target[k] += pose[k] * w;
    }
    const c = cur.current;
    const k = reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 3);
    for (const key of KEYS) {
      const goal = total > 0 ? target[key] / total : c[key];
      c[key] += (goal - c[key]) * k;
    }

    const cam = camera as THREE.PerspectiveCamera;
    const mouse = sceneState.mouse;
    cam.position.z = c.cz;
    cam.position.x += (mouse.x * 0.35 - cam.position.x) * k;
    cam.position.y += (mouse.y * 0.22 - cam.position.y) * k;
    cam.lookAt(0, 0, 0);

    const halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * c.cz;
    const halfW = halfH * cam.aspect;

    const g = mascot.current;
    g.position.set(c.x * halfW, c.y * halfH, 0);
    g.scale.setScalar(Math.max(0.0001, c.s * 0.95));
    g.rotation.y = c.ry + mouse.x * 0.3;
    g.rotation.x = c.rx - mouse.y * 0.08;

    const f = floaters.current;
    f.visible = c.float > 0.01;
    f.position.y = (1 - c.float) * halfH * 2.4;
    f.position.x = mouse.x * 0.25;
    f.scale.setScalar(Math.min(1, halfW / 3.2));

  });

  return null;
}

/* ------------------------------------------------------------------ */
/* Hero floating objects                                                */
/* ------------------------------------------------------------------ */
function Floaters({ mobile, reduced, glass }: { mobile: boolean; reduced: boolean; glass: boolean }) {
  const ink = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: "#151515", roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.4 }),
    [],
  );
  const coral = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#ccff00",
        emissive: new THREE.Color("#9fd000"),
        emissiveIntensity: 0.35,
        roughness: 0.2,
        clearcoat: 1,
        envMapIntensity: 1.2,
      }),
    [],
  );
  const pink = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: "#e2ff80", roughness: 0.25, clearcoat: 1, envMapIntensity: 1.2 }),
    [],
  );
  const speed = reduced ? 0 : 1.4;

  return (
    <>
      <Float speed={speed} rotationIntensity={1.4} floatIntensity={1.2}>
        <mesh material={ink} position={[-2.7, 1.25, -1.2]} rotation={[0.6, 0.4, 0]}>
          <torusGeometry args={[0.42, 0.16, 32, 96]} />
        </mesh>
      </Float>
      <Float speed={speed * 0.8} rotationIntensity={0.6} floatIntensity={1.6}>
        <mesh position={[2.85, 1.45, -1.8]}>
          <sphereGeometry args={[0.55, 64, 64]} />
          {glass ? (
            <MeshTransmissionMaterial
              samples={6}
              resolution={256}
              thickness={0.6}
              roughness={0.02}
              chromaticAberration={0.35}
              anisotropicBlur={0.2}
              distortion={0.35}
              distortionScale={0.4}
              temporalDistortion={0.1}
              ior={1.35}
              color="#f4ffd6"
            />
          ) : (
            <meshPhysicalMaterial transmission={1} thickness={0.6} roughness={0.05} ior={1.35} color="#f4ffd6" />
          )}
        </mesh>
      </Float>
      <Float speed={speed * 1.2} rotationIntensity={2} floatIntensity={1}>
        <RoundedBox args={[0.6, 0.6, 0.6]} radius={0.16} smoothness={6} material={pink} position={[-1.7, -1.55, 0.4]} rotation={[0.4, 0.7, 0.2]} />
      </Float>
      <Float speed={speed} rotationIntensity={1} floatIntensity={2}>
        <mesh material={coral} position={[-0.4, 1.95, -2.5]}>
          <sphereGeometry args={[0.22, 32, 32]} />
        </mesh>
      </Float>
      {!mobile && (
        <>
          <Float speed={speed * 0.9} rotationIntensity={2.2} floatIntensity={1.4}>
            <mesh material={ink} position={[3.4, -1.3, -0.8]} rotation={[0.3, 0, 0.9]}>
              <capsuleGeometry args={[0.16, 0.7, 12, 32]} />
            </mesh>
          </Float>
          <Float speed={speed * 1.3} rotationIntensity={1.6} floatIntensity={1.4}>
            <mesh material={coral} position={[-3.6, -0.4, -2.2]}>
              <icosahedronGeometry args={[0.32, 0]} />
            </mesh>
          </Float>
          <Float speed={speed * 0.7} rotationIntensity={0.4} floatIntensity={2.2}>
            <mesh material={pink} position={[1.1, -1.9, -1.4]}>
              <sphereGeometry args={[0.12, 32, 32]} />
            </mesh>
          </Float>
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
function Scene({ mobile, reduced, fx }: { mobile: boolean; reduced: boolean; fx: boolean }) {
  const mascot = useRef<THREE.Group>(null!);
  const floaters = useRef<THREE.Group>(null!);
  const caOffset = useMemo(() => new THREE.Vector2(0.0007, 0.0009), []);

  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 5, 4]} intensity={1.4} />
      <pointLight position={[-4, -1, 3]} intensity={18} color="#ccff00" />
      <pointLight position={[4, 2, 2]} intensity={10} color="#e2ff80" />

      <group ref={mascot}>
      </group>
      <group ref={floaters}>
        <Floaters mobile={mobile} reduced={reduced} glass={fx} />
      </group>

      {/* Studio environment built from light-formers: no HDR download needed */}
      <Environment resolution={mobile ? 128 : 256} frames={1}>
        <group rotation={[-Math.PI / 3, 0, 1]}>
          <Lightformer form="circle" intensity={4} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={2} />
          <Lightformer form="circle" intensity={2} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={2} />
          <Lightformer form="ring" color="#ccff00" intensity={6} rotation-y={Math.PI / 2} position={[-5, -1, -1]} scale={4} />
          <Lightformer form="rect" color="#e2ff80" intensity={5} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={[10, 2, 1]} />
          <Lightformer form="rect" intensity={1.5} position={[0, 0, 10]} scale={[10, 6, 1]} />
        </group>
      </Environment>

      <Director mascot={mascot} floaters={floaters} mobile={mobile} reduced={reduced} />

      {fx && (
        <EffectComposer multisampling={4} enableNormalPass={false}>
          <Bloom mipmapBlur intensity={0.75} luminanceThreshold={0.9} luminanceSmoothing={0.2} />
          <ChromaticAberration offset={caOffset} radialModulation modulationOffset={0.35} />
        </EffectComposer>
      )}
    </>
  );
}

export default function Experience({ reduced }: { reduced: boolean }) {
  const [mobile] = useState(
    () => window.matchMedia("(max-width: 767px)").matches || window.matchMedia("(pointer: coarse)").matches,
  );
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio, mobile ? 1.5 : 1.75));
  const [fx, setFx] = useState(!mobile);
  const [paused, setPaused] = useState(false);

  // pointer → normalised mouse for the scene
  useEffect(() => {
    if (mobile) return;
    const move = (e: PointerEvent) => {
      sceneState.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      sceneState.mouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [mobile]);

  // pause WebGL while the work section covers the mascot, or when the tab is hidden
  useEffect(() => {
    let inWork = false;
    const sync = () => setPaused(inWork || document.hidden);
    const st = ScrollTrigger.create({
      trigger: "#work",
      start: "top top",
      end: "bottom bottom",
      onToggle: (self) => {
        inWork = self.isActive;
        sync();
      },
    });
    document.addEventListener("visibilitychange", sync);
    return () => {
      st.kill();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <Canvas
      dpr={dpr}
      frameloop={paused ? "never" : reduced ? "demand" : "always"}
      camera={{ position: [0, 0, 6], fov: 35, near: 0.1, far: 100 }}
      gl={{ antialias: !fx, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <PerformanceMonitor
        flipflops={2}
        onDecline={() => {
          setDpr(1);
          setFx(false);
        }}
      />
      <Suspense fallback={null}>
        <Scene mobile={mobile} reduced={reduced} fx={fx} />
      </Suspense>
    </Canvas>
  );
}
