/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'IBM Plex Sans'", "ui-sans-serif", "system-ui"],
        mono: ["'IBM Plex Mono'", "ui-monospace"],
        display: ["'Syne'", "ui-sans-serif"],
      },
      colors: {
        bg: {
          base: "#0a0a0b",
          surface: "#111113",
          elevated: "#18181c",
          overlay: "#1f1f25",
        },
        border: {
          subtle: "#1e1e24",
          DEFAULT: "#2a2a33",
          strong: "#3a3a47",
        },
        text: {
          muted: "#4a4a5a",
          secondary: "#7a7a92",
          primary: "#c8c8d8",
          bright: "#f0f0f8",
        },
        accent: {
          DEFAULT: "#5b6af0",
          muted: "#2d3478",
          glow: "#3b4aff33",
        },
        success: "#3ecf8e",
        warning: "#f59e0b",
        danger: "#ef4444",
      },
      animation: {
        "fade-in": "fadeIn 0.15s ease-out",
        "slide-in": "slideIn 0.2s ease-out",
        pulse_slow: "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};
