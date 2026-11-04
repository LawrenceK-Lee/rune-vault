/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0b0f18', 900: '#0f1420', 800: '#161d2d', 700: '#1f2940', 600: '#2c3a57' },
        gold: { 300: '#f3dd9c', 400: '#e6c76b', 500: '#c9a646' },
        domain: {
          fury: '#d9483b', calm: '#3fae7a', mind: '#3f7fd9', body: '#e38b2c',
          chaos: '#9b5bd6', order: '#e6c76b', colorless: '#8a93a6',
        },
      },
      fontFamily: { display: ['"Cinzel"', 'Georgia', 'serif'] },
    },
  },
  plugins: [],
};
