/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EAF4FB',
          100: '#d0e8f7',
          200: '#a1d1ef',
          300: '#5db4e3',
          400: '#1a97d6',
          500: '#056DAE',
          600: '#045d95',
          700: '#034d7c',
          800: '#003B70',
          900: '#002C54',
          950: '#001B36',
        },
        accent: {
          50: '#FFF0F2',
          100: '#FFD6DC',
          200: '#FFA3B0',
          300: '#FF7085',
          400: '#FF4D63',
          500: '#E31837',
          600: '#C4122E',
          700: '#A30E26',
          800: '#830A1E',
          900: '#620716',
        },
        citi: {
          navy: '#003B70',
          blue: '#056DAE',
          sky: '#0A8AD2',
          red: '#E31837',
          light: '#EAF4FB',
          bg: '#F5F7FA',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        'sm': '6px',
        'DEFAULT': '10px',
        'lg': '14px',
        'xl': '20px',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'elevated': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      },
      spacing: {
        '128': '32rem',
        '144': '36rem',
      },
    },
  },
  plugins: [],
};
