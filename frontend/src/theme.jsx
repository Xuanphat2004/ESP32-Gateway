// src/theme.jsx
import { createTheme } from "@mui/material/styles";

export const getTheme = (mode) =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: mode === "dark" ? "#e53935" : "#0d9488",
      },

      background: {
        default:     mode === "dark" ? "#0e1c2e"                : "#f0faf8",
        paper:       mode === "dark" ? "rgba(8, 22, 60, 0.88)" : "rgba(255, 255, 255, 0.96)",
        option:      mode === "dark" ? "rgba(55, 50, 40, 0.80)": "rgba(240, 253, 250, 0.92)",
        string:      mode === "dark" ? "rgba(42, 38, 28, 0.75)": "rgba(236, 253, 245, 0.88)",
        head_string: mode === "dark" ? "#9c865d"               : "#0f766e",
        button:      mode === "dark" ? "rgba(15, 15, 15, 0.82)": "rgba(255, 255, 255, 0.90)",
        box:         mode === "dark" ? "rgba(22, 38, 72, 0.92)": "rgba(255, 255, 255, 0.98)",
        head_box:    mode === "dark" ? "rgba(45, 55, 90, 0.95)": "rgba(255, 255, 255, 0.92)",
      },

      text: {
        primary:       mode === "dark" ? "#e8e8e8"           : "#0f172a",
        secondary:     mode === "dark" ? "#b0b8c8"           : "#374151",
        header_option: mode === "dark" ? "rgb(210, 165, 15)" : "#0f766e",
        option:        mode === "dark" ? "rgb(175, 168, 12)" : "#0d9488",
        header_chart:  mode === "dark" ? "#b8a878"           : "#134e4a",
        body_chart:    mode === "dark" ? "#9c9595"           : "#1e293b",
        button:        mode === "dark" ? "#f0ff80"           : "#0f766e",
      },

      border: {
        box:    mode === "dark" ? "1px solid rgba(220, 20, 20, 0.30)" : "1px solid rgba(13, 148, 136, 0.18)",
        shadow: mode === "dark" ? "0px 4px 16px rgba(0,0,0,0.45)"    : "0px 4px 16px rgba(15, 118, 110, 0.10)",
      },

      table: {
        background_odd:  mode === "dark" ? "rgba(28, 48, 98, 0.72)" : "rgba(255, 255, 255, 0.85)",
        background_even: mode === "dark" ? "rgba(18, 35, 75, 0.65)" : "rgba(236, 253, 245, 0.65)",
        text:            mode === "dark" ? "#d8d8d8"                 : "#0f172a",
      },
    },

    typography: mode === "light" ? {
      allVariants: { color: "#0f172a", fontWeight: 500 },
    } : {},

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: mode === "light" ? {
            background: "linear-gradient(145deg, #ccfbf1 0%, #e6fffa 30%, #f0fdf4 65%, #f0faf8 100%)",
            minHeight: "100vh",
            backgroundAttachment: "fixed",
          } : {},
        },
      },
    },

    shadows: Array(25)
      .fill("none")
      .map((_, i) =>
        i === 1
          ? mode === "dark"
            ? "0px 4px 16px rgba(0,0,0,0.45)"
            : "0px 4px 20px rgba(15, 118, 110, 0.12)"
          : "none"
      ),
  });
