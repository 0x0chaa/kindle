import type { Metadata } from "next";
import { About } from "@/components/sections/About";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Fees } from "@/components/sections/Fees";
import { Faq } from "@/components/sections/Faq";
import { Contact } from "@/components/sections/Contact";

export const metadata: Metadata = {
  title: "About Kindle — how it works, fees and FAQ",
  description: "What Kindle is, how launching works, what it costs, and answers to common questions.",
};

export default function AboutPage() {
  return (
    <div className="relative z-10 pt-16">
      <About />
      <HowItWorks />
      <Fees />
      <Faq />
      <Contact />
    </div>
  );
}
