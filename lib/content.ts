// Site copy: How it works, what you need to launch, and community links.

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
    desc: "One transaction creates the token and opens its bonding curve. Add a first buy if you like.",
    tags: ["Bonding curve", "Launch + buy", "One tx"],
    visual: "plan",
  },
  {
    n: "04",
    title: "Graduate to Uniswap v4",
    desc: "When the curve sells out (~4.2 ETH), the token moves to a Uniswap v4 pool and the liquidity is locked forever.",
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
    desc: "Every trade pays 1%. 70% of it goes to the creator, 30% to Kindle.",
    tags: ["Creator fees", "Paid in ETH", "On-chain"],
    visual: "review",
  },
];

/** Introduction — what you need to launch. */
export const needs = [
  { t: "A Robinhood Chain wallet", d: "Any self-custody wallet that works on Robinhood Chain. You keep the keys." },
  { t: "A little ETH", d: "For gas. Your wallet shows the total before you sign." },
  { t: "Name, ticker, image", d: "Your token's identity. Use a square image hosted on a public https link." },
  { t: "Your community", d: "Help your token fill its curve and graduate — share the contract address from your own channels." },
];

export const socials: { id: "x" | "telegram"; label: string; href: string | null }[] = [
  { id: "x", label: "X / Twitter", href: "https://x.com/runmochiapp" },
  { id: "telegram", label: "Telegram", href: "https://t.me/runmochi" },
];

