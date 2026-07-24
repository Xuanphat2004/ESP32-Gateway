import StringTable from "../TableDevice/StringTable";
import { Box, height, margin, sizeHeight, width } from "@mui/system";
import Tooltip from "@mui/material/Tooltip";
import { useTheme } from "@mui/material/styles";
import { useState } from "react";
import { Button } from "@mui/material";
import InverterFilter from "../InteractComponent/InverterFilter";

const inverter = [
  {
    inverter1: [
      { string1: "2.4" },
      { string2: "2.4" },
      { string3: "2.4" },
      { string4: "2.4" },
      { string5: "2.4" },
      { string6: "2.4" },
      { string7: "2.4" },
    ],
  },

  {
    inverter2: [
      { string1: "2.4" },
      { string2: "2.4" },
      { string3: "2.4" },
      { string4: "2.4" },
      { string5: "2.4" },
      { string6: "2.4" },
      { string7: "2.4" },
      { string8: "2.4" },
      { string9: "2.4" },
      { string10: "2.4" },
      { string11: "2.4" },
      { string12: "2.4" },
    ],
  },

  {
    inverter3: [
      { string1: "2.4" },
      { string2: "2.4" },
      { string3: "2.4" },
      { string4: "2.4" },
      { string5: "2.4" },
      { string6: "2.4" },
      { string7: "2.4" },
      { string8: "2.4" },
      { string9: "2.4" },
      { string10: "2.4" },
      { string11: "2.4" },
      { string12: "2.4" },
      { string13: "2.4" },
      { string14: "2.4" },
      { string15: "2.4" },
      { string16: "2.4" },
      { string17: "2.4" },
      { string18: "2.4" },
    ],
  },

  {
    inverter4: [
      { string1: "2.4" },
      { string2: "2.4" },
      { string3: "2.4" },
      { string4: "2.4" },
      { string5: "2.4" },
      { string6: "2.4" },
      { string7: "2.4" },
      { string8: "2.4" },
      { string9: "2.4" },
      { string10: "2.4" },
      { string11: "2.4" },
      { string12: "2.4" },
    ],
  },
  {
    inverter5: [
      { string1: "2.4" },
      { string2: "2.4" },
      { string3: "2.4" },
      { string4: "2.4" },
      { string5: "2.4" },
    ],
  },
];

const Topo = () => {
  let theme = useTheme();

  const buttons = inverter.map((item) => Object.keys(item)[0]);

  const [selectedLabel, setSelectedLabel] = useState(buttons[0]);
  const [strings, setStrings] = useState(inverter[0][buttons[0]]);
  // const [topo, setTopo] = useState("inverter1");

  const handleClick = (label) => () => {
    setSelectedLabel(label);
    const found = inverter.find((item) => item[label]);
    setStrings(found ? found[label] : []);
  }


  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
      }}
    >
      <Box
        sx={{
          flex: 6,
          display: "flex",
          flexWrap: "wrap",
          flexDirection: "column",
          borderRightWidth: "1px",
          borderRightStyle: "solid",
          borderRightColor: theme.palette.background.head_box,
          padding: "10px",
          gap: "10px",
        }}
      >
        <Box
          sx={{
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            marginLeft: "8px",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: "10px", }}>
            <div style={{}}>Search Device</div>
            <input style={{ color: theme.palette.text.primary, backgroundColor: theme.palette.background.box, }}></input>
            <input style={{ color: theme.palette.text.primary, backgroundColor: theme.palette.background.box, }}></input>
          </Box>
          <Box>
            <InverterFilter/>
          </Box>
        </Box>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
          }}
        >
          {buttons.map((label) => (
            <Button
              key={label}
              variant="outlined"
              onClick={handleClick(label)}
              sx={{
                height: "60px",
                width: "90px",
                margin: "8px",
                color: theme.palette.text.header_option,
                borderColor: theme.palette.text.header_option,
                backgroundColor: selectedLabel === label ? theme.palette.background.option : "transparent",
                "&:hover": {
                  backgroundColor: "#d1cfcf",
                },
              }}
            >
              {label}
            </Button>
          ))}
        </Box>
      </Box>
      <Box
        sx={{
          flex: 2,
          display: "flex",
          flexDirection: "column",
          padding: "10px",
          gap: "10px",
        }}
      >
        <Box
          sx={{
            flex: 1,
          }}
        >
          <div style={{ fontSize: "18px", fontWeight: "bold", color: theme.palette.text.header_option, }}>{selectedLabel}</div>
          <div>String Inverter | Night State</div>
          <div>Deviation: --</div>
          <div>Internal Temp: -- ℃</div>
          <div>Efficiency: -- %</div>
        </Box>
        <Box
          sx={{
            flex: 2,
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          {strings.map((item, idx) => {
            const key = Object.keys(item)[0];
            const value = item[key];
            return (
              <Box
                key={idx}
                variant="outlined"
                sx={{
                  height: "60px",
                  width: "100px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: theme.palette.text.header_option,
                  borderColor: theme.palette.text.header_option,
                  backgroundColor: theme.palette.background.option,
                  "&:hover": {
                    backgroundColor: "#d1cfcf",
                  },
                }}
              >
                {key}: {value}
              </Box>
            )
          })}
        </Box>
      </Box>
    </Box>
  );
};

