import React, { useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Popper,
  Paper,
  Typography,
  Stack,
} from "@mui/material";
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { useTheme } from "@mui/material/styles";

function InverterFilter() {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedType, setSelectedType] = useState({
    Central: true,
    String: true,
    Distributed: true,
  });

  const handleToggle = (event) => {
    setAnchorEl(anchorEl ? null : event.currentTarget);
  };

  const open = Boolean(anchorEl);

  const handleSelect = (type) => {
    setSelectedType((prev) => ({
        ...prev, [type]: !prev[type],
    }));
  };

  const handleReset = () => {
    setSelectedType({
        Central: false,
        String: false,
        Distributed: false,
    });
  };

  const handleSearch = () => {
    alert(`Searching for inverter type: ${selectedType}`);
  };

  return (
    <Box>
      <IconButton onClick={handleToggle} color={theme.palette.text.header_option}>
        <FilterAltIcon />
      </IconButton>

      <Popper open={open} anchorEl={anchorEl} placement="bottom-end">
        <Paper
          sx={{
            backgroundColor: "#000",
            border: "1px solid #928806ff",
            p: 2,
            mt: 1,
            width: "280px",
            height: "150px",
          }}
        >
          <Typography sx={{ fontSize: "14px", color: "#fff", mb: 1 }}>Inverter Type:</Typography>

          <Stack direction="row" spacing={1} mb={2}>
            {["Central", "String", "Distributed"].map((type) => (
              <Button
                key={type}
                variant={selectedType[type] ? "contained" : "outlined"}
                onClick={() => handleSelect(type)}
                sx={{
                    fontSize: "12px",
                    minWidth: "auto",
                    textTransform: "none",
                    whiteSpace: "nowrap",
                    color: theme.palette.text.header_option,
                    borderColor: theme.palette.text.header_option,
                    "&:hover": {
                        backgroundColor: "#d1cfcf",
                    },
                    "&.MuiButton-contained": {
                        backgroundColor: selectedType[type] ? theme.palette.background.option : "transparent",
                        color: theme.palette.text.header_option,
                    },
                }}
              >
                {type}
              </Button>
            ))}
          </Stack>

          <Stack direction="row" spacing={1} justifyContent="center">
            <Button
              variant="outlined"
              onClick={handleReset}
              sx={{
                color: theme.palette.text.header_option,
                borderColor: theme.palette.text.header_option,
                "&:hover": {
                  backgroundColor: "#333",
                },
              }}
            >
              Reset
            </Button>
            <Button
              variant="contained"
              onClick={handleSearch}
              sx={{
                backgroundColor: "#00bfff",
                color: "#000",
                "&:hover": {
                  backgroundColor: "#00bfff",
                },
              }}
            >
              Search
            </Button>
          </Stack>
        </Paper>
      </Popper>
    </Box>
  );
};

export default InverterFilter;