/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      boxShadow: {
        'apple': '0 4px 24px rgba(0, 0, 0, 0.06)',
        'apple-lg': '0 8px 32px rgba(0, 0, 0, 0.08)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"PingFang SC"', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['"SF Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        brand: {
          DEFAULT: '#0a84ff',
          dark: '#0060df',
        },
      },
    },
  },
  plugins: [],
}
