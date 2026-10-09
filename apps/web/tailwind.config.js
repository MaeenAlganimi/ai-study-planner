/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f3efe6",
        "paper-deep": "#e6dfd1",
        card: "#fcfaf6",
        ink: "#1c1915",
        "ink-soft": "#5e584e",
        line: "#ddd4c4",
        teal: {
          DEFAULT: "#0f5c56",
          deep: "#0a3f3b",
          soft: "#e5f2f0",
        },
        brass: {
          DEFAULT: "#8a5e34",
          soft: "#f4e7d6",
        },
        sienna: {
          DEFAULT: "#9d4324",
          soft: "#f8e7df",
        },
      },
      fontFamily: {
        sans: ["Figtree", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Newsreader", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(28,25,21,0.04), 0 18px 40px -28px rgba(28,25,21,0.55)",
      },
    },
  },
  plugins: [],
};
