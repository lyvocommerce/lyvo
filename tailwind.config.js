/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./js/**/*.js"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        slatebg: "#0b1220",
        card: "#0f172a",
        border: "#1f2937",
      },
      borderRadius: { xl: "14px" },
    },
  },
  plugins: [],
};

