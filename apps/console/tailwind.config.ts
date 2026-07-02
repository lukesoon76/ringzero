import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Monochrome (Palantir / LangChain register): black canvas, grey surfaces,
        // white text/accent. Status hues kept but muted as sparing functional signals.
        ink: "#0a0a0b",
        sidebar: "#0c0c0e",
        panel: "#141416",
        panel2: "#1b1b1e",
        edge: "#2a2a2e",
        muted: "#8a8a92",
        fg: "#f4f4f5",
        ok: "#5fae8c",
        bad: "#d56b6b",
        warn: "#cfa047",
        link: "#b9bcc4",
        brand: "#ededee",
        brandDim: "#cfcfd2",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
