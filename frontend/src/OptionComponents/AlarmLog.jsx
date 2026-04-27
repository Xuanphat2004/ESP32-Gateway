// import MyRangeCalendar from "../InteractComponent/DataRangePicker";
// import AvailabilityInfo from "../InteractComponent/AvailibilityInfo";
// import MyLineChart from "../ChartComponents/LineChart2";
// import { useState, useEffect } from "react";
// import axios from "axios";
// import dayjs from "dayjs"; // lib datetime using
import {
  alignItems,
  Box,
  display,
  flex,
  height,
  justifyContent,
  sizeHeight,
} from "@mui/system";
// import DropDownButton from "../InteractComponent/DropDownButton";
// import CombinedChart from "../ChartComponents/CombineChart";
// import ThermometerGaugeSVG from "../ChartComponents/ThermometerGaugeSVG";
// import RowBar from "../ChartComponents/RowBar";
// import IconDropDown from "../InteractComponent/IconDropDown";
// import AccessTimeIcon from "@mui/icons-material/AccessTime";
// import ElectricBoltIcon from "@mui/icons-material/ElectricBolt";
// import EnergySavingsLeafIcon from "@mui/icons-material/EnergySavingsLeaf";
// import TocIcon from "@mui/icons-material/Toc";
// import MarginIcon from "@mui/icons-material/Margin";
// import SolarPowerIcon from "@mui/icons-material/SolarPower";
// import DonutChart from "../ChartComponents/DonutChart";
// import HandymanIcon from "@mui/icons-material/Handyman";
// import ScreenshotMonitorIcon from "@mui/icons-material/ScreenshotMonitor";
// import AccountBoxIcon from "@mui/icons-material/AccountBox";
// import MyButton from "../InteractComponent/myButton";
// import MyCalendar from "../InteractComponent/myCalendar";
// import { MultiSelectDropdown } from "../InteractComponent/DropDownMulti";
// import SortTable from "../TableDevice/SortTable";
// import ThreeBoxScrollableTable from "../TableDevice/StickyColumnTable";
import { useTheme } from "@mui/material/styles";
import FilterForm from "../InteractComponent/FIlter";

export default function AlarmLog() {
  let theme = useTheme();
  return (
    <Box sx={{display: "flex", padding: "20px"}}>
      <Box sx={{ backgroundColor: theme.palette.background.box, width: "100%",  boxShadow: '5px 5px 10px rgba(0,0,0,0.3)', height: "110%"}}>
        <FilterForm />
      </Box>
    </Box>
  );
}
