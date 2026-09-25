import type { Config } from "tailwindcss";

const config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* Spring Season Colors */
        spring: {
          leaf: "#4CAF6A",
          "leaf-dark": "#6DD477",
          mint: "#7ED957",
          "mint-dark": "#90FF6B",
          yellow: "#F5F9C1",
          "yellow-accent": "#FFD84D",
          sky: "#8ED6FF",
          "sky-dark": "#7EBFFF",
          lavender: "#BFA8FF",
          "lavender-dark": "#D5C9FF",
          pink: "#FFB7D5",
          "pink-dark": "#FF8FBE",
          "pink-accent": "#FF9ECF",
          cream: "#FAFFF7",
          "cream-dark": "#0F1908",
          sand: "#F3F5EB",
          "sand-dark": "#1C2B22",
          forest: "#1E2A22",
          "forest-dark": "#E8F5E9",
          "forest-surface": "#1C2B22",
        },
      },
      borderRadius: {
        "2xl": "18px",
        xl: "16px",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backdropBlur: {
        glass: "16px",
        "glass-heavy": "24px",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0, 0, 0, 0.12)",
        "glass-lg": "0 12px 40px rgba(0, 0, 0, 0.18)",
        "glass-hover": "0 16px 48px rgba(0, 0, 0, 0.2)",
        "btn-3d": "0 4px 10px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.4)",
        "btn-3d-hover": "0 6px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.5)",
        "glow-purple": "0 0 20px hsl(250 76% 57% / 0.3)",
        "glow-purple-lg": "0 0 30px hsl(250 76% 57% / 0.4)",
        /* Spring Shadows */
        "spring-sm": "0 4px 8px rgba(76, 175, 106, 0.1)",
        "spring-md": "0 8px 24px rgba(76, 175, 106, 0.15)",
        "spring-lg": "0 16px 40px rgba(76, 175, 106, 0.25)",
        "spring-xl": "0 24px 52px rgba(76, 175, 106, 0.35)",
        "spring-glow": "0 0 20px rgba(76, 175, 106, 0.3)",
        "spring-glow-lg": "0 0 30px rgba(76, 175, 106, 0.5)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-slide-up": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "glow": {
          "0%, 100%": { boxShadow: "0 0 5px hsl(250 76% 57% / 0.3)" },
          "50%": { boxShadow: "0 0 20px hsl(250 76% 57% / 0.5)" },
        },
        /* Spring Animations */
        "petal-drift": {
          "0%": {
            transform: "translateY(-100px) translateX(0) rotate(0deg)",
            opacity: "0",
          },
          "10%": { opacity: "0.6" },
          "90%": { opacity: "0.6" },
          "100%": {
            transform: "translateY(100vh) translateX(30px) rotate(360deg)",
            opacity: "0",
          },
        },
        "leaf-sway": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "50%": { transform: "rotate(2deg)" },
        },
        "bloom": {
          "0%": {
            transform: "scale(0)",
            opacity: "0",
          },
          "50%": { transform: "scale(1.2)" },
          "100%": {
            transform: "scale(1)",
            opacity: "1",
          },
        },
        "grow-plant": {
          "0%": {
            transform: "scaleX(0)",
            transformOrigin: "left",
          },
          "100%": {
            transform: "scaleX(1)",
            transformOrigin: "left",
          },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 12px rgba(76, 175, 106, 0.3)" },
          "50%": { boxShadow: "0 0 24px rgba(76, 175, 106, 0.5)" },
        },
        "scale-up": {
          "from": {
            transform: "translateY(0) scale(1)",
          },
          "to": {
            transform: "translateY(-8px) scale(1.02)",
          },
        },
        "gentle-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.8" },
        },
        "subtle-bounce": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease forwards",
        "fade-slide-up": "fade-slide-up 0.6s ease forwards",
        "scale-in": "scale-in 0.4s ease forwards",
        "glow": "glow 2s ease-in-out infinite",
        /* Spring Animations */
        "petal-drift-1": "petal-drift 8s linear infinite",
        "petal-drift-2": "petal-drift 10s linear infinite 1s",
        "petal-drift-3": "petal-drift 12s linear infinite 2s",
        "petal-drift-4": "petal-drift 9s linear infinite 3s",
        "petal-drift-5": "petal-drift 11s linear infinite 4s",
        "leaf-sway": "leaf-sway 3s ease-in-out infinite",
        "bloom": "bloom 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "grow-plant": "grow-plant 0.8s ease-out forwards",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        "scale-up": "scale-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "gentle-pulse": "gentle-pulse 2s ease-in-out infinite",
        "subtle-bounce": "subtle-bounce 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
