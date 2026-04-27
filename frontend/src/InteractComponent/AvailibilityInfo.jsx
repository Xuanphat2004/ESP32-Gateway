import React, { useState } from "react";
import {
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Button,
  Box,
} from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import AvailabilityTable from "../TableDevice/AvailabilityInfoTable";

import { useTheme } from "@mui/material/styles";


export default function AvailabilityInfo({symbol, label, value}) {
  const [open, setOpen] = useState(false);
  let theme = useTheme();
  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-arrounnd",
          gap: "50px",
          alignItems: 'center',
          marginLeft: "20px"
        }}
      >
        <Box >{symbol}</Box>
        <Box>{value}</Box>
        <Box>{label}</Box>
      </Box>

      <IconButton style={{marginLeft: "20px"}} onClick={() => setOpen(true)} size="small">
        <HelpOutlineIcon />
      </IconButton>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle style={{ color: theme.palette.text.header_option }}>
          Availability Calculation
        </DialogTitle>
        <DialogContent>
          <Typography gutterBottom style={{ color: theme.palette.text.option }}>
            Availability = Available Duration / (Available Duration +
            Unavailable Duration)
          </Typography>
          <Box sx={{ mt: 2 }}>
            {/* đây chỉ ví dụ */}
            <AvailabilityTable />
          </Box>
          <Box sx={{ mt: 3, textAlign: "center" }}>
            <Button variant="outlined" onClick={() => setOpen(false)}>
              Close
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
