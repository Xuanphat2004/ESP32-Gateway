import MyRangeCalendar from "../InteractComponent/DataRangePicker";
import AvailabilityInfo from "../InteractComponent/AvailibilityInfo";
import MyLineChart from "../ChartComponents/LineChart2";
import { useState, useEffect } from "react";
import axios from "axios";
import dayjs from "dayjs"; // lib datetime using
import {
  alignItems,
  Box,
  display,
  flex,
  height,
  justifyContent,
  sizeHeight,
} from "@mui/system";
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
import DonutChart from "../ChartComponents/DonutChart";
import HandymanIcon from "@mui/icons-material/Handyman";
import ScreenshotMonitorIcon from "@mui/icons-material/ScreenshotMonitor";
import AccountBoxIcon from "@mui/icons-material/AccountBox";
import MyButton from "../InteractComponent/myButton";
import MyCalendar from "../InteractComponent/myCalendar";

const total = [
  { value: "1.2", method: "Capacity (MWp)" },
  { value: "6", method: "Production (MWh)" },
  { value: "6", method: "Capacity (MWp)" },
  { value: "80.15%", method: "PR" },
  { value: "6,266", method: "Irradiation (Wh/m²)" },
  { value: "5.0", method: "Yield (h)" },
  { value: "24.4", method: "	Lowest Temp. (℃)" },
  { value: "33.4", method: "Highest Temp. (℃)" },
  { value: "28.9", method: "Average Temp. (℃)" },
];

export default function OperationReport() {
  const option = ["Today","Daily", "Weakly", "Monthly", "Yearly"];
  const [time, setTime] = useState();
  const [pick, setPick] = useState("Daily");
  const handleChange = (event) => {
    setPick(event.target.value);
    setTime(event.target.value);
    console.log("Selected:", event.target.value);
  };
  const [selectedDate, setSelectedDate] = useState(dayjs());
  let theme = useTheme();
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        padding: "10px",
        gap: "10px"
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Box>
          <DropDownButton
            options={option}
            handleChange={handleChange}
            pick={pick}
          />
        </Box>
        
        <Box sx={{
          marginLeft: "40px",
        }}>
          <MyCalendar
            value={selectedDate}
            onChange={(newDate) => setSelectedDate(newDate)}
          />
        </Box>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          padding: "20px",
          
          backgroundColor: theme.palette.background.head_box,
          minHeight: "150px",
          width: "100%",
          overflow: "auto",
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
        <Box sx={{
          fontSize: "18px",
          paddingBottom: "5px",
          borderBottom: "1px solid darkgray",
          color: theme.palette.text.header_option
        }}>
          {selectedDate ? selectedDate.format("DD/MM/YYYY") : "Chưa chọn"}
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            gap: "60px",
            paddingTop: "5px",
          }}
        >
          {total.map((item) => {
            return (
              <Box
                sx={{
                  
                }}
              >
                <Box sx={{
                  fontSize: "18px",
                  color: theme.palette.text.header_option,
                  fontWeight: "bold"
                }}>{item.value}</Box>
                <Box sx={{color: theme.palette.text.option}}>{item.method}</Box>
              </Box>
            );
          })}
        </Box>
      </Box>
      <Box sx={{
        height: "300px",
        
      }}>
        <CombinedChart label="Production"/>
      </Box>
      <Box sx={{
        height: "300px",
        marginTop: "50px"
      }}>
        <MyLineChart label="Power Curve"/>
      </Box>
      <Box sx={{
        display: "flex",
        flexDirection: "row",
        flex: "wrap", 
        gap: "10px",
        marginTop: "20px"
      }}>
        <Box sx={{
          flex: "1",
          height: "300px"
        }}>
          <CombinedChart label="Inverter Production Top 10"/>  
        </Box>
        <Box sx={{
          flex: "1",
          height: "300px"
        }}>
          <CombinedChart label="Production Trend of Last 7 Days"/>
        </Box>
      </Box>
    </Box>
  );
}
