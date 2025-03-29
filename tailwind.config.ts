import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'zippcall-blue': '#1A4971', // Dark blue from logo (text & outline)
        'zippcall-light-blue': '#55AADD', // Light blue from logo (body)
        'zippcall-yellow': '#FFCC33', // Yellow from logo (lightning bolt)
        'zippcall-cream': '#FFF8E1', // Cream color from logo (face)
        primary: '#1A4971', // Using the dark blue as primary
        secondary: '#55AADD', // Using the light blue as secondary
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [{
      light: {
        "primary": "#1A4971",
        "secondary": "#55AADD",
        "accent": "#FFCC33",
        "neutral": "#2A303C",
        "base-100": "#FFFFFF",
      }
    }],
  },
}

export default config 