import MyLineChart from "../ChartComponents/LineChart2";
import { useState, useEffect } from "react";
import axios from "axios";
import dayjs from "dayjs"; // lib datetime using
import { alignItems, display, flex, flexDirection, justifyContent, sizeHeight } from "@mui/system";
import { Box, Checkbox, IconButton, Menu, MenuItem, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import DropDownButton from "../InteractComponent/DropDownButton";
import CombinedChart from "../ChartComponents/CombineChart";
import ThermometerGaugeSVG from "../ChartComponents/ThermometerGaugeSVG";
import RowBar from "../ChartComponents/RowBar";
import IconDropDown from "../InteractComponent/IconDropDown";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ElectricBoltIcon from "@mui/icons-material/ElectricBolt";
import EnergySavingsLeafIcon from "@mui/icons-material/EnergySavingsLeaf";
import TocIcon from "@mui/icons-material/Toc";
import MarginIcon from "@mui/icons-material/Margin";
import SolarPowerIcon from "@mui/icons-material/SolarPower";
import SettingsIcon from "@mui/icons-material/Settings";

const inverter_yield = [
  { label: "Bk_1", value: "5" },
  { label: "Bk_2", value: "3.5" },
  { label: "Bk_3", value: "3" },
  { label: "Bk_4", value: "2" },
  { label: "Bk_5", value: "4.5" },
  { label: "Bk_6", value: "3.9" },
  { label: "Bk_7", value: "4" },
  { label: "Bk_8", value: "5" },
  { label: "Bk_9", value: "4.2" },
  { label: "Bk_10", value: "3.8" },
];

const production = [
  { label: "Bk_1", value: "534.5" },
  { label: "Bk_2", value: "578.6" },
  { label: "Bk_3", value: "523.3" },
  { label: "Bk_4", value: "456.3" },
  { label: "Bk_5", value: "498.9" },
  { label: "Bk_6", value: "590.4" },
  { label: "Bk_7", value: "596.1" },
  { label: "Bk_8", value: "472.4" },
  { label: "Bk_9", value: "434.2" },
  { label: "Bk_10", value: "390.6" },
];

function SiteKPI() {
  let date = Date();
  const [BarData, setBarData] = useState([]);
  const [dateCalendar, setDateCalendar] = useState(dayjs(date));

  const theme = useTheme();

  const path_bar = `http://localhost:8000/solardb/avr-data/`;
  const path_line = `http://localhost:8000/solardb/`;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const reponse = await axios.get(path_bar);
        setBarData(reponse.data);
      } catch (err) {
        console.error("LOI KHI GOI API: ", err);
      }
    };

    fetchData();

    const interval = setInterval(fetchData, 3000);

    return () => clearInterval(interval);
  }, []);
  const option = [
    "Today",
    "MTD",
    "YTD",
    "Total",
    "Last 7 days",
    "Last 30 days",
  ];
  const [pick, setPick] = useState("Today");
  const handleChange = (event) => {
    setPick(event.target.value);
    console.log("Selected:", event.target.value);
  };

  const option2 = [
    "Real-Time Perfomance",
    "Inveter Output Power Deviation",
    "Production",
    "Yield",
  ];
  const [pick2, setPick2] = useState("Yield");
  const handleChange2 = (event) => {
    setPick2(event.target.value);
    console.log("Selected:", event.target.value);
  };

  //------------Xử lí chọn mục hiển thị trong Site Metrics-------------//
  const allMetrics = [
    { label: "Production", icon: <ElectricBoltIcon />, value: "2.44 MWh" },
    { label: "Yield", icon: <AccessTimeIcon />, value: "2.1 h" },
    { label: "Revenue", icon: <TocIcon />, value: "2.2 K CNY" },
    { label: "CO₂ Reduction", icon: <EnergySavingsLeafIcon />, value: "5 t" },
    { label: "Purchased Energy", icon: <ElectricBoltIcon />, value: "3.5 MWh" },
  ];

  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedMetrics, setSelectedMetrics] = useState([
    "Production",
    "Yield",
    "Revenue"
  ]);

  const handleToggle = (metric) => {
    setSelectedMetrics((prev) =>
      prev.includes(metric)
        ? prev.filter((m) => m !== metric)
        : [...prev, metric]
    );
  };

  const open = Boolean(anchorEl);
  //--------------------------------------------------------------------//

  return (
    <Box
      sx={{
        padding: "20px",
        display: "flex",
        flexWrap: "wrap",
        gap: "20px",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flex: 2,
          flexDirection: "column",
          gap: "20px",
          width: {
            xs: "100%",
            sm: "48%",
            md: "32%",
          },
        }}
      >
        {/*Today*/}
        <Box
          style={{
            height: "298px",
            backgroundColor: theme.palette.background.box,
          }}
        >
          <Box
            style={{
              display: "flex",
              justifyContent: "flex-start",
              backgroundColor: theme.palette.background.head_box,
            }}
          >
            <DropDownButton
              options={option}
              handleChange={handleChange}
              pick={pick}
            />
          </Box>
          <Box
            style={{
              display: "flex",
              justifyContent: "center",
              fontSize: "30px",
              marginTop: "40px",
            }}
          >
            Bach khoa
          </Box>
          <Box
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-around",
              marginTop: "30px",
            }}
          >
            <Box
              sx={{
                borderLeft: "2px",
                borderLeftColor: "yellow",
              }}
            >
              <Box style={{ fontSize: "30px", textAlign: "center" }}>
                37
              </Box>
              <Box
                style={{
                  textAlign: "center",
                }}
              >
                Temperature
              </Box>
            </Box>
            <Box>
              <Box style={{ fontSize: "30px", textAlign: "center" }}>
                0 Wm/h
              </Box>
              <Box
                style={{
                  textAlign: "center",
                }}
              >
                Irradiance
              </Box>
            </Box>
          </Box>
        </Box>
        {/*C&I Self-consumption*/}
        <Box
          style={{
            height: "190px",
            backgroundColor: theme.palette.background.box,
          }}
        >
          <Box
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-around",
              alignItems: "center",
              height: "40px",
              backgroundColor: theme.palette.background.head_box,
            }}
          >
            <Box style={{ fontWeight: "bold", fontSize: "16px", color: theme.palette.text.header_option, }}>
              C&I Self-consumption
            </Box>
            <Box style={{ fontWeight: "bold", fontSize: "16px", color: theme.palette.text.header_option, }}>Normal</Box>
          </Box>

          <Box
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-around",
              marginTop: "30px",
            }}
          >
            <Box>
              <Box
                style={{
                  textAlign: "center",
                }}
              >
                Active Power
              </Box>
              <Box style={{ fontSize: "30px", textAlign: "center" }}>{}0W </Box>
            </Box>
            <Box>
              <Box
                style={{
                  textAlign: "center",
                }}
              >
                Capacity
              </Box>
              <Box style={{ fontSize: "30px", textAlign: "center" }}>
                {}1.19 MWp
              </Box>
            </Box>
          </Box>
        </Box>
        {/*Production*/}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            backgroundColor: theme.palette.background.box,
          }}
        >
          <Box
            sx={{
              height: "40px",
              backgroundColor: theme.palette.background.head_box,
              fontWeight: "bold",
              fontSize: "16px",
              display: "flex",
              alignItems: "center",
              color: theme.palette.text.header_option, 
              paddingLeft: "20px"
            }}
          >
            Production
          </Box>
          <Box
            sx={{
              // flex: 1,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              padding: "50px 30px",
            }}
          >
            {/* Dòng 1: Label + Icon + Value */}
            <Box
              sx={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: "30px",
              }}
            >
              <Box sx={{ fontSize: "16px", color: "white", }}>Inverter</Box>
              <Box
                sx={{
                  position: "absolute",
                  left: "50%",
                  transform: "translateX(-50%)",
                }}  
              >
                <SolarPowerIcon sx={{ fontSize: "32px", color: "#00c0ff", }} />
              </Box>
              <Box sx={{ fontSize: "16px", color: "white", }}>4.33 MWh</Box>
            </Box>

            {/* Dòng 2: Dấu gạch đứt + % chênh lệch */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                position: "relative",
                mb: "30px",
              }}
            >
              {/* Đường gạch đứt */}
              <Box
                sx={{
                  borderLeft: "2px dashed #00c0ff",
                  height: "20px",
                  marginBottom: "50px",
                }}
              />
              {/* Phần trăm */}
              <Box
                sx={{
                  position: "absolute",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#00c0ff",
                  fontSize: "14px",
                  // backgroundColor: theme.palette.background.box,
                  padding: "2px 6px",
                }}
              >
                -0.52%
              </Box>
              {/* Đường gạch đứt */}
              <Box
                sx={{
                  borderLeft: "2px dashed #00c0ff",
                  height: "20px",
                  marginTop: "50px",
                }}
              />
            </Box>

            {/* Dòng 3: Label + Icon + Value */}
            <Box
              sx={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Box sx={{ fontSize: "16px", color: "white", }}>Energy Meter</Box>
              <Box
                sx={{
                  position: "absolute",
                  left: "50%",
                  transform: "translateX(-50%)",
                }}
              >
                <MarginIcon sx={{ fontSize: "32px", color: "#00c0ff", }} />
              </Box>
              <Box sx={{ fontSize: "16px", color: "white", }}>4.31 MWh</Box>
            </Box>
          </Box>
        </Box>
      </Box>
      {/*Column 2*/}
      <Box
        sx={{
          flex: 4,
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          width: {
            xs: "100%",
            sm: "48%",
            md: "32%",
          },
        }}
      >
        <Box
          style={{
            backgroundColor: theme.palette.background.box,
            height: "298px",
          }}
        >
          {" "}
          <CombinedChart label="Production & Irradiation" />
        </Box>
        {/*Yield and Site Metrics*/}
        <Box
          style={{
            display: "flex",
            flexDirection: "row",
            height: "190px",
            gap: "20px",
          }}
        >
          {/*Yield*/}
          <Box
            style={{
              flex: 1,
            }}
          >
            <Box
              style={{
                backgroundColor: theme.palette.background.head_box,
                height: "40px",
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                color: theme.palette.text.header_option,
              }}
            >
              <Box style={{marginLeft: "20px"}}>{pick2}</Box>
              <Box>
                <IconDropDown
                  options={option2}
                  handleChange={handleChange2}
                  pick={pick2}
                />
              </Box>
            </Box>
            <Box
              style={{
                backgroundColor: theme.palette.background.box,
                height: "150px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {" "}
              <ThermometerGaugeSVG
                // value={latestdata ? latestdata.temp.toFixed(1) : "--"}
                value={50}
                max={70}
                unit="h"
                size={100}
              />
            </Box>
          </Box>
          {/*Site Metrics*/}
          <Box
            style={{
              flex: "1",
            }}
          >
            {/* Header */}
            <Box
              style={{
                backgroundColor: theme.palette.background.head_box,
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: theme.palette.text.header_option,
                paddingLeft: "20px",
                paddingRight: "10px",
              }}
            >
              <Typography variant="body1">Site Metrics</Typography>
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
                <SettingsIcon sx={{ color: theme.palette.text.header_option }} />
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={() => setAnchorEl(null)}
                PaperProps={{ 
                  sx: { 
                    color: theme.palette.text.header_option, 
                    border: `1px solid ${theme.palette.text.header_option}`, 
                  }
                }}
              >
                {allMetrics.map((metric) => (
                  <MenuItem
                    key={metric.label}
                    onClick={() => handleToggle(metric.label)}
                    dense
                  >
                    <Checkbox
                      checked={selectedMetrics.includes(metric.label)}
                      sx={{ color: theme.palette.text.header_option }}
                    />
                    <Typography variant="body2">{metric.label}</Typography>
                  </MenuItem>
                ))}
              </Menu>
            </Box>

            {/* Body */}
            <Box
              sx={{
                backgroundColor: theme.palette.background.box,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                padding: "20px",
                height: "150px",
                overflowY: "auto",

                // Hiện khi hover và custom giao diện
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: 'transparent',
                  borderRadius: '4px',
                },

                // Hover thì hiện scrollbar
                '&:hover::-webkit-scrollbar-thumb': {
                  backgroundColor: theme.palette.background.head_box,
                },
                '&:hover::-webkit-scrollbar-track': {
                  backgroundColor: 'transparent',
                },
              }}
            >
              {allMetrics
                .filter((m) => selectedMetrics.includes(m.label))
                .map((m) => (
                  <Box
                    key={m.label}
                    sx={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <Box sx={{ flex: 2, fontSize: 14}}>{m.label}</Box>
                    <Box sx={{ flex: 1, fontSize: 14}}>{m.icon}</Box>
                    <Box sx={{ flex: 1, fontSize: 14}}>{m.value}</Box>
                  </Box>
                ))}
            </Box>
          </Box>
          {/*End Site Metrics*/}
        </Box>
        {/*End Yield and Site Metrics*/}

        {/*Active Power & Irradiance*/}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              flex: 1,
              backgroundColor: theme.palette.background.box,
            }}
          >
            {" "}
            {BarData.length > 0 && (
              <MyLineChart
                linedata={BarData}
                linekey1={Object.keys(BarData[0])[1]}
                linekey2={Object.keys(BarData[0])[2]}
                label="Active Power & Irradiance"
              />
            )}
          </Box>
        </Box>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <Box sx={{height: "298px"}}>
          <Box
            style={{
              backgroundColor: theme.palette.background.head_box,
              height: "40px",
              color: theme.palette.text.header_option,
              display: "flex",
              alignItems: "center",
              paddingLeft: "20px"
            }}
          >
            Inverter Yield Ranking
          </Box>
          <Box
            sx={{
              height: "258px",
              overflow: "auto",
              backgroundColor: theme.palette.background.box,
              padding: "10px",
              overflowY: "auto",
              // Hiện khi hover và custom giao diện
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'transparent',
                borderRadius: '4px',
              },

              // Hover thì hiện scrollbar
              '&:hover::-webkit-scrollbar-thumb': {
                backgroundColor: theme.palette.background.head_box,
              },
              '&:hover::-webkit-scrollbar-track': {
                backgroundColor: 'transparent',
              },
            }}
          >
            {inverter_yield.map((item, index) => (
              <RowBar
                key={index}
                label={item.label}
                value={parseFloat(item.value)}
                maxvalue={5}
                maxwidth={250}
                maxheight={6}
                unit="h"
              />
            ))}
          </Box>
        </Box>
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            style={{
              backgroundColor: theme.palette.background.head_box,
              height: "40px",
              color: theme.palette.text.header_option,
              display: "flex",
              alignItems: "center",
              paddingLeft: "20px"
            }}
          >
            Inverter Production
          </Box>
          <Box
            sx={{
              // height: "498px",
              flex: 1, 
              overflow: "auto",
              backgroundColor: theme.palette.background.box,
              padding: "10px",
              overflowY: "auto",
              // Hiện khi hover và custom giao diện
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'transparent',
                borderRadius: '4px',
              },
              // Hover thì hiện scrollbar
              '&:hover::-webkit-scrollbar-thumb': {
                backgroundColor: theme.palette.background.head_box,
              },
              '&:hover::-webkit-scrollbar-track': {
                backgroundColor: 'transparent',
              },
            }}
          >
            {inverter_yield.map((item, index) => (
              <RowBar
                key={index}
                label={item.label}
                value={parseFloat(item.value)}
                maxvalue={5}
                maxwidth={250}
                maxheight={6}
                unit="h"
              />
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
export default SiteKPI;
