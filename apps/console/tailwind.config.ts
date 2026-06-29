import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0e16",
        sidebar: "#0e1320",
        panel: "#141b2b",
        panel2: "#1a2336",
        edge: "#243049",
        muted: "#8794ad",
        fg: "#e4eaf3",
        ok: "#34d399",
        bad: "#f87171",
        warn: "#fbbf24",
        link: "#8b7cf6",
        brand: "#8b7cf6",
        brandDim: "#6d5ae6",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
