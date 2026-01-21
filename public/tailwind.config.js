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
        // Brand Colors
        'brand-blue': '#2563eb',
        'brand-slate': '#0f172a',

        // Design System Variables (Strict Enforcement)
        'success-green': '#059669',  // Emerald 600 for completed states
        'warning-orange': '#f97316', // Orange 500 for change orders & critical path

        // Background & Surface
        'bg-primary': '#f8fafc',     // Slate 50
        'surface': '#ffffff',         // White

        // Text Colors
        'text-primary': '#0f172a',   // Slate 900
        'text-secondary': '#64748b',  // Slate 500

        // Borders
        'border-primary': '#e2e8f0',  // Slate 200
      },

      // Typography
      fontFamily: {
        'sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },

      // Spacing for consistent design
      spacing: {
        '128': '32rem',
      }
    }
  },
  plugins: []
}
