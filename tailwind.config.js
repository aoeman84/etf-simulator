/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  safelist: [
    'accent-sky-400',
    'accent-amber-400',
    'accent-violet-300',
    'accent-violet-400',
    'accent-emerald-400',
  ],
  theme: { extend: {} },
  plugins: [],
}
