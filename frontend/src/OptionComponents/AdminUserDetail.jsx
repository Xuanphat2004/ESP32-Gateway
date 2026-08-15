import { useState, useEffect } from "react";
import {
  Box, Typography, Button, IconButton, Dialog, DialogTitle, DialogContent,
  Table, TableHead, TableBody, TableRow, TableCell, CircularProgress,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import HistoryIcon      from "@mui/icons-material/History";
import RouterIcon       from "@mui/icons-material/Router";
import ElectricMeterIcon from "@mui/icons-material/ElectricMeter";
import CloseIcon        from "@mui/icons-material/Close";
import { getData } from "../ApiComponent/api";

// "2026-07-27T02:44:14.712Z" → "27/07/2026 09:44:14"
const formatTs = (ts) => {
  if (!ts) return "--";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} `
       + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export default function AdminUserDetail({ open, onClose, user }) {
  const theme  = useTheme();
  const accent = theme.palette.text.header_option || "#08ffff";
  const headBg = theme.palette.background.head_box || "#0a1628";
  const divClr = theme.palette.divider             || "#1f2d3a";
  const rowOdd  = theme.palette.table?.background_odd  || "#0d1b2a";
  const rowEven = theme.palette.table?.background_even || "#0f1f2e";

  const [tab, setTab] = useState("sites"); // "sites" | "history"
  const [sites, setSites] = useState(null);
  const [history, setHistory] = useState(null);

  useEffect(() => {
    if (!open || !user) return;
    setTab("sites");
    setSites(null);
    setHistory(null);
    getData(`/solardb/admin/get-user-sites/${user.id}/`).then((d) => setSites(Array.isArray(d) ? d : []));
    getData(`/api/admin/users/${user.id}/login-history/`).then((d) => setHistory(Array.isArray(d) ? d : []));
  }, [open, user]);

  if (!user) return null;

  const TabButton = ({ id, label }) => (
    <Button size="small" onClick={() => setTab(id)}
      variant={tab === id ? "contained" : "outlined"}
      sx={tab === id
        ? { backgroundColor: accent, color: "#000", fontWeight: 700, fontSize: 12,
            "&:hover": { backgroundColor: accent, opacity: 0.85 } }
        : { color: accent, borderColor: accent, fontSize: 12 }}>
      {label}
    </Button>
  );

  const HeadCell = ({ children }) => (
    <TableCell sx={{ backgroundColor: headBg, color: accent, fontWeight: 700, fontSize: 11,
                     borderBottom: `1px solid ${divClr}`, whiteSpace: "nowrap" }}>
      {children}
    </TableCell>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: {
        backgroundColor: theme.palette.background.box || "#0d1b2a",
        border: `1px solid ${divClr}`, borderRadius: 2, backgroundImage: "none",
      } }}>
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{
          backgroundColor: headBg, px: 2.5, py: 1.5,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          borderBottom: `1px solid ${divClr}`,
        }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
            <HistoryIcon sx={{ color: accent, fontSize: 20 }} />
            <Box>
              <Typography sx={{ color: accent, fontWeight: 700, fontSize: 15 }}>{user.username}</Typography>
              <Typography sx={{ color: theme.palette.text.secondary, fontSize: 11 }}>
                Sites &amp; login history
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small"
            sx={{ color: theme.palette.text.secondary, "&:hover": { color: theme.palette.text.primary } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 2 }}>
        <Box sx={{ display: "flex", gap: 1, mb: 1.5 }}>
          <TabButton id="sites"   label="Sites & Devices" />
          <TabButton id="history" label="Login History" />
        </Box>

        {tab === "sites" && (
          sites === null ? (
            <Box sx={{ py: 4, textAlign: "center" }}><CircularProgress size={24} /></Box>
          ) : sites.length === 0 ? (
            <Typography sx={{ color: theme.palette.text.secondary, fontSize: 13, py: 2, textAlign: "center" }}>
              This user owns no sites.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <HeadCell>Site</HeadCell>
                  <HeadCell>Location</HeadCell>
                  <HeadCell>Gateway</HeadCell>
                  <HeadCell>Meters</HeadCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sites.map((s, i) => (
                  <TableRow key={s.site_id} sx={{ backgroundColor: i % 2 === 0 ? rowOdd : rowEven }}>
                    <TableCell sx={{ fontSize: 12, borderBottom: `1px solid ${divClr}` }}>{s.site_name}</TableCell>
                    <TableCell sx={{ fontSize: 12, borderBottom: `1px solid ${divClr}` }}>{s.location || "—"}</TableCell>
                    <TableCell sx={{ fontSize: 11, borderBottom: `1px solid ${divClr}`, fontFamily: "monospace" }}>
                      <RouterIcon sx={{ fontSize: 12, mr: 0.5, verticalAlign: "middle", color: "#546e7a" }} />
                      {s.gateway_id || "—"}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, borderBottom: `1px solid ${divClr}` }}>
                      <ElectricMeterIcon sx={{ fontSize: 12, mr: 0.5, verticalAlign: "middle", color: "#546e7a" }} />
                      {s.meter_count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        )}

        {tab === "history" && (
          history === null ? (
            <Box sx={{ py: 4, textAlign: "center" }}><CircularProgress size={24} /></Box>
          ) : history.length === 0 ? (
            <Typography sx={{ color: theme.palette.text.secondary, fontSize: 13, py: 2, textAlign: "center" }}>
              No login history recorded yet.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <HeadCell>Timestamp</HeadCell>
                  <HeadCell>IP Address</HeadCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((h, i) => (
                  <TableRow key={i} sx={{ backgroundColor: i % 2 === 0 ? rowOdd : rowEven }}>
                    <TableCell sx={{ fontSize: 12, borderBottom: `1px solid ${divClr}`, fontFamily: "monospace" }}>
                      {formatTs(h.timestamp)}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, borderBottom: `1px solid ${divClr}`, fontFamily: "monospace" }}>
                      {h.ip_address || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
