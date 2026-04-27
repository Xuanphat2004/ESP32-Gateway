
import React, { useEffect, useState } from "react";
import { Box } from "@mui/material";
import { Link } from "react-router-dom";
import ThermometerGaugeSVG from "../ChartComponents/ThermometerGaugeSVG";
import axios from "axios";

export default function MyFleetView() {
  const [nowdata, setNowData] = useState([]);
  const path = `http://localhost:8000/solardb/chart-data/`;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(path);
        setNowData(response.data);
      } catch (err) {
        console.error("LOI KHI GOI API: ", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const latestdata = nowdata.length > 0 ? nowdata[nowdata.length - 1] : null;

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
      }}
    >
      {/* MAP */}
      <Box sx={{ flex: 1.5, minHeight: "300 px" }}>
        <iframe
          src="https://www.google.com/maps/embed?pb=..."
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
        ></iframe>
      </Box>

      {/* Info Panel */}
      <Box
        sx={{
          flex: 1,
          backgroundImage: 'url("/image/solar_image.jpg")',
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          position: "relative",
        }}
      >
        {/* Overlay mờ */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(36, 27, 13, 0.6)",
            zIndex: 1,
          }}
        />

        {/* Content */}
        <Box
          sx={{
            position: "relative",
            zIndex: 2,
            height: "100%",
            p: 2,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              backgroundColor: "rgba(128, 128, 128, 0.5)",
              p: 2,
              borderRadius: 1,
              width: "100%",
            }}
          >
            <Box sx={{ color: "#d4bfa3", justifyContent: "center" }}>
              Total Site:{" "}
              {/* <b style={{ color: "#08ffff", fontSize: "25px" }}>1</b> */}
            </Box>
            <Box sx={{ color: "#d4bfa3"}}>Total Sites</Box>
            <Link to="/sitelist" style={{ textDecoration: "none" }}>
              <Box
                sx={{
                  color: "#d4bfa3",
                  "&:hover": { color: "#08ffff" },
                }}
              >
                Site List
              </Box>
            </Link>
          </Box>

          <Box
            sx={{
              backgroundColor: "rgba(128, 128, 128, 0.5)",
              p: 2,
              borderRadius: 1,
              mt: 2,
              color: "#d4bfa3",
            }}
          >
            Location: Bach khoa University
          </Box>
          <Box
            sx={{
              backgroundColor: "rgba(128, 128, 128, 0.5)",
              p: 2,
              borderRadius: 1,
              mt: 2,
              color: "#d4bfa3",
              height: "100%",
            }}
          >
            <Box
              sx={{ display: "flex", justifyContent: "space-around", mt: 4 }}
            >
              <ThermometerGaugeSVG
                value={latestdata ? latestdata.active_power.toFixed(1) : "--"}
                label="ACTIVE_POWER"
                max={700}
                unit="W"
              />
              <ThermometerGaugeSVG
                value={latestdata ? latestdata.irradiance.toFixed(1) : "--"}
                label="IRRADIANCE"
                max={10}
                unit="W/m²"
              />
            </Box>

            <Box
              sx={{
                display: "flex",
                justifyContent: "space-around",
                mt: 4,
                marginTop: "120px",
              }}
            >
              <ThermometerGaugeSVG
                value={latestdata ? latestdata.temp.toFixed(1) : "--"}
                label="TEMPERATURE"
                max={70}
                unit="°C"
              />
              <ThermometerGaugeSVG
                value={
                  latestdata?.active_power
                    ? ((latestdata.active_power / 1090) * 100).toFixed(2)
                    : "--"
                }
                label="RATIO"
                max={100}
                unit="%"
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
