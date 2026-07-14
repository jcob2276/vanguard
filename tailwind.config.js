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
        primary: 'var(--primary)',
        dayA: '#3b82f6', // blue-500
        dayB: '#f43f5e', // rose-500 (matches index.css)
        dayC: '#10b981', // emerald-500 (matches index.css)
        dayD: '#f59e0b', // amber-500
      }
    },
  },
  plugins: [],
}
