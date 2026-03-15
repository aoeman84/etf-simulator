/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  safelist: [
    'accent-blue-600',
    'accent-green-600',
    'accent-purple-600',
  ],
  theme: { extend: {} },
  plugins: [],
}
