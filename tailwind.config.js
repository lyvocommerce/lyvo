/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        bg: "#ffffff",
        text: "#1c1c1e",
        muted: "#6e6e73",
        border: "#e5e5ea",
        card: "#f9f9fb",
        accent: "#0071e3" /* Apple blue */,
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        tile: "0 1px 3px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.04)",
      },
    },
  },
  plugins: [],
};