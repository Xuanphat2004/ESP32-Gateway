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
function toRow(scan) { // toRow được gọi đúng 1 chỗ duy nhất, trong useEffect khi component mount
  return {
    id:           scan.scan_id,
    device:       `${scan.active_count}/${scan.total_devices} online`,
    site:         scan.site_name,
    alarmContent: scan.inactive_count > 0 ? `${scan.inactive_count} device(s) disconnected` : "Normal",
    reason:       scan.line_ok ? `Line OK | Set master Port ${scan.active_port}`: `Line Broken | Set master Port ${scan.active_port}`,
    comment:      scan.severity === "warning" ? "⚠️ Warning" : "✅ Normal",
    duration:     scan.scanned_at,
    creat:        scan.scanned_at,
    operations:   scan.scan_id,

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
  return {
    id:           data.scan_id,
    device:       `${data.active_ids.length}/${data.total} online`,
    site:         siteName || "—",
    alarmContent: `${data.inactive_ids.length} device(s) disconnected`,
    reason:       data.line_ok ? `Line OK | set master Port ${data.active_port}` : `Line Broken | set master Port ${data.active_port}`,
    comment:      "⚠️ Warning",
    duration:     new Date(data.timestamp).toLocaleString("en-GB"),
    creat:        new Date(data.timestamp).toLocaleString("en-GB"),
    operations:   data.scan_id,

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
  const [change,       setChange]       = useState([]);
  const [selected,     setSelected]     = useState("valid");
  const [column,       setColumn]       = useState(valid);
  const [gatewayId,    setGatewayId]    = useState(null);
  const [siteName,     setSiteName]     = useState("—");
  const [historyRows,  setHistoryRows]  = useState([]);

  // modal state
  const [modalOpen,    setModalOpen]    = useState(false);
  const [selectedRow,  setSelectedRow]  = useState(null);
  const [deviceDetail, setDeviceDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Load dữ liệu khi mount ─────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      getData("/solardb/get-my-sites/"), // HTTP GET
      getData("/solardb/get-scan-history/"), // HTTP GET
    ]).then(([sites, history]) => {

      if (sites?.length > 0) {
        // gateway_id dùng dấu "_" trong URL WebSocket (DB lưu ":")
        setGatewayId(sites[0].gateway_id.replace(/:/g, "_"));
        setSiteName(sites[0].site_name || "—");
      }

      if (history?.length > 0) {
        setHistoryRows(history.map(toRow));
      }
    });
  }, []);

  // ── WebSocket realtime ─────────────────────────────────────────────────
  // Chỉ chạy sau khi gatewayId có giá trị từ API
  // Khi nhận fault → prepend dòng mới lên đầu bảng (không reload, không banner)
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
        if (data.severity !== "warning") return; // Chỉ thêm dòng warning — bỏ qua OK để bảng không bị spam
        setHistoryRows((prev) => [wsToRow(data, siteName), ...prev]);
      } catch (e) {
        console.error("[WS Scan] Parse error:", e);
      }
    };
    return () => ws.close();
  }, [gatewayId, siteName]);

  // ── Click vào dòng bảng → mở modal chi tiết ───────────────────────────
  const handleRowClick = async (row) => {
    setSelectedRow(row); // Lưu lại dòng nào đang được click, để ScanDetailModal biết đang xem scan nào
    setDeviceDetail(null); // Xóa data chi tiết cũ (từ lần click trước), tránh modal hiện nhầm data của scan trước
    setModalOpen(true); // Mở modal ngay lập tức
    setDetailLoading(true);
    try {
      const detail = await getData(`/solardb/get-scan-devices/${row.id}/`);
      setDeviceDetail(detail);  // modal vẽ sơ đồ dây
    } 
    catch (e) { // Xử lý lỗi và kết thúc
      console.error("Failed to load scan devices:", e);
    } 
    finally {
      setDetailLoading(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);   // Đóng modal → modal biến mất
    setSelectedRow(null);  // Xóa dòng đang được chọn
    setDeviceDetail(null); // Xóa data chi tiết
  };

  // ── Tab handler ────────────────────────────────────────────────────────
  const handleTabClick = (type) => {
    setColumn(type === "valid" ? valid : invalid);
    setSelected(type);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: "flex", flexDirection: "column", padding: "10px" }}>

      {/* Dropdown filter */}
      <Box sx={{ display: "flex", flexDirection: "row", width: "250px" }}>
        <MultiSelectDropdown options={option} value={change} onChange={setChange} />
      </Box>

      <Divider sx={{ mt: 2 }} /> {/* Đường kẻ ngang */}

      {/* ── Tab: Valid Rules / Invalid Rules ─────────────────── */}
      <Box sx={{ display: "flex", flexDirection: "row", gap: "20px", mt: 2 }}> {/* 2 nút Tab */}
        <Button
          variant="text"
          sx={{
            color:         selected === "valid" ? theme.palette.text.header_option : theme.palette.text.option,       
            fontWeight:    selected === "valid" ? "bold" : "normal",
            textTransform: "none",
            transition:    "color 1s",
            fontSize:      "16px",
          }}
          onClick={() => handleTabClick("valid")}
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
          onClick={() => handleTabClick("invalid")}
        >
          Invalid Rules
        </Button>

      </Box>

      {/* Bảng lịch sử scan — click vào dòng để xem chi tiết sơ đồ dây */}
      <Box>
        <SortTable
          columns={column}            // danh sách cột (valid hoặc invalid)
          rows={historyRows}          // mảng dữ liệu từ API + WebSocket
          onRowClick={handleRowClick} // click vào dòng → mở modal
        />
      </Box>

      {/* Modal chi tiết sơ đồ dây — mở khi click vào dòng bảng */}
      {/* Modal luôn tồn tại trong code nhưng chỉ hiện ra màn hình khi modalOpen = true */}
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
