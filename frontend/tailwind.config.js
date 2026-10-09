/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', '"Helvetica Neue"', "Arial", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "Menlo", "monospace"],
      },
      // Carbon Gray 100 theme tokens
      colors: {
        background: "#161616",
        layer: {
          1: "#262626",
          2: "#393939",
          hover1: "#333333",
          hover2: "#474747",
          active: "#525252",
        },
        border: {
          subtle: "#393939",
          strong: "#6f6f6f",
          field: "#8d8d8d",
          interactive: "#4589ff",
        },
        text: {
          primary: "#f4f4f4",
          secondary: "#c6c6c6",
          helper: "#a8a8a8",
          placeholder: "#6f6f6f",
          inverse: "#161616",
        },
        link: { DEFAULT: "#78a9ff", hover: "#a6c8ff" },
        btn: {
          primary: "#0f62fe",
          "primary-hover": "#0050e6",
          "primary-active": "#002d9c",
          secondary: "#6f6f6f",
          "secondary-hover": "#606060",
          danger: "#da1e28",
          "danger-hover": "#b81921",
          "danger-active": "#750e13",
        },
        support: {
          success: "#24a148",
          "success-text": "#42be65",
          error: "#fa4d56",
          warning: "#f1c21b",
          info: "#0043ce",
        },
        inverse: "#f4f4f4",
      },
      fontSize: {
        label: ["12px", { lineHeight: "16px", letterSpacing: "0.32px" }],
        body: ["14px", { lineHeight: "20px", letterSpacing: "0.16px" }],
        compact: ["14px", { lineHeight: "18px", letterSpacing: "0.16px" }],
      },
      transitionTimingFunction: {
        productive: "cubic-bezier(0.2, 0, 0.38, 0.9)",
        entrance: "cubic-bezier(0, 0, 0.38, 0.9)",
        exit: "cubic-bezier(0.2, 0, 1, 0.9)",
        expressive: "cubic-bezier(0.4, 0.14, 0.3, 1)",
      },
      transitionDuration: {
        70: "70ms",
        110: "110ms",
        240: "240ms",
      },
    },
  },
  plugins: [],
};
