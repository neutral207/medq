/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        medqPink: "#FF8CC6", // primary color
        medqDark: "#2D3047", // background gradient top
        medqDeep: "#6E75AD", // background gradient bottom
      },
    },
  },
  plugins: [],
};

