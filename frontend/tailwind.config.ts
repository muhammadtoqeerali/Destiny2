import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Scandinavian public-health palette: deep fjord blue, clean
        // white/grey surfaces, a calm teal accent, and a clear
        // amber/red pair reserved strictly for risk signalling.
        fjord: {
          50: "#eef4fb",
          100: "#d7e6f6",
          200: "#b0cdee",
          300: "#80aee1",
          400: "#4f8dd1",
          500: "#2f70b8",
          600: "#235896",
          700: "#1d4779",
          800: "#1a3b63",
          900: "#152f4f",
          950: "#0d1d33",
        },
        teal: {
          50: "#eefbf8",
          100: "#d3f3ec",
          300: "#7ad6c4",
          500: "#2fae97",
          600: "#228a78",
          700: "#1c6f61",
        },
        sand: {
          50: "#faf9f6",
          100: "#f3f1ea",
          200: "#e8e3d6",
        },
        risk: {
          low: "#2f9e5b",
          moderate: "#d99a1f",
          high: "#cc4b37",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(13,29,51,0.04), 0 4px 16px rgba(13,29,51,0.06)",
        cardHover: "0 2px 4px rgba(13,29,51,0.06), 0 12px 28px rgba(13,29,51,0.10)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
