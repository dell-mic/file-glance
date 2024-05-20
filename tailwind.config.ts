import type { Config } from "tailwindcss";
import withMT from "@material-tailwind/react/utils/withMT"


const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-roboto)'],
        mono: ['var(--font-roboto-mono)'],
      },
    },
  },
  plugins: [],
};
export default withMT(config);
