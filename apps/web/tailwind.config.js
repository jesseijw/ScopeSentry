/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#4F46E5',
        success: '#16A34A',
        danger: '#DC2626',
        warning: '#D97706',
      },
    },
  },
  plugins: [],
}
i