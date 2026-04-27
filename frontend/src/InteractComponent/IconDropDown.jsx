import React, { useState } from "react";
import { useTheme } from "@mui/material/styles";
import { Menu, MenuItem, IconButton, Typography } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import SettingsIcon from '@mui/icons-material/Settings';

function IconDropDown({ options, handleChange, pick }) {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (value) => {
    handleChange({ target: { value } }); // để tương thích kiểu onChange event
    handleClose();
  };

  return (
    <div>
      <IconButton onClick={handleClick}>
        <SettingsIcon
          sx={{ color: theme.palette.text.header_option }}
        />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            color: theme.palette.text.header_option,
            border: `1px solid ${theme.palette.text.header_option}`,
          },
        }}
      >
        {options.map((item) => (
          <MenuItem
            key={item}
            selected={item === pick}
            onClick={() => handleSelect(item)}
            sx={{
              color: theme.palette.text.header_option,
            }}
          >
            <Typography>{item}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
}

export default IconDropDown;
