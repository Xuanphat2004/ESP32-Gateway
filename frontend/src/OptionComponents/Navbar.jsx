import * as React from "react";
import { styled, useTheme } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import CssBaseline from "@mui/material/CssBaseline";
import MuiAppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Button } from "@mui/material";
import { useThemeMode } from "../themeContex";

import { Outlet } from "react-router-dom";
import { MyOption, OptionAbout} from "./option";

// Nhập thêm useState để quản lý việc đóng mở
import { useState, useRef, useEffect } from 'react'; 
import { Divider } from "@mui/material";

// // Nhập các linh kiện giao diện cần thiết
// import { Collapse, List, ListItemButton, ListItemIcon, ListItemText } from "@mui/material";
// import ExpandLess from "@mui/icons-material/ExpandLess"; // Mũi tên chỉ lên
// import ExpandMore from "@mui/icons-material/ExpandMore"; // Mũi tên chỉ xuống
// import SettingsIcon from "@mui/icons-material/Settings"; // Icon cho mục cha
// import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight'; // Icon cho mục con
// import { Link } from "react-router-dom"; // Để chuyển trang

const drawerWidth = 300;

const Main = styled("main", {
  shouldForwardProp: (prop) => prop !== "open",
})(({ theme, open }) => ({
  flexGrow: 1,
  // padding: theme.spacing(3),
  width: "100%",
  maxWidth: "100%",
  padding: 0,
  height: "calc(100vh - 64px)",
  transition: theme.transitions.create("margin", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginLeft: `-${drawerWidth}px`,
  ...(open && {
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginLeft: 0,
  }),
}));

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== "open",
})(({ theme, open }) => ({
  transition: theme.transitions.create(["margin", "width"], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    width: `calc(100% - ${drawerWidth}px)`,
    marginLeft: `${drawerWidth}px`,
    // marginRight: `${drawerWidth}px`,
    transition: theme.transitions.create(["margin", "width"], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "left",
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
  justifyContent: "flex-end",
}));

export default function PersistentDrawerLeft() {
  const theme = useTheme();
  const [open, setOpen] = React.useState(false);

  // Biến này quyết định menu đang mở (true) hay đóng (false)
  const [openSiteMgmt, setOpenSiteMgmt] = useState(false);

  // Hàm này chạy khi bạn bấm vào nút cha để đảo ngược trạng thái
  const handleSiteMgmtClick = () => {
    setOpenSiteMgmt(!openSiteMgmt);
  };

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };
  
  const { mode, toggleMode } = useThemeMode();
  return (
    
    <Box sx={{ display: "flex", height: "100vh" }}>
      <CssBaseline />
      <AppBar position="fixed" open={open}>
        <Toolbar
          sx={{
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <IconButton
            color="#b48a60"
            aria-label="open drawer"
            onClick={handleDrawerOpen}
            edge="start"
            sx={[
              {
                mr: 2,
              }, 
              open && { display: "none" },
            ]}
          >
            <MenuIcon />
          </IconButton>

          <Typography
            variant="h4"
            noWrap
            component="div"
            sx={{
              color:theme.palette.text.header_option,
              fontWeight: "bold",
              //fontFamily: "fantasy",
              flexGrow: 1,
            }}
          >
            CENTRAL MONITORING DASHBOARD
          </Typography>

          <Button variant="outlined" onClick={toggleMode} sx={{color: theme.palette.text.header_option, borderColor:theme.palette.text.header_option}}>
            {mode === "light" ? "Dark Mode" : "Light Mode"}
          </Button>
        </Toolbar>
      </AppBar>

      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            backgroundColor: theme.palette.background.default,
            overflowY: "auto",
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'transparent',
              borderRadius: '4px',
            },
            '&:hover::-webkit-scrollbar-thumb': {
              backgroundColor: theme.palette.background.head_box,
            },
            '&:hover::-webkit-scrollbar-track': {
              backgroundColor: 'transparent',
            },
          },
        }}
        variant="persistent"
        anchor="left"
        open={open}
      >
        <DrawerHeader>
          <IconButton
            onClick={handleDrawerClose}
            sx={{
              color: theme.palette.text.primary,
            }}
          >
            {theme.direction === "ltr" ? (
              <ChevronLeftIcon />
            ) : (
              <ChevronRightIcon />
            )}
          </IconButton>
        </DrawerHeader>

        

        <MyOption
          title="Central Monitor"
          items={[
            { to: "/fleetview", label: "Fleet View" },
            { to: "/sitelist", label: "Site List" },
            { to: "/leaderboard", label: "Leader Board" },
          ]}
        />
        <MyOption
          title="Site Monitor"
          items={[
            { to: "/siteview", label: "Site View" },
            { to: "/sitekpi", label: "Site KPI" },
            { to: "/devicelist", label: "Device List" },
          ]}
        />
        <MyOption
          title="Alarm"
          items={[
            { to: "/activealarm", label: "Active Alarm" },
            { to: "/alarmlog", label: "Alarm Log" },
            { to: "/alarmconfig", label: "Alarm Config" },
            { to: "/alarmsnooze", label: "Alarm Snooze" },
            { to: "/alarmsubscription", label: "Alarm Subscription" },
          ]}
        />
        <MyOption
          title="Analyze"
          items={[
            { to: "/chartingtool", label: "Charting Tool" },
            { to: "/availability", label: "Availability" },
            { to: "/topologyanalysis", label: "Topology Analysis" },
          ]}
        />
        <MyOption
          title="General Report"
          items={[
            { to: "/sitereport",      label: "Site Report" },
            { to: "/devicereport",    label: "Device Report" },
            { to: "/productionreport",label: "Production Report" },
            { to: "/operationreport", label: "Operation Report" },
          ]}
        />
        <MyOption
          title="Data Report"
          items={[{ to: "/dataexport", label: "Data Export" }]}
        />
        <MyOption
          title="Site Management"
          items={[
            { to: "/budgetproductioninput", label: "Budget Production Input" },
            { to: "/budgetisolutioninput",  label: "Budget Isolution Input" },
            { to: "/budgetgridinjectinput", label: "Budget Grid-Inject Input"}
          ]}
        />
        <OptionAbout />
      </Drawer>

      <Main open={open}>
        <DrawerHeader />
        <Outlet />
      </Main>
    </Box>
  );
}
