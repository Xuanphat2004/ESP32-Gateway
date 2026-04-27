import React, { useState } from "react";
import { useTheme } from "@mui/material/styles";
import { Box, Typography, Popper, Paper } from "@mui/material";
import ContactSupportIcon from "@mui/icons-material/ContactSupport";
import PhoneIcon from "@mui/icons-material/Phone";
import FeedbackIcon from "@mui/icons-material/Feedback";
import EmailIcon from "@mui/icons-material/Email";

const ContactUsPanel = () => {
    const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMouseEnter = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMouseLeave = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  return (
    <Box
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      sx={{
        position: "fixed",
        right: 0,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 9999,
      }}
    >
      {/* Button Contact Us */}
      <Box
        sx={{
          backgroundColor: theme.palette.text.header_option,
          color: "#fff",
          p: "8px 12px",
          borderTopLeftRadius: "4px",
          borderBottomLeftRadius: "4px",
          cursor: "pointer",
          writingMode: "vertical-rl",
          textAlign: "center",
          fontWeight: "bold",
          fontSize: "14px",
        }}
      >
        Contact Us
      </Box>

      {/* Panel hiển thị khi hover */}
      <Popper open={open} anchorEl={anchorEl} placement="left-start" disablePortal>
        <Paper
          elevation={3}
          sx={{
            backgroundColor: "#000",
            color: "#fff",
            p: 2,
            width: 250,
          }}
        >
          <Box display="flex" alignItems="center" mb={1}>
            <PhoneIcon sx={{ mr: 1 }} />
            <Box>
              <Typography variant="body1">24*7 Hotline</Typography>
              <Typography variant="body2" sx={{ color: "#00bcd4" }}>
                400-028-7766
              </Typography>
            </Box>
          </Box>
          <Box display="flex" alignItems="center">
            <FeedbackIcon sx={{ mr: 1 }} />
            <Box>
              <Typography variant="body1">Feedback</Typography>
              <Typography variant="body2" sx={{ color: "#00bcd4" }}>
                Email: OMHelpdesk@univers.com
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Popper>
    </Box>
  );
};

export default ContactUsPanel;