import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { agents } from "@/lib/content";
import { AgentView } from "@/components/AgentView";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return agents.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const p = agents.find((x) => x.slug === slug);
  return p
    ? { title: `${p.title} agent — Kindle`, description: p.description }
    : { title: "Agent not found — Kindle" };
}

export default async function AgentPage({ params }: Params) {
  const { slug } = await params;
  const i = agents.findIndex((p) => p.slug === slug);
  if (i < 0) notFound();
  return <AgentView agent={agents[i]} next={agents[(i + 1) % agents.length]} />;
}
