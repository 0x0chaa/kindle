import { ImageResponse } from "next/og";

export const alt = "Kindle — token launchpad on Robinhood Chain";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#0d0e0f",
          color: "#f2f2ec",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 100 100">
            <rect width="100" height="100" rx="24" fill="#1a1c1e" />
            <g transform="translate(18 16) scale(.64)">
              <path d="M52 4C58 26 80 36 80 62c0 19-14 32-30 32S20 81 20 62c0-14 8-22 14-28 2 10 8 14 12 14C42 30 44 16 52 4Z" fill="#ccff00" />
              <path d="M50 92c-9 0-15-7-15-15 0-9 8-13 11-20 4 6 4 10 3 14 5-1 9-6 10-11 4 5 6 9 6 17 0 8-6 15-15 15Z" fill="#1a1c1e" />
            </g>
          </svg>
          <span style={{ fontSize: 44, fontWeight: 800 }}>Kindle</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>Launch a token</span>
          <span style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2, color: "#ccff00" }}>on Robinhood Chain.</span>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 28, opacity: 0.7 }}>
          <span>Bonding curve</span>
          <span>·</span>
          <span>Uniswap v4 at graduation</span>
          <span>·</span>
          <span>Your wallet signs everything</span>
        </div>
      </div>
    ),
    size,
  );
}
