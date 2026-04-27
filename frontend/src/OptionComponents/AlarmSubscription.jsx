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
import { MultiSelectDropdown } from "../InteractComponent/DropDownMulti";
import SortTable from "../TableDevice/SortTable";
import ThreeBoxScrollableTable from "../TableDevice/StickyColumnTable";
import { useTheme } from "@mui/material/styles";
import DownLoadCSV from "../InteractComponent/DonwLoadCSV";
import AddIcon from '@mui/icons-material/Add';
  const columns = [
    { field: "name", headerName: "Name" },
    { field: "sitedevice", headerName: "Site and Device" },
    { field: "alarmtype", headerName: "Alarm Type" },
    { field: "sms", headerName: "SMS" },
    { field: "alarmseverity", headerName: "Alarm Severity" },
    { field: "emailsumary", headerName: "Email(Sumary)" },
    { field: "emaildetail", headerName: "Email(Detail)" },
    { field: "recipient", headerName: "Recipient" },
    { field: "notifyway", headerName: "Notify Way" },
    { field: "operation", headerName: "Operation" },
  ];
  const rows = [];


  function Subscription(){
    
  }

export default function AlarmSubscription() {
  const [sign, setSign] = useState("false");
  // const handleSign = (sign) => {
  //   setSign("true");
  //   console.log(sign);
  // }
  // useEffect(() => {
  //   console.log("PAGE REFRESH");
  // });
  function handleSign() {
    setSign("true");
    console.log(sign);
  };
  
  return (

    <Box>
      <Box><MyButton label={"+ NEW SUBSCRIPTION"} onClick={handleSign}/></Box>
      <Box><SortTable columns={columns} rows={rows}/> </Box>
    </Box>
  );
}
