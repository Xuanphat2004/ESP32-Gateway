// src/theme.jsx
import { createTheme } from "@mui/material/styles";

export const getTheme = (mode) =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: mode === "dark" ? "#e53935" : "#c62828",
      },

      background: {
        default:     mode === "dark" ? "#0e1c2e"                : "#cfe0f0",
        paper:       mode === "dark" ? "rgba(8, 22, 60, 0.88)" : "rgba(255, 255, 255, 0.55)",
        option:      mode === "dark" ? "rgba(55, 50, 40, 0.80)": "rgba(210, 228, 248, 0.60)",
        string:      mode === "dark" ? "rgba(42, 38, 28, 0.75)": "rgba(190, 215, 238, 0.65)",
        head_string: mode === "dark" ? "#9c865d"               : "#3d5878",
        button:      mode === "dark" ? "rgba(15, 15, 15, 0.82)": "rgba(220, 235, 255, 0.65)",
        box:         mode === "dark" ? "rgba(22, 38, 72, 0.92)": "rgba(255, 255, 255, 0.55)",
        head_box:    mode === "dark" ? "rgba(45, 55, 90, 0.95)": "rgba(160, 200, 240, 0.45)",
      },

      text: {
        primary:       mode === "dark" ? "#e8e8e8"           : "#060f1a",
        secondary:     mode === "dark" ? "#b0b8c8"           : "#142030",
        header_option: mode === "dark" ? "rgb(210, 165, 15)" : "#051828",
        option:        mode === "dark" ? "rgb(175, 168, 12)" : "#0c2235",
        header_chart:  mode === "dark" ? "#b8a878"           : "#102236",
        body_chart:    mode === "dark" ? "#9c9595"           : "#080f18",
        button:        mode === "dark" ? "#f0ff80"           : "#1a56c4",
      },

      border: {
        box:    mode === "dark" ? "1px solid rgba(220, 20, 20, 0.30)" : "1px solid rgba(100, 150, 200, 0.35)",
        shadow: mode === "dark" ? "0px 4px 16px rgba(0,0,0,0.45)"    : "0px 4px 16px rgba(0, 60, 140, 0.12)",
      },

      table: {
        background_odd:  mode === "dark" ? "rgba(28, 48, 98, 0.72)" : "rgba(255, 255, 255, 0.45)",
        background_even: mode === "dark" ? "rgba(18, 35, 75, 0.65)" : "rgba(200, 225, 248, 0.45)",
        text:            mode === "dark" ? "#d8d8d8"                 : "#0f1f35",
      },
    },

    typography: mode === "light" ? {
      allVariants: { color: "#060f1a", fontWeight: 500 },
    } : {},

    // Gradient body background cho light mode (để thấy hiệu ứng trong suốt)
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: mode === "light" ? {
            background: "linear-gradient(145deg, #b8d4ec 0%, #cde3f5 40%, #bdd5ee 70%, #c8dff5 100%)",
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
            : "0px 4px 20px rgba(0, 60, 140, 0.15)"
          : "none"
      ),
  });
