import { Box, Button } from "@mui/material";
import { useState } from "react";
import { MultiSelectDropdown } from "../InteractComponent/DropDownMulti";
import SortTable from "../TableDevice/SortTable";
import { useTheme } from "@mui/material/styles";

export default function AlarmSnooze() {

  const option = ["TotalEnergies"];
  const [change, setChange] = useState([]);

  const valid = [
    { field: "device", headerName: "Device" },
    { field: "site", headerName: "Site" },
    { field: "alarmContent", headerName: "Alarm Content" },
    { field: "reason", headerName: "Reason" },
    { field: "comment", headerName: "Comment" },
    { field: "duration", headerName: "Duration" },
    { field: "operations", headerName: "Operations" },
  ];

  const invalid = [
    { field: "device", headerName: "Device" },
    { field: "site", headerName: "Site" },
    { field: "alarmContent", headerName: "Alarm Content" },
    { field: "reason", headerName: "Reason" },
    { field: "comment", headerName: "Comment" },
    { field: "duration", headerName: "Duration" },
    { field: "creat", headerName: "Create At" },
    { field: "operations", headerName: "Operations" },
  ];

  const rows = [];
  
  const [column, setColumn] = useState(valid);
  const [selected, setSelected] = useState("valid");

  const handleClick = (type) => {
    if (type === "valid") {
      setColumn(valid);
      setSelected("valid");
    } else {
      setColumn(invalid);
      setSelected("invalid");
    }
  };

    let theme = useTheme();
  return (
    <Box sx={{ display: "flex", flexDirection: "column", padding: "10px" }}>
      <Box sx={{ display: "flex", flexDirection: "row", width: "250px" }}>
        <MultiSelectDropdown options={option} value={change} onChange={setChange} />
      </Box>
      <Box sx={{ display: "flex", flexDirection: "row", gap: "20px", mt: 2 }}>
        <Button
          variant="text"
          sx={{
            color: selected === "valid" ? theme.palette.text.header_option : theme.palette.text.option,
            fontWeight: selected === "valid" ? "bold" : "normal",
            textTransform: "none",
            transition: "color 1s",
            fontSize: "16px"
          }}
          onClick={() => handleClick("valid")}
        >
          Valid Rules
        </Button>
        <Button
          variant="text"
          sx={{
            color: selected === "invalid" ? theme.palette.text.header_option : theme.palette.text.option,
            fontWeight: selected === "invalid" ? "bold" : "normal",
            textTransform: "none",
            transition: "color 1s",
            fontSize: "16px"
          }}
          onClick={() => handleClick("invalid")}
        >
          Invalid Rules
        </Button>
      </Box>
      <Box>
        <SortTable columns={column} rows={rows} />
      </Box>
    </Box>
  );
}
