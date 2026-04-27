import React from "react";
import SiteCard from "../DataComponents/listviewcard";
import { Grid, Box } from "@mui/system";
import { useTheme } from "@mui/material/styles";
import myButton from "../InteractComponent/myButton";

export default function SiteList() {
  const theme = useTheme();

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", }}>
      <div
        style={{
          height: "120px",
          position: "fixed",
          width: "100%",
          color: theme.palette.text.option,
          borderBottom: "1px solid #ccc",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          flexShrink: 0,
          zIndex: 1000,
          backdropFilter: "blur(50px)",
          fontSize: "25px",
        }}
      >
        LIST OF SITECARD
      </div>

      <div
        style={{
          overflowY: "auto",
          marginTop: "120px",
          display: "flex",
          alignContent: "space-evenly",
          flexWrap: "wrap",
          // backgroundColor: "red",
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <Box
            key={i}
            sx={{
              minWidth: "450px",
              margin: "20px",
            }}
          >
            <SiteCard name={"20"} cardname={i===1? "chart-data" : null} cardlabel={i===1? "PTN209B3" : "--"} />
          </Box>
        ))}
      </div>
    </div>
  );
}
