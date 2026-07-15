/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F0F9FF',
        primary: '#0369A1',
        secondary: '#0EA5E9',
        cta: '#22C55E',
        ghost: '#0C4A6E',
        surface: '#FFFFFF',
      },
      fontFamily: {
        head: ['"Fira Code"', '"SF Mono"', 'JetBrains Mono', 'monospace'],
        drama: ['"Fira Code"', '"SF Mono"', 'JetBrains Mono', 'monospace'],
        mono: ['"Fira Code"', '"SF Mono"', 'JetBrains Mono', 'monospace'],
        body: ['"Fira Sans"', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
        '6xl': '3rem',
      },
    },
  },
  plugins: [],
}
