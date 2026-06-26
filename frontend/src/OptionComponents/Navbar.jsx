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
import { MyOption, OptionAbout } from "./option";
import NotificationBell from "../NotificationBell"; // ← import từ file riêng

const drawerWidth = 300;

// ─── Styled components ────────────────────────────────────────────────────────
const Main = styled("main", {
  shouldForwardProp: (prop) => prop !== "open",
})(({ theme, open }) => ({
  flexGrow: 1,
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
  ...theme.mixins.toolbar,
  justifyContent: "flex-end",
}));

// ─── Layout chính ─────────────────────────────────────────────────────────────
export default function PersistentDrawerLeft() {
  const theme = useTheme();
  const [open, setOpen] = React.useState(false);
  const { mode, toggleMode } = useThemeMode();

  const handleDrawerOpen  = () => setOpen(true);
  const handleDrawerClose = () => setOpen(false);

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      <CssBaseline />

      <AppBar position="fixed" open={open} elevation={0}>
        <Toolbar sx={{
          backgroundColor: theme.palette.background.paper,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: mode === "dark"
            ? "1px solid rgba(255,255,255,0.07)"
            : "1px solid rgba(0,0,0,0.07)",
          boxShadow: mode === "dark"
            ? "0 2px 20px rgba(0,0,0,0.45)"
            : "0 2px 20px rgba(0,80,180,0.12)",
        }}>

          {/* Nút mở drawer */}
          <IconButton
            color="#b48a60"
            aria-label="open drawer"
            onClick={handleDrawerOpen}
            edge="start"
            sx={[{ mr: 2 }, open && { display: "none" }]}
          >
            <MenuIcon />
          </IconButton>

          {/* Tiêu đề */}
          <Typography
            variant="h4" noWrap component="div"
            sx={{ color: theme.palette.text.header_option, fontWeight: "bold", flexGrow: 1 }}
          >
            CENTRAL MONITORING DASHBOARD
          </Typography>

          {/* Chuông thông báo — logic nằm trong src/NotificationBell.jsx */}
          <NotificationBell />

          {/* Nút đổi theme */}
          <Button
            variant="outlined" onClick={toggleMode}
            sx={{ color: theme.palette.text.header_option, borderColor: theme.palette.text.header_option }}
          >
            {mode === "light" ? "Dark Mode" : "Light Mode"}
          </Button>

        </Toolbar>
      </AppBar>

      {/* Drawer menu trái */}
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            backgroundColor: theme.palette.background.default,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRight: mode === "dark"
              ? "1px solid rgba(255,255,255,0.07)"
              : "1px solid rgba(0,0,0,0.07)",
            boxShadow: mode === "dark"
              ? "4px 0 24px rgba(0,0,0,0.4)"
              : "4px 0 24px rgba(0,80,180,0.10)",
            overflowY: "auto",
            "&::-webkit-scrollbar": { width: "8px" },
            "&::-webkit-scrollbar-thumb": { backgroundColor: "transparent", borderRadius: "4px" },
            "&:hover::-webkit-scrollbar-thumb": { backgroundColor: theme.palette.background.head_box },
            "&:hover::-webkit-scrollbar-track": { backgroundColor: "transparent" },
          },
        }}
        variant="persistent"
        anchor="left"
        open={open}
      >
        <DrawerHeader>
          <IconButton onClick={handleDrawerClose} sx={{ color: theme.palette.text.primary }}>
            {theme.direction === "ltr" ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </IconButton>
        </DrawerHeader>

        <MyOption title="Central Monitor" items={[
          { to: "/fleetview",   label: "Fleet View" },
          { to: "/sitelist",    label: "Site List" },
          { to: "/leaderboard", label: "Leader Board" },
        ]} />
        <MyOption title="Site Monitor" items={[
          { to: "/siteview",   label: "Site View" },
          { to: "/sitekpi",    label: "Site KPI" },
          { to: "/devicelist", label: "Device List" },
        ]} />
        <MyOption title="Alarm" items={[
          { to: "/activealarm",       label: "Active Alarm" },
          { to: "/alarmlog",          label: "Alarm Log" },
          { to: "/alarmconfig",       label: "Alarm Config" },
          { to: "/alarmsnooze",       label: "Alarm Snooze" },
          { to: "/alarmsubscription", label: "Alarm Subscription" },
        ]} />
        <MyOption title="Analyze" items={[
          { to: "/chartingtool",     label: "Charting Tool" },
          { to: "/availability",     label: "Availability" },
          { to: "/topologyanalysis", label: "Topology Analysis" },
        ]} />
        <MyOption title="General Report" items={[
          { to: "/sitereport",       label: "Site Report" },
          { to: "/devicereport",     label: "Device Report" },
          { to: "/productionreport", label: "Production Report" },
          { to: "/operationreport",  label: "Operation Report" },
        ]} />
        <MyOption title="Data Report" items={[
          { to: "/dataexport", label: "Data Export" },
        ]} />
        <MyOption title="Site Management" items={[
          { to: "/budgetproductioninput", label: "Budget Production Input" },
          { to: "/budgetisolutioninput",  label: "Budget Isolution Input" },
          { to: "/budgetgridinjectinput", label: "Budget Grid-Inject Input" },
        ]} />
        <OptionAbout />
      </Drawer>

      <Main open={open}>
        <DrawerHeader />
        <Outlet />
      </Main>
    </Box>
  );
}