import React from "react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Box,
  ListItem,
  ListItemButton,
  ListItemText,
  Collapse,
  List,
} from "@mui/material";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ExpandLess from "@mui/icons-material/ExpandLess";
import { styled, useTheme } from "@mui/material/styles";

function MyOption({ title = "Central Monitor", items = [] }) {
  const [openGroup, setOpenGroup] = useState(false);
  const location = useLocation();
  const theme = useTheme();
  return (
    <List
      sx={{
        color: theme.palette.text.header_option,
        background: theme.palette.background.paper,
         
      }}
    >
      <ListItem disablePadding>
        <ListItemButton onClick={() => setOpenGroup(!openGroup)}>
          <ListItemText primary={title} />
          {openGroup ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>
      </ListItem>
      <Collapse in={openGroup} timeout={"auto"} unmountOnExit>
        <Box sx={{ pl: 4 }}>
          {items.map(({ to, label }) => (
            <ListItem key={to} disablePadding>
              <ListItemButton
                component={Link}
                to={to}
                selected={location.pathname === to}
                sx={{
                  "&.Mui-selected": {
                    backgroundColor: theme.palette.background.option,
                  },
                  "&.Mui-selected:hover": {
                    backgroundColor: "#c4cbcc",
                  },
                  "&:hover": {
                    backgroundColor: "#d1cfcf",
                  },
                }}
              >
                <ListItemText style={{ color: theme.palette.text.option}} primary={label} />
              </ListItemButton>
            </ListItem>
          ))}
        </Box>
      </Collapse>
    </List>
  );
}

function OptionAbout() {
  const location = useLocation();
  const theme = useTheme();
  return (
    <List
      sx={{
        color: theme.palette.text.header_option,
        background: theme.palette.background.paper,
      }}
    >
      <ListItem key="/about" disablePadding>
        <ListItemButton
          component={Link}
          to="/about"
          selected={location.pathname === "/about"}
          sx={{
            "&.Mui-selected": {
              backgroundColor: theme.palette.background.option,
            },
            "&.Mui-selected:hover": {
              backgroundColor: "#c4cbcc",
            },
            "&:hover": {
              backgroundColor: "#d1cfcf",
            },
          }}
        >
          <ListItemText
            style={{ color: theme.palette.text.head_option }}
            primary="About"
          />
        </ListItemButton>
      </ListItem>
    </List>
  );
}

export { MyOption, OptionAbout };