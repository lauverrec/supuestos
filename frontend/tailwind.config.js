/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        policial: {
          azul: "#1F3864",
          azulMedio: "#2E5FA3",
          azulClaro: "#D6E4F7",
          verde: "#1E5631",
          verdeClaro: "#D9EAD3",
          rojo: "#7B0000",
          rojoClaro: "#FADADD",
        }
      }
    },
  },
  plugins: [],
}