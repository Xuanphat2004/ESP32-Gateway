// src/theme.jsx
import { createTheme } from "@mui/material/styles";

export const getTheme = (mode) =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: mode === "dark" ? "#cc0707ff" : "#a70808ff",  
      },

      background: {
        default: mode === "dark" ? "#1c344b" : "#fafafaff",
        paper:   mode === "dark" ? "rgb(5, 28, 78)" : "#def1f8ff",
        option:  mode === "dark" ? "#636155  " : "#c1d2e3",
        string:  mode === "dark" ? "#3e3a2f" : "#b6c9d6",
        head_string: mode === "dark" ? "#9c865d" : "#406280",
        button:      mode === "dark" ? "#121212" :"#cbe7ff",
        box:         mode === "dark" ? "rgba(55, 54, 46, 0.5)": "#F5F6F5",
        head_box:    mode === "dark" ? "rgba(78, 78, 65, 0.5)": "rgba(135, 195, 232, 0.5)",
      },
      
      text: {
        header_option: mode === "dark" ? "rgb(177, 137, 7)" : "#283593",
        option:        mode === "dark" ? "rgb(214, 211, 15)" : "#314ad6",
        header_chart:  mode === "dark" ? "#" : "#",
        body_chart:    mode === "dark" ? "#ffffff" : "#000000",
        button:        mode === "dark" ? "#f9ff99" : "#004eff",
      },

      border: {
        box:    mode === "dark" ? "1px solid #f10909ff	" : "1px solidrgb(217, 212, 204)",
        shadow: mode === "dark" ? "0px 2px 6px rgba(0,0,0,0.3)" : "0px 2px 6px rgba(255,255,255,0.1)",
      },

      table:{
        background_odd :  mode === "dark" ? "#222f5c" : "#e3f2fd",
        background_even : mode === "dark" ? "#1c344b" : "#bbdefb",
        text :            mode === "dark" ? "white" : "black"
      }
    },

    shadows: Array(25)
      .fill("none")
      .map((_, i) =>
        i === 1
          ? mode === "dark" ? "0px 2px 6px rgba(0,0,0,0.3)" : "0px 2px 6px rgba(255,255,255,0.1)": "none"
      ),
  });
