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
      },
      fontSize: {
        '3xs': ['7px',  { lineHeight: '10px' }],
        '2xs': ['9px',  { lineHeight: '12px' }],
        xs:    ['11px', { lineHeight: '14px' }],
        sm:    ['13px', { lineHeight: '16px' }],
        base:  ['15px', { lineHeight: '20px' }],
        lg:    ['18px', { lineHeight: '22px' }],
        xl:    ['20px', { lineHeight: '24px' }],
        '2xl': ['24px', { lineHeight: '28px' }],
        '3xl': ['30px', { lineHeight: '34px' }],
        '4xl': ['36px', { lineHeight: '40px' }],
        '5xl': ['48px', { lineHeight: '52px' }],
        '6xl': ['56px', { lineHeight: '60px' }],
      },
    },
  },
  plugins: [],
}
