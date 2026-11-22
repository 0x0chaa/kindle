import type { LogItem } from "./AgentConsole";

/** A scripted sample run shown when no API key is configured. Figures are illustrative. */
type DemoItem = LogItem extends infer T ? (T extends unknown ? Omit<T, "id"> : never) : never;

export const DEMO_SCRIPT: DemoItem[] = [
  {
    kind: "goal",
    text: "Plan a 4-day trip to Tokyo for two people on a mid-range budget and total it in IDR.",
  },
  {
    kind: "thought",
    text: "Plan: look up typical mid-range costs for flights, hotels, food and transport, add them up with the calculator, then convert to IDR.",
  },
  { kind: "search", query: "Jakarta to Tokyo return flight price economy", results: [] },
  { kind: "search", query: "Tokyo mid-range hotel price per night", results: [] },
  {
    kind: "call",
    name: "calculator",
    input: { expression: "(2 * 6200000) + (4 * 1900000) + (2 * 4 * 900000) + 2 * 1200000" },
    status: "done",
    result: "(2 * 6200000) + (4 * 1900000) + (2 * 4 * 900000) + 2 * 1200000 = 29600000",
  },
  {
    kind: "call",
    name: "save_note",
    input: { title: "Budget total", content: "≈ IDR 29.6 million before activities" },
    status: "done",
    result: "Saved to notes",
  },
  {
    kind: "final",
    text: "## Tokyo, 4 days for two (sample)\n\n| Item | Estimate (IDR) |\n|---|---|\n| Flights ×2 | 12,400,000 |\n| Hotel, 4 nights | 7,600,000 |\n| Food | 7,200,000 |\n| Transport passes | 2,400,000 |\n| **Total** | **29,600,000** |\n\n- **Day 1:** Asakusa and Ueno\n- **Day 2:** Shibuya, Harajuku, Meiji Shrine\n- **Day 3:** Day trip to Kamakura\n- **Day 4:** Tsukiji outer market, then the airport\n\n*These are illustrative numbers for the demo — a real run looks prices up live.*",
    sources: [],
  },
];
