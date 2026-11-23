import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy — Kindle",
  description: "What data Kindle's website handles and what it doesn't.",
};

const sections = [
  {
    title: "No accounts",
    body: [
      "Kindle has no sign-up, no email list and no account database. You connect a wallet, and Kindle only sees the public address your wallet shares.",
      "Kindle never asks for your seed phrase or private key. Anyone who does is not Kindle.",
    ],
  },
  {
    title: "On-chain data is public",
    body: [
      "Transactions you sign — launches, trades, claims and buybacks — are recorded on Robinhood Chain. They are public, permanent and linked to your wallet address. Kindle can't change or delete them.",
    ],
  },
  {
    title: "Stored in your browser",
    body: [
      "Kindle saves your light or dark theme in your browser's local storage. Your wallet app may also remember that you connected. You can clear both in your browser or wallet settings.",
      "Kindle doesn't use advertising or tracking cookies.",
    ],
  },
  {
    title: "Services Kindle uses",
    body: [
      "The site is hosted on Vercel, which keeps standard server logs such as IP address, browser and pages requested.",
      "Prices come from DexScreener and chain data from Robinhood Chain RPC nodes. Token images are loaded from the links creators provide, so those hosts can see your request.",
      "Your wallet provider handles your connection under its own privacy policy.",
    ],
  },
  {
    title: "Changes and contact",
    body: [
      "This page may change; the date at the top shows the latest version. Questions can go to Kindle's official channels listed in the footer.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      label="Privacy"
      title="Privacy."
      updated="23 November 2026"
      intro="Kindle is built so it needs as little of your data as possible. Here is what it handles."
      sections={sections}
    />
  );
}
