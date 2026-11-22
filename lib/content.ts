// Sample product content — replace with your own copy, agents and links.

export type StepVisualKind = "prompt" | "connect" | "guard" | "plan" | "execute" | "review";

/** "How it works" — from an idea to a live token. */
export const howItWorks: {
  n: string;
  title: string;
  desc: string;
  tags: string[];
  visual: StepVisualKind;
}[] = [
  {
    n: "01",
    title: "Connect your wallet",
    desc: "Use any Robinhood Chain wallet — MetaMask, Coinbase Wallet, Rabby. Kindle switches you to Robinhood Chain automatically.",
    tags: ["Self-custody", "Robinhood Chain", "No sign-up"],
    visual: "connect",
  },
  {
    n: "02",
    title: "Name your token",
    desc: "Pick a name, a ticker and an image. That's all a launch needs.",
    tags: ["Name", "Ticker", "Image"],
    visual: "prompt",
  },
  {
    n: "03",
    title: "Launch on Kindle",
    desc: "One transaction creates the token through Kindle's factory and opens its Uniswap v4 pool.",
    tags: ["Kindle factory", "Uniswap v4", "One tx"],
    visual: "plan",
  },
  {
    n: "04",
    title: "Liquidity from block one",
    desc: "The supply is placed in the pool at launch and the liquidity can't be removed. No bonding curve, no migration.",
    tags: ["Locked liquidity", "No rug pull of LP", "Fair start"],
    visual: "guard",
  },
  {
    n: "05",
    title: "Trade anywhere",
    desc: "Swap on Kindle through Uniswap v3 and v4 routers, or on any app that supports Uniswap v4 on Robinhood Chain.",
    tags: ["Uniswap v3", "Uniswap v4", "Permit2"],
    visual: "execute",
  },
  {
    n: "06",
    title: "Earn creator rewards",
    desc: "Every swap pays a 1% pool fee. 70% of it goes to the creator, 30% to Kindle.",
    tags: ["Creator fees", "Paid in ETH", "On-chain"],
    visual: "review",
  },
];

/** Introduction — what you need to launch. */
export const needs = [
  { t: "A Robinhood Chain wallet", d: "Any self-custody wallet that works on Robinhood Chain. You keep the keys." },
  { t: "A little ETH", d: "For gas. Your wallet shows the total before you sign." },
  { t: "Name, ticker, image", d: "Your token's identity. Use a square image hosted on a public https link." },
  { t: "Your community", d: "Liquidity is live from the first block — share the contract address from your own channels." },
];

export const useCases = [
  "Email & inbox",
  "Research",
  "Customer support",
  "Reporting",
  "Engineering ops",
  "Something else",
];

export type ArtVariant = "orb" | "waves" | "rings" | "grid";

export type Agent = {
  slug: string;
  title: string;
  category: string;
  trigger: string;
  kind: string;
  description: string;
  job: string;
  how: string;
  tools: string[];
  palette: { bg: string; a: string; b: string; c: string };
  variant: ArtVariant;
};

export const agents: Agent[] = [
  {
    slug: "inbox-triage",
    title: "Inbox Triage",
    category: "Operations",
    trigger: "Every 15 min",
    kind: "Template",
    description:
      "Reads every new email, labels it, drafts replies in your voice and flags anything that needs a human.",
    job: "Keep a shared inbox at zero without anyone living in it — urgent messages surface, routine ones get answered.",
    how: "On each run it reads new mail, sorts it by intent, drafts replies from your past answers and posts a short digest to your team channel. Replies to new contacts wait for approval.",
    tools: ["Gmail", "Slack", "Notion", "Your CRM"],
    palette: { bg: "#0b0b0b", a: "#f0866b", b: "#e6f0c4", c: "#ffffff" },
    variant: "orb",
  },
  {
    slug: "research-analyst",
    title: "Research Analyst",
    category: "Research",
    trigger: "On request",
    kind: "Template",
    description: "Give it a question; it searches, reads, cross-checks sources and returns a cited brief.",
    job: "Turn an open question into a decision-ready brief with every claim traceable to a source.",
    how: "It plans search angles, reads the most relevant pages and files, compares what sources agree and disagree on, then writes a brief with citations into your docs.",
    tools: ["Web search", "Google Drive", "PDF reader", "Docs"],
    palette: { bg: "#e2ff80", a: "#ffffff", b: "#2fae7f", c: "#0b0b0b" },
    variant: "waves",
  },
  {
    slug: "support-copilot",
    title: "Support Copilot",
    category: "Customer support",
    trigger: "On new ticket",
    kind: "Template",
    description: "Answers common tickets from your help centre and hands tricky ones to your team with full context.",
    job: "Resolve repetitive questions instantly and give human agents a head start on the hard ones.",
    how: "For each new ticket it searches your help centre and past resolutions, replies when it is confident, and otherwise tags, summarises and routes the ticket to the right person.",
    tools: ["Zendesk", "Intercom", "Help centre", "Slack"],
    palette: { bg: "#eaff99", a: "#ffffff", b: "#ccff00", c: "#0b0b0b" },
    variant: "rings",
  },
  {
    slug: "ops-watchdog",
    title: "Ops Watchdog",
    category: "Engineering",
    trigger: "Continuous",
    kind: "Template",
    description: "Watches dashboards and logs, and opens an incident with a first diagnosis when something drifts.",
    job: "Catch problems before customers do, and save the on-call engineer the first twenty minutes of digging.",
    how: "It watches key metrics and error logs, correlates spikes with recent deploys, opens an incident with its findings and pages a human only when thresholds are crossed.",
    tools: ["Datadog", "GitHub", "PagerDuty", "Linear"],
    palette: { bg: "#e6f0c4", a: "#ccff00", b: "#e2ff80", c: "#0b0b0b" },
    variant: "grid",
  },
];

/** The agent loop — what happens during every run. */
export const steps = [
  {
    n: "01",
    title: "Plan",
    text: "Reads the goal, the context and what happened on past runs, then writes a step-by-step plan.",
    tags: ["Goal", "Context", "Memory"],
  },
  {
    n: "02",
    title: "Act",
    text: "Calls your tools — searches, writes, sends, updates — one verified step at a time.",
    tags: ["Tools", "APIs", "Sandbox"],
  },
  {
    n: "03",
    title: "Observe",
    text: "Checks every result against the plan and your guardrails, and pauses for approval when needed.",
    tags: ["Checks", "Guardrails", "Approvals"],
  },
  {
    n: "04",
    title: "Learn",
    text: "Summarises the run, keeps what worked and gets sharper with every piece of feedback.",
    tags: ["Reports", "Feedback", "Memory"],
  },
];

/** `href: null` shows the channel as "soon" without a link. */
export const socials: { id: "x" | "telegram"; label: string; href: string | null }[] = [
  { id: "x", label: "X / Twitter", href: "https://x.com/runmochiapp" },
  { id: "telegram", label: "Telegram", href: "https://t.me/runmochi" },
];

export const EMAIL = "hello@kindle.ai";
