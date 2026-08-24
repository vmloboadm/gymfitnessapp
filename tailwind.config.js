import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        brand: {
          DEFAULT: "var(--brand)",
          foreground: "var(--brand-foreground)",
          dark: "var(--brand-dark)",
          soft: "var(--brand-soft)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        success: {
          DEFAULT: "var(--success)",
          foreground: "var(--success-foreground)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          foreground: "var(--warning-foreground)",
        },
        navy: {
          50: "#f0f6ff",
          100: "#dbe7ff",
          200: "#bed4ff",
          300: "#92b8ff",
          400: "#5f92fc",
          500: "#3b6ff7",
          600: "#2450eb",
          700: "#1c3dd8",
          800: "#1e34af",
          900: "#1e2f8a",
          950: "#0f1b4d",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
      },
      keyframes: {
        "skeleton-shimmer": {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "live-ping": {
          "75%, 100%": { transform: "scale(2)", opacity: "0" },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 8px 0 var(--brand-soft)" },
          "50%": { boxShadow: "0 0 20px 4px var(--brand-soft)" },
        },
      },
      animation: {
        "skeleton-shimmer": "skeleton-shimmer 1.8s linear infinite",
        "live-ping": "live-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
        glow: "glow 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
