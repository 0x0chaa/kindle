import type { Metadata } from "next";
import { Suspense } from "react";
import { AgentConsole } from "@/components/run/AgentConsole";

export const metadata: Metadata = {
  title: "Agent console — Kindle",
  description: "Give Kindle a goal, choose its tools and guardrails, and run a real AI agent.",
};

export default function RunPage() {
  return (
    <Suspense fallback={null}>
      <AgentConsole />
    </Suspense>
  );
}
