/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        pixel: {
          bg: "#1a1a2e",
          surface: "#16213e",
          panel: "#0f3460",
          accent: "#e94560",
          green: "#00d98b",
          yellow: "#ffd93d",
          blue: "#4fc3f7",
          purple: "#b388ff",
          orange: "#ffab40",
          dim: "#8892b0",
          text: "#ccd6f6",
          bright: "#e6f1ff",
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', "monospace"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "bounce-pixel": "bounce-pixel 0.5s steps(3) infinite",
        "blink": "blink 1s steps(2) infinite",
      },
      keyframes: {
        "bounce-pixel": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};
