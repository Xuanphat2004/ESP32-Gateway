import { Box, Button, Alert, Collapse, Chip, IconButton, Typography, Divider } from "@mui/material";
import CloseIcon                from "@mui/icons-material/Close";
import WifiOffIcon              from "@mui/icons-material/WifiOff";
import CheckCircleOutlineIcon   from "@mui/icons-material/CheckCircleOutline";
import { useState, useEffect }  from "react";
import { MultiSelectDropdown }  from "../InteractComponent/DropDownMulti";
import SortTable                from "../TableDevice/SortTable";
import { useTheme }             from "@mui/material/styles";
import { getData }              from "../ApiComponent/api";

// ── Columns khai báo NGOÀI component ─────────────────────────────────────
// Lý do: phải khai báo trước useState(valid) — JS không hoist const
const valid = [
  { field: "device",       headerName: "Device" },
  { field: "site",         headerName: "Site" },
  { field: "alarmContent", headerName: "Alarm Content" },
  { field: "reason",       headerName: "Reason" },
  { field: "comment",      headerName: "Comment" },
  { field: "duration",     headerName: "Scan Time" },
  { field: "operations",   headerName: "Operations" },
];

const invalid = [
  { field: "device",       headerName: "Device" },
  { field: "site",         headerName: "Site" },
  { field: "alarmContent", headerName: "Alarm Content" },
  { field: "reason",       headerName: "Reason" },
  { field: "comment",      headerName: "Comment" },
  { field: "duration",     headerName: "Scan Time" },
  { field: "creat",        headerName: "Create At" },
  { field: "operations",   headerName: "Operations" },
];

