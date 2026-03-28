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
        surface: {
          DEFAULT: "#13131f",
          card: "#1c1c2e",
          elevated: "#24243a",
        },
        accent: {
          DEFAULT: "#9b8ec4",
          hover: "#8276b0",
          light: "#bab0dc",
        },
        success: "#7ecbc9",
        warning: "#e8c37a",
        danger: "#e8a0b4",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
