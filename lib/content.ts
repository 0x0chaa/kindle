// Site copy: How it works, what you need to launch, and community links.

/** "How it works" — from an idea to a graduated token, step by step. */
export const howItWorks: { title: string; desc: string; tags: string[] }[] = [
  {
    title: "Connect your wallet",
    desc: "Use any Robinhood Chain wallet — MetaMask, Coinbase Wallet, Rabby. Kindle switches you to Robinhood Chain automatically and never holds your keys.",
    tags: ["Self-custody", "No sign-up"],
  },
  {
    title: "Set up your token",
    desc: "Pick a name, a ticker and an image. Choose what it trades against (ETH or an approved asset), whether fees go to you or to your holders, an optional tax of 0–10%, and how much of your fees should buy your token back.",
    tags: ["Name & image", "Pair", "Tax", "Auto-buyback"],
  },
  {
    title: "Launch in one transaction",
    desc: "One signature creates a fixed 1B supply and opens its bonding curve. Add a first buy in the same transaction to get in before anyone else. Launching costs 0.0005 ETH plus gas.",
    tags: ["One tx", "Launch + buy", "No team tokens"],
  },
  {
    title: "Protected first seconds",
    desc: "Buys in the first 5 seconds pay an anti-snipe tax that falls from 99% to 0, so bots can't grab your launch. Your own launch-buy is exempt.",
    tags: ["Anti-snipe", "Fair start"],
  },
  {
    title: "Trade on the curve",
    desc: "800M tokens are sold on the curve: every buy raises the price, every sell lowers it. You can sell back to the curve at any time. Each trade pays 1% plus the creator's tax.",
    tags: ["Bonding curve", "Buy & sell", "Live progress"],
  },
  {
    title: "Graduate to Uniswap v4",
    desc: "When the curve sells out (about 4.2 ETH for ETH pairs), the last 200M tokens and everything raised open a Uniswap v4 pool in the same transaction. The liquidity is locked forever.",
    tags: ["Automatic", "Locked LP", "Uniswap v4"],
  },
  {
    title: "Trade anywhere",
    desc: "After graduation the token trades in its pool — on Kindle or any app that supports Uniswap v4 on Robinhood Chain. Trackers like DexScreener and GMGN pick it up from the first trades.",
    tags: ["Any v4 app", "Charts", "Same fees"],
  },
  {
    title: "Earn and claim",
    desc: "70% of the 1% fee and all of the tax go to the creator — or, if the creator chose it at launch, to everyone holding the token, split by balance. Paid in the pair asset and claimed from the token page.",
    tags: ["70% of fees", "+ tax", "Creator or holders"],
  },
  {
    title: "Buy back, locked for 5 years",
    desc: "Creators can spend fees buying their own token, by hand or automatically on every claim. Each buyback unlocks evenly over five years.",
    tags: ["Buybacks", "5-year unlock"],
  },
];

/** Introduction — what makes Kindle different. */
export const highlights = [
  { t: "Fair launch", d: "Fixed 1B supply, no presale and no team allocation. Everyone buys from the same curve." },
  { t: "Locked liquidity", d: "At graduation the pool's liquidity is owned by the factory, which has no way to remove it." },
  { t: "Creator or holder earnings", d: "70% of every 1% fee plus an optional tax of up to 10%, paid in the pair asset — to the creator or shared by holders." },
  { t: "Any pair", d: "Trade against ETH or an approved asset like a tokenized stock or a stablecoin." },
  { t: "Long-term buybacks", d: "Creators can buy their token back with fees; buybacks unlock over five years." },
  { t: "Bot protection", d: "A 5-second anti-snipe tax, falling from 99% to 0, keeps launches fair." },
];

/** Introduction — what you need to launch. */
export const needs = [
  { t: "A Robinhood Chain wallet", d: "Any self-custody wallet that works on Robinhood Chain. You keep the keys." },
  { t: "A little ETH", d: "For the 0.0005 ETH launch fee and gas — plus a first buy if you want one." },
  { t: "Name, ticker, image", d: "Your token's identity. Use a square image hosted on a public https link." },
  { t: "Your community", d: "Help your token fill its curve and graduate — share the contract address from your own channels." },
];

export const socials: { id: "x" | "telegram"; label: string; href: string | null }[] = [
  { id: "x", label: "X / Twitter", href: "https://x.com/runmochiapp" },
  { id: "telegram", label: "Telegram", href: "https://t.me/runmochi" },
];

