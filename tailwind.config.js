/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        surface: '#171717',
        primary: '#4f46e5',
        dayA: '#3b82f6', // blue-500
        dayB: '#ef4444', // red-500
        dayC: '#22c55e', // green-500
        dayD: '#f59e0b', // amber-500
      }
    },
  },
  plugins: [],
}
