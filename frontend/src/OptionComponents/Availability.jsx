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
function Availability() {
  let theme = useTheme();
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        padding: "10px",
        gap: "20px",
      }}
    >
      {/*row 1*/}
      <Box
        sx={{
          flex: "1",
        }}
      >
        <MyRangeCalendar />
      </Box>
      {/*row 2*/}
      <Box
        sx={{
          flex: "3",
          display: "flex",
          flexDirection: "row",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            flex: 2,
            gap: "10px",
          }}
        >
          <Box
            sx={{
              display: "flex",
              flex: 1,
              background: theme.palette.background.box,
            }}
          >
            <AvailabilityInfo
              symbol={
                <HandymanIcon
                  style={{
                    fontSize: "50px",
                  }}
                />
              }
              value={"99.35%"}
              label={"Operational"}
            />
          </Box>
          <Box
            sx={{
              display: "flex",
              flex: 1,
              background: theme.palette.background.box,
            }}
          >
            <AvailabilityInfo
              symbol={
                <ScreenshotMonitorIcon
                  style={{
                    fontSize: "50px",
                  }}
                />
              }
              value={"99.35%"}
              label={"Technical"}
            />
          </Box>
          <Box
            sx={{
              display: "flex",
              flex: 1,
              background: theme.palette.background.box,
            }}
          >
            <AvailabilityInfo
              symbol={
                <AccountBoxIcon
                  style={{
                    fontSize: "50px",
                  }}
                />
              }
              value={"100%"}
              label={"Customized"}
            />
          </Box>
        </Box>
        <Box
          sx={{
            flex: 5,
          }}
        >
          <DonutChart />
        </Box>
      </Box>
      {/*row 3*/}
      <Box>
        {/* <MyLineChart label="Operational & Technical & Customized" /> */}
        <StatusLineChart />
      </Box>
    </Box>
  );
}

export default Availability;

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

