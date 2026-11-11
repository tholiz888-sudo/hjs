import type { Config } from "tailwindcss";
export default {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#090c10",
        foreground: "#e8edf4",
        card: "#11161e",
        border: "#252c37",
        muted: "#8d99ac",
        primary: "#c8f277",
        positive: "#96dfa9",
        negative: "#f29699",
      },
      borderRadius: { xl: "16px" },
      fontFamily: {
        sans: ["Arial", "PingFang SC", "Microsoft YaHei", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