const Stringstate = () => {
  let theme = useTheme()
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flexWrap: "wrap",
        gap: 1,
      }}
    >
      <Box
        sx={{
          fontSize: "14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px",
          gap: "10px",
        }}
      >
        <div>
          Search Device
          <input style={{ backgroundColor: theme.palette.background.box, marginLeft: "10px", }}></input>
        </div>
        <div>
          Sort
          <input style={{ backgroundColor: theme.palette.background.box, marginLeft: "10px", }}></input>
        </div>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          padding: "10px",
          gap: "10px"
        }}
      >
        {inverter.map((item, index) => {
          const key = Object.keys(item)[0];
          const value = item[key];

          return (
            <Box
              key={index}
              sx={{
                p: 2,
                borderRadius: 3,
                width: {
                  xs: "100%",
                  md: "48%",
                },
                maxHeight: "500px",
                backgroundColor: theme.palette.background.box,
                boxShadow: "0 4px 6px rgba(19, 16, 16, 0.1)",
              }}
            >
              <StringTable stringname={key} stringlist={value} />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

const Topology = () => {
  let theme = useTheme();
  let [mode, setMode] = useState("topo");
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        padding: 2,
        gap: "10px",
      }}
    >
      <Box
        sx={{
          display: "flex",
          width: "100%",
          height: "40px",
          justifyContent: "flex-start",
          alignItems: "center",
          backgroundColor: theme.palette.background.head_box,
          fontSize: "14px",
        }}
      >
        <Box sx={{ padding: "10px", }}>
          Capacity: 1.19 MWp
        </Box>
        <Box sx={{ padding: "10px", }}>
          Active Power: 348 kW
        </Box>
        <Box sx={{ padding: "10px", }}>
          Yield: 3.92 h
        </Box>
        <Box sx={{ padding: "10px", }}>
          Irradiance: 0 W/m²
        </Box>
      </Box>
      <Box
        sx={{
          backgroundColor: theme.palette.background.head_box,
        }}
      >
        <Button
          onClick={() => setMode("topo")}
          sx={{
            color: theme.palette.text.header_option,
            borderColor: theme.palette.text.header_option,
            backgroundColor: mode === "topo" ? theme.palette.background.option : "transparent",
            "&:hover": {
              backgroundColor: "#d1cfcf",
            },
          }}
        >
          Topology Analysis
        </Button>
        <Button
          onClick={() => setMode("string")}
          sx={{
            color: theme.palette.text.header_option,
            borderColor: theme.palette.text.header_option,
            backgroundColor: mode === "string" ? theme.palette.background.option : "transparent",
            "&:hover": {
              backgroundColor: "#d1cfcf",
            },
          }}
        >
          String State
        </Button>
      </Box>
      <Box
        sx={{
          // height: "100vh",
          backgroundColor: theme.palette.background.box,
        }}
      >
        {mode === "topo" ? <Topo /> : <Stringstate />}
      </Box>
    </Box>
  );
};

export default Topology;