const data = [
  { date: "2025/01/01", operational: 100, technical: 100, customized: 100 },
  { date: "2025/01/15", operational: 100, technical: 95, customized: 100 },
  { date: "2025/01/25", operational: 100, technical: 65, customized: 100 },
  { date: "2025/03/15", operational: 100, technical: 98, customized: 100 },
  { date: "2025/05/11", operational: 100, technical: 80, customized: 100 },
  { date: "2025/06/30", operational: 100, technical: 100, customized: 100 },
  { date: "2025/01/01", operational: 100, technical: 100, customized: 100 },
  { date: "2025/01/15", operational: 100, technical: 95, customized: 100 },
  { date: "2025/01/25", operational: 100, technical: 95, customized: 100 },
  { date: "2025/03/15", operational: 100, technical: 98, customized: 100 },
  { date: "2025/05/11", operational: 100, technical: 10, customized: 100 },
  { date: "2025/06/30", operational: 100, technical: 100, customized: 95 },
  { date: "2025/01/01", operational: 100, technical: 100, customized: 100 },
  { date: "2025/01/15", operational: 100, technical: 95, customized: 100 },
  { date: "2025/01/25", operational: 100, technical: 65, customized: 100 },
  { date: "2025/03/15", operational: 100, technical: 98, customized: 100 },
  { date: "2025/05/11", operational: 100, technical: 90, customized: 100 },
  { date: "2025/06/30", operational: 100, technical: 100, customized: 90 },
  { date: "2025/01/01", operational: 100, technical: 100, customized: 100 },
  { date: "2025/01/15", operational: 100, technical: 95, customized: 100 },
  { date: "2025/01/25", operational: 100, technical: 95, customized: 100 },
  { date: "2025/03/15", operational: 100, technical: 98, customized: 100 },
  { date: "2025/05/11", operational: 100, technical: 90, customized: 100 },
  { date: "2025/06/30", operational: 100, technical: 100, customized: 90 },
    { date: "2025/01/01", operational: 100, technical: 100, customized: 100 },
  { date: "2025/01/15", operational: 100, technical: 95, customized: 100 },
  { date: "2025/01/25", operational: 100, technical: 65, customized: 100 },
  { date: "2025/03/15", operational: 100, technical: 98, customized: 100 },
  { date: "2025/05/11", operational: 100, technical: 80, customized: 100 },
  { date: "2025/06/30", operational: 100, technical: 100, customized: 100 },
  { date: "2025/01/01", operational: 100, technical: 100, customized: 100 },
  { date: "2025/01/15", operational: 100, technical: 95, customized: 100 },
  { date: "2025/01/25", operational: 100, technical: 95, customized: 100 },
  { date: "2025/03/15", operational: 100, technical: 98, customized: 100 },
  { date: "2025/05/11", operational: 100, technical: 10, customized: 100 },
  { date: "2025/06/30", operational: 100, technical: 100, customized: 95 },
  { date: "2025/01/01", operational: 100, technical: 100, customized: 100 },
  { date: "2025/01/15", operational: 100, technical: 95, customized: 100 },
  { date: "2025/01/25", operational: 100, technical: 65, customized: 100 },
  { date: "2025/03/15", operational: 100, technical: 98, customized: 100 },
  { date: "2025/05/11", operational: 100, technical: 90, customized: 100 },
  { date: "2025/06/30", operational: 100, technical: 100, customized: 90 },
  { date: "2025/01/01", operational: 100, technical: 100, customized: 100 },
  { date: "2025/01/15", operational: 100, technical: 95, customized: 100 },
  { date: "2025/01/25", operational: 100, technical: 95, customized: 100 },
  { date: "2025/03/15", operational: 100, technical: 98, customized: 100 },
  { date: "2025/05/11", operational: 100, technical: 90, customized: 100 },
  { date: "2025/06/30", operational: 100, technical: 100, customized: 90 },
    { date: "2025/01/01", operational: 100, technical: 100, customized: 100 },
  { date: "2025/01/15", operational: 100, technical: 95, customized: 100 },
  { date: "2025/01/25", operational: 100, technical: 65, customized: 100 },
  { date: "2025/03/15", operational: 100, technical: 98, customized: 100 },
  { date: "2025/05/11", operational: 100, technical: 80, customized: 100 },
  { date: "2025/06/30", operational: 100, technical: 100, customized: 100 },
  { date: "2025/01/01", operational: 100, technical: 100, customized: 100 },
  { date: "2025/01/15", operational: 100, technical: 95, customized: 100 },
  { date: "2025/01/25", operational: 100, technical: 95, customized: 100 },
  { date: "2025/03/15", operational: 100, technical: 98, customized: 100 },
  { date: "2025/05/11", operational: 100, technical: 10, customized: 100 },
  { date: "2025/06/30", operational: 100, technical: 100, customized: 95 },
  { date: "2025/01/01", operational: 100, technical: 100, customized: 100 },
  { date: "2025/01/15", operational: 100, technical: 95, customized: 100 },
  { date: "2025/01/25", operational: 100, technical: 65, customized: 100 },
  { date: "2025/03/15", operational: 100, technical: 98, customized: 100 },
  { date: "2025/05/11", operational: 100, technical: 90, customized: 100 },
  { date: "2025/06/30", operational: 100, technical: 100, customized: 90 },
  { date: "2025/01/01", operational: 100, technical: 100, customized: 100 },
  { date: "2025/01/15", operational: 100, technical: 95, customized: 100 },
  { date: "2025/01/25", operational: 100, technical: 95, customized: 100 },
  { date: "2025/03/15", operational: 100, technical: 98, customized: 100 },
  { date: "2025/05/11", operational: 100, technical: 90, customized: 100 },
  { date: "2025/06/30", operational: 100, technical: 100, customized: 90 },
];

export function StatusLineChart({label= "Operational % Technical & Customized"}) {
  let theme = useTheme();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: "40px",
          backgroundColor: theme.palette.background.head_box,
          fontSize: "18px",
          fontWeight: "bold",
          paddingLeft: "10px",
          display: "flex",
          alignItems: "center",
        }}
      >
        {label}
      </div>
      <div
        style={{
          width: "100%",
          height: "400px",
          backgroundColor: theme.palette.background.box,
          padding: "10px",
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}
          >
            <CartesianGrid stroke="#2d4f61" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#fff" />
            <YAxis  
              stroke="#fff"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#1e3c50", border: "none" }}
              labelStyle={{ color: "#fff" }}
            />
            <Legend verticalAlign="top" align="center" iconType="circle" />
            <Line
              type="monotone"
              dataKey="operational"
              stroke="#00c3ff"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Operational"
            />
            <Line
              type="monotone"
              dataKey="technical"
              stroke="#36f59c"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Technical"
            />
            <Line
              type="monotone"
              dataKey="customized"
              stroke="#ffcc00"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Customized"
            />
          </LineChart >
        </ResponsiveContainer>
      </div>
    </div>
  );
}
