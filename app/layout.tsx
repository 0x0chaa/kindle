import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Baloo_2, Nunito, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Nav } from "@/components/Nav";
import { Cursor } from "@/components/Cursor";
import { SITE_URL } from "@/lib/site";

const baloo = Baloo_2({ subsets: ["latin"], variable: "--font-baloo", display: "swap" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
const jet = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jet", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });

const description =
  "Launch a token on Robinhood Chain in one transaction: a bonding curve that graduates to a locked Uniswap v4 pool, from your own wallet.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Kindle — Token launchpad on Robinhood Chain",
  description,
  openGraph: {
    title: "Kindle — Launch tokens on Robinhood Chain.",
    description,
    type: "website",
    siteName: "Kindle",
  },
  twitter: { card: "summary_large_image", title: "Kindle — Launch tokens on Robinhood Chain.", description },
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
            __html: `try{if(localStorage.getItem("kindle:theme")==="dark"){document.documentElement.dataset.theme="dark";document.documentElement.dataset.mode="dark"}}catch(e){}`,
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
