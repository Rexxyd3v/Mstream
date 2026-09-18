/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "dark-bg": "#0b0b0f",
        "dark-card": "#111116",
      },
    },
  },
  plugins: [],
}
