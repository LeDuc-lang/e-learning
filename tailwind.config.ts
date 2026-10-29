
import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: "#1B4332", // Vert forêt profond
          light: "#2D6A4F",
        },
        sage: {
          DEFAULT: "#74A18E", // Vert sauge doux
          light: "#D8E2DC", // Sauge très clair
        },
        offwhite: "#FAF9F6", // Blanc cassé chaleureux
        subtle: "#F3F4F6", // Gris clair
      },
    },
  },
  plugins: [],
};

export default config;
