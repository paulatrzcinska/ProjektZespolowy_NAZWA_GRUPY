/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f4f3f0",
        surface: "#ffffff",
        ink: "#1a1a18",
        subtle: "#6b6966",
        line: "#e6e4e0",
        accent: "#2c2c2a",
        danger: "#b91c1c",
        "danger-bg": "#fef2f2",
      },
      fontFamily: {
        sans: ['"DM Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Cormorant Garamond"', "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 24px 48px -12px rgb(0 0 0 / 0.08)",
        card: "0 1px 0 rgb(0 0 0 / 0.04), 0 12px 40px -16px rgb(0 0 0 / 0.1)",
      },
    },
  },
  plugins: [],
};
