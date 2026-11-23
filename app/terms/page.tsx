import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms & risks — Kindle",
  description: "The terms for using Kindle's interface and the risks of launching and trading tokens on Robinhood Chain.",
};

const sections = [
  {
    title: "What Kindle is",
    body: [
      "Kindle is a website that helps you interact with smart contracts on Robinhood Chain: Kindle's launch factory and Uniswap v4 pools. The website is an interface only.",
      "Every action is a transaction you sign in your own wallet. Kindle never holds your keys, tokens or funds, and cannot reverse, cancel or refund a transaction.",
    ],
  },
  {
    title: "Your responsibility",
    body: [
      "You are responsible for your wallet, your keys and every transaction you sign. Read each wallet prompt before you confirm it.",
      "You must be legally allowed to use crypto assets and services like this where you live. Don't use Kindle if it is restricted for you, and don't use it to break any law, including sanctions, securities and tax rules.",
      "If you launch a token, you are responsible for its name, image, description and how you promote it. Don't impersonate people, companies or other projects, and don't use content you don't have rights to.",
    ],
  },
  {
    title: "Tokens are not vetted",
    body: [
      "Anyone can launch a token. Kindle doesn't review, endorse or guarantee any token, creator or pair asset listed on the site.",
      "Look-alike names and images are common. Always check the contract address. Token lists, prices and charts come from on-chain data and third parties such as DexScreener and may be late or wrong.",
    ],
  },
  {
    title: "Risks",
    body: [
      "Launched tokens are highly speculative and usually lose most or all of their value. Only use money you can afford to lose.",
      "Smart contracts can have bugs. Kindle's factory has not been independently audited. Blockchains, wallets, RPCs and bridges can fail, be congested or be attacked.",
      "Prices on a bonding curve and in a pool move with every trade. Slippage, front-running and the anti-snipe tax in the first seconds after a launch can make you receive less than expected.",
      "Creator taxes, buybacks and vesting are set by the token's creator within limits enforced by the contract. Read a token's settings before you trade it.",
    ],
  },
  {
    title: "Fees",
    body: [
      "Launch and trading fees are set in Kindle's factory contract and shown before you sign. You also pay Robinhood Chain gas. Fees paid on-chain can't be refunded.",
    ],
  },
  {
    title: "No advice, no warranty",
    body: [
      "Nothing on Kindle is financial, investment, legal or tax advice.",
      "Kindle is provided as is and as available, without warranties of any kind. To the extent the law allows, Kindle and its contributors are not liable for losses from using the site, the contracts or any token.",
    ],
  },
  {
    title: "Changes",
    body: [
      "These terms may change. The date at the top shows the latest version. Using Kindle after a change means you accept the new terms.",
      "Kindle is not affiliated with Robinhood or Uniswap.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      label="Terms & risks"
      title="Terms & risks."
      updated="23 November 2026"
      intro="By using Kindle you agree to these terms. Please read the risks section carefully — launching and trading tokens can lose you money."
      sections={sections}
    />
  );
}
