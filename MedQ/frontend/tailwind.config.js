/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        medqPink: "#FF8CC6", // primary color
        medqAltPink: "#D1236C", // alternative color
        medqDark: "#2D3047", // background gradient top (dark mode)
        medqDeep: "#6E75AD", // background gradient bottom (dark mode)
        // Light mode colors
        medqLightBg: "#F8FAFC", // light background
        medqLightCard: "#FFFFFF", // light card background
        medqLightText: "#1E293B", // light mode text
        medqLightMuted: "#64748B", // light mode muted text
      },
    },
  },
  plugins: [],
};
