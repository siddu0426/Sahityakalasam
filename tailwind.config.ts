import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          50: "#F2F8F7",
          100: "#E5F2F0",
          200: "#C7E3DF",
          300: "#9ECDC6",
          400: "#5BA89E",
          500: "#2A9D8F",
          600: "#1F7A6D", // Primary brand deep teal
          700: "#186358",
          800: "#134F47",
          900: "#0D3630",
        },
        warm: {
          50: "#FCFBF9",
          100: "#F8F6F1",
          200: "#F1EDE4",
          300: "#E2DCD1",
          400: "#C4BAAA",
          500: "#998E7E",
          600: "#706557",
          700: "#4D453B",
          800: "#2C261F",
          900: "#1A1713",
        },
        brand: {
          bg: "#FAF8F5", // Warm off-white
          card: "#FFFFFF",
          cardBorder: "#EFEBE4",
          primary: "#1F7A6D",
          primaryDark: "#175E54",
          primaryLight: "#E5F2F0",
          text: "#1A2E2B",
          textMuted: "#627571",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        telugu: ["var(--font-telugu)", "Noto Sans Telugu", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 10px -2px rgba(31, 122, 109, 0.05), 0 1px 3px rgba(0,0,0,0.03)",
        cardHover: "0 8px 24px -4px rgba(31, 122, 109, 0.12), 0 2px 6px rgba(0,0,0,0.04)",
        float: "0 12px 32px -4px rgba(31, 122, 109, 0.18)",
        nav: "0 -4px 20px rgba(0, 0, 0, 0.04)",
      },
      borderRadius: {
        card: "16px",
      },
    },
  },
  plugins: [],
};

export default config;
