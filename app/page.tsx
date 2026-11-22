import { Stage } from "@/components/three/Stage";
import { Hero } from "@/components/sections/Hero";
import { TokenBoard } from "@/components/sections/TokenBoard";
import { Contact } from "@/components/sections/Contact";

export default function Home() {
  return (
    <>
      <Stage />
      <div className="relative z-10">
        <Hero />
        <TokenBoard />
        <Contact />
      </div>
    </>
  );
}
