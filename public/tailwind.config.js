// Tailwind CSS Configuration for HomeProHub
// This file documents our Tailwind setup for production migration

module.exports = {
  content: [
    "./public/**/*.{html,js}",
    "./public/components/**/*.{html,js}"
  ],
  theme: {
    extend: {
      colors: {
        'brand-blue': '#2563eb',
        'brand-slate': '#0f172a',
      }
    }
  },
  plugins: []
}
