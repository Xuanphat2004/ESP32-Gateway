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
        default:     mode === "dark" ? "#0e1c2e"                    : "#eaf3fb",
        paper:       mode === "dark" ? "rgba(8, 22, 60, 0.88)"      : "rgba(205, 232, 248, 0.90)",
        option:      mode === "dark" ? "rgba(55, 50, 40, 0.80)"     : "#c0d8e8",
        string:      mode === "dark" ? "rgba(42, 38, 28, 0.75)"     : "#adc5d5",
        head_string: mode === "dark" ? "#9c865d"                    : "#3d5f7a",
        button:      mode === "dark" ? "rgba(15, 15, 15, 0.82)"     : "rgba(200, 228, 255, 0.90)",
        box:         mode === "dark" ? "rgba(22, 38, 72, 0.92)"     : "rgba(242, 248, 255, 0.97)",
        head_box:    mode === "dark" ? "rgba(45, 55, 90, 0.95)"     : "rgba(130, 192, 230, 0.92)",
      },

      text: {
        header_option: mode === "dark" ? "rgb(210, 165, 15)"  : "#1a237e",
        option:        mode === "dark" ? "rgb(175, 168, 12)"  : "#283593",
        header_chart:  mode === "dark" ? "#b8a878"            : "#2a4060",
        body_chart:    mode === "dark" ? "#9c9595"            : "#1a1a1a",
        button:        mode === "dark" ? "#f0ff80"            : "#003ee0",
      },

      border: {
        box:    mode === "dark" ? "1px solid rgba(220, 20, 20, 0.30)"  : "1px solid rgba(170, 185, 200, 0.65)",
        shadow: mode === "dark" ? "0px 4px 16px rgba(0,0,0,0.45)"     : "0px 4px 16px rgba(0,80,180,0.14)",
      },

      table: {
        background_odd:  mode === "dark" ? "rgba(28, 48, 98, 0.72)"  : "#e3f2fd",
        background_even: mode === "dark" ? "rgba(18, 35, 75, 0.65)"  : "#bbdefb",
        text:            mode === "dark" ? "#d8d8d8"                  : "#1a1a1a",
      },
    },

    shadows: Array(25)
      .fill("none")
      .map((_, i) =>
        i === 1
          ? mode === "dark"
            ? "0px 4px 16px rgba(0,0,0,0.45)"
            : "0px 4px 16px rgba(0,80,180,0.14)"
          : "none"
      ),
  });
