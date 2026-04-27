import React from "react";
import { Box, Typography, Icon } from "@mui/material";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { useTheme } from "@mui/material/styles";
const data = [
  {
    available: true,
    unavailable: false,
    excluded: false,
    name: "Full Capability",
  },
  {
    available: true,
    unavailable: false,
    excluded: false,
    name: "Partial Capability",
  },
  {
    available: true,
    unavailable: false,
    excluded: false,
    name: "Service Setpoint",
  },
  {
    available: false,
    unavailable: true,
    excluded: false,
    name: "Out of Environmental Specification",
  },
  {
    available: true,
    unavailable: false,
    excluded: false,
    name: "Low Irradiance",
  },
  {
    available: true,
    unavailable: false,
    excluded: false,
    name: "High Irradiance",
  },
];

const AvailabilityTable = () => {
  let theme = useTheme();
  return (
    <Box sx={{ color: "white", minWidth: "600px" }}>
      <Box
        sx={{
          display: "flex",
          fontWeight: "bold",
          borderBottom: "1px solid #ccc",
          mb: 1,
        }}
      >
        <Box
          sx={{
            flex: 1,
            textAlign: "center",
            color: theme.palette.text.header_option,
          }}
        >
          Available
        </Box>
        <Box
          sx={{
            flex: 1,
            textAlign: "center",
            color: theme.palette.text.header_option,
          }}
        >
          Unavailable
        </Box>
        <Box
          sx={{
            flex: 1,
            textAlign: "center",
            color: theme.palette.text.header_option,
          }}
        >
          Excluded
        </Box>
        <Box
          sx={{
            flex: 2,
            textAlign: "left",
            pl: 2,
            color: theme.palette.text.header_option,
          }}
        >
          State
        </Box>
      </Box>
      <Box sx={{
        height: "200px",
        overflow: "auto"
      }}>
        {data.map((row, index) => (
          <Box
            key={index}
            sx={{
              display: "flex",
              alignItems: "center",
              p: 1,
              "&:nth-of-type(odd)": {
                backgroundColor: "rgba(255,255,255,0.05)",
              },
            }}
          >
            <Box
              sx={{
                flex: 1,
                textAlign: "center",
                color: theme.palette.text.option,
              }}
            >
              {row.available ? (
                <RadioButtonCheckedIcon />
              ) : (
                <RadioButtonUncheckedIcon />
              )}
            </Box>
            <Box
              sx={{
                flex: 1,
                textAlign: "center",
                color: theme.palette.text.option,
              }}
            >
              {row.unavailable ? (
                <RadioButtonCheckedIcon />
              ) : (
                <RadioButtonUncheckedIcon />
              )}
            </Box>
            <Box
              sx={{
                flex: 1,
                textAlign: "center",
                color: theme.palette.text.option,
              }}
            >
              {row.excluded ? (
                <RadioButtonCheckedIcon />
              ) : (
                <RadioButtonUncheckedIcon />
              )}
            </Box>
            <Box sx={{ flex: 2, pl: 2 }}>
              <Typography
                variant="body2"
                sx={{ color: theme.palette.text.option }}
              >
                {row.name}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default AvailabilityTable;
