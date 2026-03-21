/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}", // ✅ this matches your current files
    "./src/pages/**/*.{js,ts,jsx,tsx}", // ✅ if you ever add pages here
    "./src/components/**/*.{js,ts,jsx,tsx}", // ✅ if you use components
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