export default function AlarmSnooze() {
  const theme = useTheme();
  const option = ["TotalEnergies"];

  // ── State ─────────────────────────────────────────────────
  const [change,      setChange]      = useState([]);
  const [selected,    setSelected]    = useState("valid");
  const [column,      setColumn]      = useState(valid);
  const [gatewayId,   setGatewayId]   = useState(null);
  const [latestScan,  setLatestScan]  = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [faults,      setFaults]      = useState([]);
  const [showBanner,  setShowBanner]  = useState(false);

  // ─────────────────────────────────────────────────────────
  // Load data on mount — 3 API calls in parallel
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      getData("/solardb/get-my-sites/"),
      getData("/solardb/get-latest-scan/"),
      getData("/solardb/get-scan-history/"),
    ]).then(([sites, latestRes, history]) => {

      // Get gateway_id for WebSocket connection
      if (sites?.length > 0) {
        setGatewayId(sites[0].gateway_id.replace(/:/g, "_"));
      }

      // Latest scan block
      if (latestRes?.data) {
        setLatestScan(latestRes.data);
      }

      // History table
      if (history?.length > 0) {
        setHistoryRows(
          history.map((scan) => ({
            id:           scan.scan_id,
            device:       `${scan.active_count}/${scan.total_devices} online`,
            site:         scan.site_name,
            alarmContent: scan.inactive_count > 0
                            ? `${scan.inactive_count} device(s) disconnected`
                            : "Normal",
            reason:       scan.line_ok ? `Line OK | Set master Port ${scan.active_port}` : `Line Broken | Set master Port ${scan.active_port}`,
            comment:      scan.severity === "warning" ? "⚠️ Warning" : "✅ OK",
            duration:     scan.scanned_at,
            creat:        scan.scanned_at,
            operations:   scan.scan_id,
          }))
        );
      }
    });
  }, []);

  // ─────────────────────────────────────────────────────────
  // WebSocket — real-time update when scan fault detected
  // Runs after gatewayId is available from API
  // When a fault arrives → update 3 things simultaneously:
  //   1. Banner notification
  //   2. Latest scan block
  //   3. Prepend new row to history table
  // → Page updates instantly without reload
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gatewayId) return;

    const token = sessionStorage.getItem("token");
    const ws = new WebSocket(
      `ws://${window.location.host}/ws/scan/${gatewayId}/?token=${token}`
    );

    ws.onopen = () => console.log("[WS Scan] Connected");

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.severity !== "warning") return;

        // 1. Show banner
        setFaults((prev) => [data, ...prev].slice(0, 5));
        setShowBanner(true);

        // 2. Update latest scan block without reloading
        setLatestScan((prev) => ({
          ...prev,
          scan_id:        data.scan_id,
          scanned_at:     new Date(data.timestamp).toLocaleString("en-GB"),
          severity:       data.severity,
          wire_p1_ok:     data.wire_p1_ok,
          wire_p2_ok:     data.wire_p2_ok,
          active_port:    data.active_port,
          total_devices:  data.total,
          active_count:   data.active_ids.length,
          inactive_count: data.inactive_ids.length,
          active_ids:     data.active_ids,
          inactive_ids:   data.inactive_ids,
        }));

        // 3. Prepend new row to history table
        setHistoryRows((prev) => [
          {
            id:           data.scan_id,
            device:       `${data.active_ids.length}/${data.total} online`,
            site:         latestScan?.site_name || "—",
            alarmContent: `${data.inactive_ids.length} device(s) disconnected`,
            reason:       data.line_ok ? `Line OK | Port ${data.active_port}` : `Line Broken | Port ${data.active_port}`,
            comment:      "⚠️ Warning",
            duration:     new Date(data.timestamp).toLocaleString("en-GB"),
            creat:        new Date(data.timestamp).toLocaleString("en-GB"),
            operations:   data.scan_id,
          },
          ...prev,
        ]);
      } catch (e) {
        console.error("[WS Scan] Parse error:", e);
      }
    };

    ws.onerror  = (e) => console.error("[WS Scan] Error:", e);
    ws.onclose  = ()  => console.warn("[WS Scan] Disconnected");

    // Cleanup on unmount or gatewayId change
    return () => ws.close();
  }, [gatewayId]);

  // ── Tab handler ───────────────────────────────────────────
  const handleClick = (type) => {
    if (type === "valid") {
      setColumn(valid);
      setSelected("valid");
    } else {
      setColumn(invalid);
      setSelected("invalid");
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", padding: "10px" }}>

      {/* Dropdown filter */}
      <Box sx={{ display: "flex", flexDirection: "row", width: "250px" }}>
        <MultiSelectDropdown options={option} value={change} onChange={setChange} />
      </Box>

      {/* ── Real-time fault banner (WebSocket) ───────────────
          Appears instantly when ESP32 sends scan result
          User can dismiss with X — data is kept in state   */}
      <Collapse in={showBanner && faults.length > 0}>
        {faults[0] && (
          <Alert
            severity="warning"
            icon={<WifiOffIcon />}
            sx={{ mt: 2, borderRadius: 2 }}
            action={
              <IconButton size="small" onClick={() => setShowBanner(false)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            }
          >
            <Typography fontWeight="bold" fontSize={14}>
              {faults[0].message}
            </Typography>
            <Box sx={{ mt: 0.5, display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
              <span>Offline devices:</span>
              {faults[0].inactive_ids.map((id) => (
                <Chip key={id} label={`ID ${id}`} color="error" size="small" />
              ))}
            </Box>
            <Box sx={{ mt: 0.5, fontSize: 13, color: "text.secondary" }}>
              Cable: {faults[0].line_ok ? "✅ Normal" : "❌ Broken"}&nbsp;|&nbsp;
              Active Port: {faults[0].active_port}&nbsp;|&nbsp;
              {new Date(faults[0].timestamp).toLocaleTimeString("en-GB")}
            </Box>
          </Alert>
        )}
      </Collapse>

      {/* ── Latest scan summary block ─────────────────────────
          Loaded from API on mount
          Auto-updated by WebSocket when new fault arrives   */}
      {latestScan && (
        <Box
          sx={{
            mt: 2, p: 2, borderRadius: 2,
            border: `1px solid ${
              latestScan.severity === "warning"
                ? theme.palette.warning.main
                : theme.palette.success.main
            }`,
            backgroundColor:
              latestScan.severity === "warning"
                ? "rgba(255,152,0,0.05)"
                : "rgba(76,175,80,0.05)",
          }}
        >
          {/* Header */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            {latestScan.severity === "warning" ? (
              <WifiOffIcon color="warning" fontSize="small" />
            ) : (
              <CheckCircleOutlineIcon color="success" fontSize="small" />
            )}
            <Typography fontWeight="bold" fontSize={14}>
              Latest Scan — {latestScan.scanned_at}
            </Typography>
            <Chip
              label={latestScan.severity === "warning" ? "Warning" : "OK"}
              color={latestScan.severity === "warning" ? "warning" : "success"}
              size="small"
            />
          </Box>

          {/* Summary info */}
          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", fontSize: 13 }}>
            <span>Site: <b>{latestScan.site_name}</b></span>
            <span>Devices: <b>{latestScan.active_count}/{latestScan.total_devices} online</b></span>
            <span>Active Port: <b>Port {latestScan.active_port}</b></span>
            <span>Cable: <b>{latestScan.line_ok ? "✅ Normal" : "❌ Broken"}</b></span>
          </Box>

          {/* Offline device list */}
          {latestScan.inactive_ids?.length > 0 && (
            <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
              <Typography fontSize={13}>Offline devices:</Typography>
              {latestScan.inactive_ids.map((id) => (
                <Chip key={id} label={`ID ${id}`} color="error" size="small" />
              ))}
            </Box>
          )}
        </Box>
      )}

      <Divider sx={{ mt: 2 }} />

      {/* ── Tab: Valid Rules / Invalid Rules ─────────────────── */}
      <Box sx={{ display: "flex", flexDirection: "row", gap: "20px", mt: 2 }}>
        <Button
          variant="text"
          sx={{
            color:         selected === "valid" ? theme.palette.text.header_option : theme.palette.text.option,
            fontWeight:    selected === "valid" ? "bold" : "normal",
            textTransform: "none",
            transition:    "color 1s",
            fontSize:      "16px",
          }}
          onClick={() => handleClick("valid")}
        >
          Valid Rules
        </Button>
        <Button
          variant="text"
          sx={{
            color:         selected === "invalid" ? theme.palette.text.header_option : theme.palette.text.option,
            fontWeight:    selected === "invalid" ? "bold" : "normal",
            textTransform: "none",
            transition:    "color 1s",
            fontSize:      "16px",
          }}
          onClick={() => handleClick("invalid")}
        >
          Invalid Rules
        </Button>
      </Box>

      {/* History table — populated from API + updated by WebSocket */}
      <Box>
        <SortTable columns={column} rows={historyRows} />
      </Box>

    </Box>
  );
}
