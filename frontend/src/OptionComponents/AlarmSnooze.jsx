import { Box, Button, Chip, Divider } from "@mui/material";
import { useState, useEffect }        from "react";
import { MultiSelectDropdown }        from "../InteractComponent/DropDownMulti";
import SortTable                      from "../TableDevice/SortTable";
import { useTheme }                   from "@mui/material/styles";
import { getData }                    from "../ApiComponent/api";
import ScanDetailModal                from "./ScanDetailModal";

// ── Columns khai báo NGOÀI component ──────────────────────────────────────
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

// ── Helper: chuyển 1 record lịch sử thành row cho bảng ───────────────────
function toRow(scan) {
  return {
    id:     scan.scan_id,
    device: `${scan.active_count}/${scan.total_devices} online`,
    site:   scan.site_name,

    // FIX: kiểm tra cả inactive_count VÀ line_ok
    // Trường hợp: inactive_count=0 nhưng line_ok=false
    // → thiết bị vẫn online qua port còn lại, nhưng dây vật lý bị đứt → hiện "Line Broken"
    alarmContent: scan.inactive_count > 0
      ? `${scan.inactive_count} device(s) disconnected`
      : !scan.line_ok
      ? "Line Broken"
      : "Normal",

    reason:  scan.line_ok
      ? `Line OK | Set master Port ${scan.active_port}`
      : `Line Broken | Set master Port ${scan.active_port}`,

    // FIX: cảnh báo khi dây đứt dù thiết bị vẫn online
    comment: (scan.severity === "warning" || !scan.line_ok) ? "⚠️ Warning" : "✅ Normal",

    duration:   scan.scanned_at,
    creat:      scan.scanned_at,
    operations: scan.scan_id,

    // raw data để ScanDetailModal dùng khi vẽ sơ đồ dây
    _raw: {
      wire_p1_ok:  scan.wire_p1_ok,
      wire_p2_ok:  scan.wire_p2_ok,
      line_ok:     scan.line_ok,
      active_port: scan.active_port,
      final_id_p1: scan.final_id_p1,
      final_id_p2: scan.final_id_p2,
    },
  };
}

// ── Helper: chuyển WebSocket payload thành row ────────────────────────────
function wsToRow(data, siteName) {
  const offCount = data.inactive_ids?.length ?? 0;
  return {
    id:     data.scan_id,
    device: `${data.active_ids.length}/${data.total} online`,
    site:   siteName || "—",

    // FIX: tương tự toRow — kiểm tra line_ok
    alarmContent: offCount > 0
      ? `${offCount} device(s) disconnected`
      : !data.line_ok
      ? "Line Broken"
      : "Normal",

    reason: data.line_ok
      ? `Line OK | set master Port ${data.active_port}`
      : `Line Broken | set master Port ${data.active_port}`,

    comment: (data.severity === "warning" || !data.line_ok) ? "⚠️ Warning" : "✅ Normal",

    duration:   new Date(data.timestamp).toLocaleString("en-GB"),
    creat:      new Date(data.timestamp).toLocaleString("en-GB"),
    operations: data.scan_id,

    _raw: {
      wire_p1_ok:  data.wire_p1_ok,
      wire_p2_ok:  data.wire_p2_ok,
      line_ok:     data.line_ok,
      active_port: data.active_port,
      final_id_p1: data.final_id_p1,
      final_id_p2: data.final_id_p2,
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════
export default function AlarmSnooze() {
  const theme  = useTheme();
  const option = ["TotalEnergies"];

  // ── State ──────────────────────────────────────────────────────────────
  const [change,        setChange]        = useState([]);
  const [selected,      setSelected]      = useState("valid");
  const [column,        setColumn]        = useState(valid);
  const [gatewayId,     setGatewayId]     = useState(null);
  const [siteName,      setSiteName]      = useState("—");
  const [historyRows,   setHistoryRows]   = useState([]);
  const [modalOpen,     setModalOpen]     = useState(false);
  const [selectedRow,   setSelectedRow]   = useState(null);
  const [deviceDetail,  setDeviceDetail]  = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Load dữ liệu khi mount ─────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      getData("/solardb/get-my-sites/"),
      getData("/solardb/get-scan-history/"),
    ]).then(([sites, history]) => {
      if (sites?.length > 0) {
        setGatewayId(sites[0].gateway_id.replace(/:/g, "_"));
        setSiteName(sites[0].site_name || "—");
      }
      if (history?.length > 0) {
        setHistoryRows(history.map(toRow));
      }
    });
  }, []);

  // ── WebSocket realtime ─────────────────────────────────────────────────
  useEffect(() => {
    if (!gatewayId) return;
    const token = sessionStorage.getItem("token");
    const ws    = new WebSocket(`ws://localhost:8000/ws/scan/${gatewayId}/?token=${token}`);
    ws.onopen    = () => console.log("[WS Scan] Connected");
    ws.onerror   = (e) => console.error("[WS Scan] Error:", e);
    ws.onclose   = ()  => console.warn("[WS Scan] Disconnected");
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.severity !== "warning") return;
        setHistoryRows((prev) => [wsToRow(data, siteName), ...prev]);
      } catch (e) {
        console.error("[WS Scan] Parse error:", e);
      }
    };
    return () => ws.close();
  }, [gatewayId, siteName]);

  // ── Click vào dòng bảng → mở modal chi tiết ───────────────────────────
  const handleRowClick = async (row) => {
    setSelectedRow(row);
    setDeviceDetail(null);
    setModalOpen(true);
    setDetailLoading(true);
    try {
      const detail = await getData(`/solardb/get-scan-devices/${row.id}/`);
      setDeviceDetail(detail);
    } catch (e) {
      console.error("Failed to load scan devices:", e);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedRow(null);
    setDeviceDetail(null);
  };

  const handleTabClick = (type) => {
    setColumn(type === "valid" ? valid : invalid);
    setSelected(type);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: "flex", flexDirection: "column", padding: "10px" }}>

      <Box sx={{ display: "flex", flexDirection: "row", width: "250px" }}>
        <MultiSelectDropdown options={option} value={change} onChange={setChange} />
      </Box>

      <Divider sx={{ mt: 2 }} />

      <Box sx={{ display: "flex", flexDirection: "row", gap: "20px", mt: 2 }}>
        <Button variant="text"
          sx={{ color: selected === "valid" ? theme.palette.text.header_option : theme.palette.text.option,
                fontWeight: selected === "valid" ? "bold" : "normal",
                textTransform: "none", transition: "color 1s", fontSize: "16px" }}
          onClick={() => handleTabClick("valid")}>
          Valid Rules
        </Button>
        <Button variant="text"
          sx={{ color: selected === "invalid" ? theme.palette.text.header_option : theme.palette.text.option,
                fontWeight: selected === "invalid" ? "bold" : "normal",
                textTransform: "none", transition: "color 1s", fontSize: "16px" }}
          onClick={() => handleTabClick("invalid")}>
          Invalid Rules
        </Button>
      </Box>

      <Box>
        <SortTable
          columns={column}
          rows={historyRows}
          onRowClick={handleRowClick}
        />
      </Box>

      <ScanDetailModal
        open={modalOpen}
        onClose={handleCloseModal}
        scan={selectedRow}
        detail={deviceDetail}
        loading={detailLoading}
      />

    </Box>
  );
}