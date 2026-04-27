import {
  Box,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useTheme } from "@mui/material/styles";
import dayjs from "dayjs";
import { AllCategoriesDropDown, MultiSelectDropdown } from "./DropDownMulti";
import MySmartRangePicker from "./DataRangePicker";

export default function FilterForm() {
  const theme = useTheme();

  const [timeRange, setTimeRange] = useState([
    // dayjs().startOf("day"),
    // dayjs().endOf("day"),
    {
      startDate: new Date(),
      endDate: new Date(),
      key: "selection",
    },
  ]);
  const [quickTime, setQuickTime] = useState("Today");

  useEffect(() => {
    const endDate = new Date(); // Ngày hiện tại hoặc endDate từ state
    let startDate = new Date(endDate);

    switch (quickTime) {
      case "Today":
        startDate.setDate(endDate.getDate());
        break;
      case "Last 3 Days":
        startDate.setDate(endDate.getDate() - 3);
        break;
      case "Current Month":
        startDate.setDate(1);
        break;
      case "Last 3 Months":
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      default:
        break;
    }

    setTimeRange([
      {
        startDate: startDate,
        endDate: endDate,
        key: "selection",
      },
    ]);
  }, [quickTime]);

  const [site, setSite] = useState([]);
  const [severity, setSeverity] = useState([]);
  const [ackStatus, setAckStatus] = useState([]);
  const [alarmStatus, setAlarmStatus] = useState(["Active"]);
  const [type, setType] = useState([]);

  const types = ["All Categories", "Category A", "Category B"];

  const handleReset = () => {
    setSite([]);
    setDevice([]);
    setDeviceType([]);
    setTimeRange([dayjs().startOf("day"), dayjs().endOf("day")]);
    setQuickTime("Today");
    setSeverity([]);
    setAckStatus([]);
    setAlarmStatus("Active");
    setType([]);
  };

  const optionsSite = [
    "TotalEnergies",
  ]
  const optionsDeviceType = [
    "Select All",
    "Solar Site",
    "Inverter",
    "Energy Meter",
    "Weather Station",
  ]

  const [deviceType, setDeviceType] = useState(optionsDeviceType.filter(option => option !== "Select All"));

  const optionsSelectDevice = [
    "Select All",
    "BK_Canteen1_EMT",
    "BK_Canteen1_Inverter1",
    "BK_Canteen1_Inverter2",
    "BK_Canteen1_Inverter3",
    "BK_Canteen2_Inverter1",
    "BK_Canteen2_Inverter2",
    "BK_Canteen2_Inverter3",
    "BK_ParkingLot1_Inverter1",
    "BK_ParkingLot1_Inverter2",
    "BK_ParkingLot1_Inverter3",
    "BK_ParkingLot2_Inverter1",
    "BK_ParkingLot2_Inverter2",
    "BK_ParkingLot2_Inverter3",
  ];

  const [device, setDevice] = useState(optionsSelectDevice.filter(option => option !== "Select All"));

  const optionsType = {
    "Device Alarm": [ "Full Capability", "Partial Capability", "Service Setpoints",
                      "Environment out of Spec", "Low Irradiance", "Temperature Range",
                      "Requested Shutdown", "Startup", "DC Electrical Disturbance",
                      "DC Ground Fault", "AC Electrical Disturbance", "Non Operative",
                      "Scheduled Maintenance", "Equipment Failure", "Thermal System Failure",
                      "Power System Failure", "Control System Failure", "No Data Refresh",
                      "No Communication", "Connection Failure"],
    "Performance Alarm": ["Performance"],
    "Facility Alarm": [],
  };

  const [selectedtype, setSelectedType] = useState([]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "10px",
        color: theme.palette.text.option,
        "& .MuiToggleButton-root": {
          "&.Mui-selected": {
            color: theme.palette.text.button,
            backgroundColor: theme.palette.background.button,
          },
        },
      }}
    >
      {/* Site */}
      <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
        <Box sx={{ marginRight: "100px", width: "10%" }}>Site:</Box>
        <Box sx={{ width: "20%" }}>
          <MultiSelectDropdown
            options={optionsSite}
            label={"Selected Sites"}
            value={site}
            onChange={setSite}
          />
        </Box>
      </Box>

      {/* Device */}
      <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
        <Box sx={{ marginRight: "100px", width: "10%" }}>Device:</Box>
        <Box sx={{ width: "20%", marginRight: "20px" }}>
          <MultiSelectDropdown
            options={optionsDeviceType}
            label={"Select Device Types"}
            value={deviceType}
            onChange={setDeviceType}
          />
        </Box>
        <Box sx={{ width: "20%" }}>
          <MultiSelectDropdown
            options={optionsSelectDevice}
            label={"Select Device"}
            value={device}
            onChange={setDevice}
          />
        </Box>
      </Box>

      {/* Time */}
      <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
        <Box sx={{ marginRight: "100px", width: "10%", }}>Time:</Box>
        <Box sx={{ width: "80%", }}>
          <ToggleButtonGroup
            exclusive
            value={quickTime}
            onChange={(e, val) => val && setQuickTime(val)}
            color="primary"
            sx={{
              display: "flex",
              flexWrap: "wrap", 
              "& .MuiToggleButton-root": {
                borderColor: theme.palette.text.header_option,
                color: theme.palette.text.header_option,
              },
              "& .Mui-selected": {
                background: theme.palette.text.header_option,
                color: theme.palette.background.default,
                "&:hover": {
                  background: theme.palette.text.option,
                },
              },
            }}
          >
            <Box>
              <ToggleButton value="Today">Today</ToggleButton>
              <ToggleButton value="Last 3 Days">Last 3 Days</ToggleButton>
              <ToggleButton value="Current Month">Current Month</ToggleButton>
              <ToggleButton value="Last 3 Months">Last 3 Months</ToggleButton>
            </Box>
            <Box
              sx={{
                marginLeft: "20px",
                alignContent: "center",
              }}
            >
              <MySmartRangePicker
                value={timeRange}
                onChange={(newValue) => setTimeRange(newValue)}
              />
            </Box>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* ACK Status */}
      <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
        <Box sx={{ marginRight: "100px", width: "10%" }}>ACK Status:</Box>
        <Box sx={{ width: "80%" }}>
          <ToggleButtonGroup
            value={ackStatus}
            onChange={(e, val) => setAckStatus(val)}
            color="primary"
            multiple
            sx={{
              display: "flex",
              flexWrap: "wrap", 
              "& .MuiToggleButton-root": {
                borderColor: theme.palette.text.header_option,
                color: theme.palette.text.header_option,
              },
              "& .Mui-selected": {
                background: theme.palette.text.header_option,
                color: theme.palette.background.default,
                "&:hover": {
                  background: theme.palette.text.option,
                },
              },
            }}
          >
            <ToggleButton value="ACK">Acknowledged (ACK)</ToggleButton>
            <ToggleButton value="UNACK">Unacknowledged (UNACK)</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Alarm Status */}
      <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
        <Box sx={{ marginRight: "100px", width: "10%" }}>Alarm Status:</Box>
        <Box sx={{ width: "80%" }}>
          <ToggleButtonGroup
            value={alarmStatus}
            onChange={(e, val) => setAlarmStatus(val)}
            color="primary"
            multiple
            sx={{
              "& .MuiToggleButton-root": {
                borderColor: theme.palette.text.header_option,
                color: theme.palette.text.header_option,
              },
              "& .Mui-selected": {
                background: theme.palette.text.header_option,
                color: theme.palette.background.default,
                "&:hover": {
                  background: theme.palette.text.option,
                },
              },
            }}
          >
            <ToggleButton value="Active">Active</ToggleButton>
            <ToggleButton value="Inactive">Inactive</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Type */}
      <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
        <Box sx={{ marginRight: "100px", width: "10%" }}>Type:</Box>
        <Box sx={{ width: "20%" }}>
          <AllCategoriesDropDown
            label={"Select Categories"}
            options={optionsType}
            value={selectedtype}
            onChange={setSelectedType}
          />
        </Box>
      </Box>

      {/* Buttons */}
      <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
        <Button
          variant="outlined"
          sx={{
            color: theme.palette.text.header_option,
            borderColor: theme.palette.text.header_option,
            "&:hover": {
              borderColor: theme.palette.text.option,
              color: theme.palette.text.option,
            },
          }}
          onClick={handleReset}
        >
          Reset
        </Button>
        <Button
          variant="contained"
          sx={{
            background: theme.palette.text.header_option,
            color: theme.palette.background.default,
            "&:hover": {
              background: theme.palette.text.option,
            },
          }}
          onClick={() =>
            console.log({
              site,
              device,
              quickTime,
              timeRange,
              severity,
              ackStatus,
              alarmStatus,
              type,
            })
          }
        >
          Apply
        </Button>
      </Box>
    </Box>
  );
}
