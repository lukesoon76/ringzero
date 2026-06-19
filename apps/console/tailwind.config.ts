import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b0f14",
        panel: "#121826",
        edge: "#1f2a3a",
        muted: "#7d8aa0",
        fg: "#d7e0ea",
        ok: "#3ad29f",
        bad: "#ff6b6b",
        warn: "#ff9d6b",
        link: "#5aa9ff",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
