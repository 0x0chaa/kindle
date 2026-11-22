import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Baloo_2, Nunito, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Nav } from "@/components/Nav";
import { Cursor } from "@/components/Cursor";

const baloo = Baloo_2({ subsets: ["latin"], variable: "--font-baloo", display: "swap" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
const jet = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jet", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: "Kindle — Token launchpad on Robinhood Chain",
  description:
    "Launch tokens on Robinhood Chain, discover new and trending tokens, and swap via Uniswap v3 and v4 — from your own wallet.",
  openGraph: {
    title: "Kindle — Launch tokens on Robinhood Chain.",
    description: "A friendly token launchpad on Robinhood Chain.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f3f6ea",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-mode="light"
      className={`${baloo.variable} ${nunito.variable} ${jet.variable} ${serif.variable} is-loading`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("kindle:theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`,
          }}
        />
      </head>
      <body className="font-sans">
        <Providers>
          <Nav />
          <main>{children}</main>
          <Cursor />
        </Providers>
      </body>
    </html>
  );
}
