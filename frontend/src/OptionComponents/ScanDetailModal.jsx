import { Dialog, DialogContent, DialogTitle, IconButton, Box, Typography, Chip, Divider, CircularProgress } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const COLOR = {
  ok:    "#3dd68c",
  err:   "#ff5c5c",
  port:  "#4f9eff",
  muted: "#7a849a",
  bg:    "#0d0f14",
};

// ─────────────────────────────────────────────────────────────────────────────
// analyzeWire — phân tích trạng thái dây và thiết bị
//
// 3 loại trạng thái:
//   "normal"         — dây nguyên, tất cả thiết bị online
//   "device_offline" — dây nguyên, nhưng có thiết bị không phản hồi  ← FIX
//   "single"         — dây đứt 1 chỗ
//   "double"         — dây đứt 2 chỗ
//
// Quy ước fp1, fp2 từ ESP32:
//   fp1 = index cuối cùng P1 thấy được (-1 nếu không thấy ai)
//   fp2 = index cuối cùng P2 thấy được (= count nếu không thấy ai)
// ─────────────────────────────────────────────────────────────────────────────
function analyzeWire(scan, detail) {
  if (!detail || !scan?._raw) return null;

  const devices    = detail.devices || [];
  const originalId = [...devices].sort((a, b) => a.modbus_id - b.modbus_id).map(d => d.modbus_id);
  const count      = originalId.length;
  if (count === 0) return null;

  const { wire_p1_ok, wire_p2_ok, final_id_p1: fp1, final_id_p2: fp2 } = scan._raw;
  const hasOffline = devices.some(d => d.status === "inactive");

  // ── Loại 1: Dây nguyên, tất cả thiết bị online ──
  if ((wire_p1_ok || wire_p2_ok) && !hasOffline)
    return { type: "normal", breaks: [], originalId, fp1, fp2, count };

  // ── Loại 2: Dây nguyên nhưng có thiết bị offline ──
  // KHÔNG vẽ BREAK — chỉ tô đỏ box thiết bị offline
  // Đây là lỗi thiết bị, không phải lỗi dây
  if ((wire_p1_ok || wire_p2_ok) && hasOffline)
    return { type: "device_offline", breaks: [], originalId, fp1, fp2, count };

  // ── Loại 3: Dây đứt — mới tính breaks và vẽ đường đứt ──
  const breaks = [];

  // Đoạn đầu: P1 không thấy ai → đứt đoạn P1↔ID[0]
  if (fp1 === -1)
    breaks.push({ segIndex: 0, desc: `P1 ✂ ID${originalId[0]}` });

  // Đoạn giữa: khoảng trống giữa phần P1 thấy và phần P2 thấy
  if (fp1 >= 0 && fp2 < count && fp1 + 1 <= fp2 - 1) {
    breaks.push({ segIndex: fp1 + 1, desc: `ID${originalId[fp1]} ✂ ID${originalId[fp1 + 1]}` });
    if (fp2 - 1 > fp1 + 1)
      breaks.push({ segIndex: fp2, desc: `ID${originalId[fp2 - 1]} ✂ ID${originalId[fp2]}` });
  } else if (fp1 >= 0 && fp2 < count && fp1 + 1 === fp2) {
    breaks.push({ segIndex: fp1 + 1, desc: `ID${originalId[fp1]} ✂ ID${originalId[fp2]}` });
  } else if (fp1 === -1 && fp2 < count - 1 && fp2 >= 0) {
    if (fp2 > 0)
      breaks.push({ segIndex: fp2, desc: `ID${originalId[fp2 - 1]} ✂ ID${originalId[fp2]}` });
  }

  // Đoạn cuối: P2 không thấy ai → đứt đoạn ID[count-1]↔P2
  if (fp2 === count)
    breaks.push({ segIndex: count, desc: `ID${originalId[count - 1]} ✂ P2` });

  const type = breaks.length === 0 ? "normal"
             : breaks.length === 1 ? "single"
             : "double";

  return { type, breaks, originalId, fp1, fp2, count };
}

function getDescription(analysis) {
  if (!analysis) return { text: "Loading...", color: COLOR.muted };
  const { type, breaks } = analysis;

  if (type === "normal")
    return { text: "✅ Cable line is normal. All devices are reachable.", color: COLOR.ok };

  // Dây nguyên nhưng thiết bị không phản hồi — lỗi thiết bị, không phải lỗi dây
  if (type === "device_offline")
    return { text: "⚠️ Cable is normal but some devices are not responding. Check device power or Modbus configuration.", color: "#f5c542" };

  if (type === "single")
    return { text: `⚠️ Single break at: ${breaks[0].desc}. Port 2 is used as fallback master.`, color: "#f5c542" };

  if (type === "double")
    return { text: `🔴 Two breaks — ${breaks[0].desc} | ${breaks[1].desc}. Devices between breaks are unreachable.`, color: COLOR.err };

  return { text: "Unknown state.", color: COLOR.muted };
}

function WireDiagram({ scan, detail }) {
  const analysis = analyzeWire(scan, detail);
  if (!analysis) return null;

  const { originalId, breaks, count } = analysis;
  const brokenSet = new Set(breaks.map(b => b.segIndex));
  const statusMap = {};
  (detail.devices || []).forEach(d => { statusMap[d.modbus_id] = d.status; });

  const NW = 54, NH = 38, GAP = 56, PW = 46, PH = 38, PAD = 20, Y = 52;
  const p1x   = PAD;
  const mXs   = Array.from({ length: count }, (_, i) => p1x + PW + GAP + i * (NW + GAP));
  const p2x   = mXs[count - 1] + NW + GAP;
  const SVG_W = p2x + PW + PAD;

  const Port = ({ x, label }) => (
    <g>
      <rect x={x} y={Y - PH / 2} width={PW} height={PH} rx={7}
            fill="rgba(79,158,255,0.1)" stroke={COLOR.port} strokeWidth={1.8} />
      <text x={x + PW / 2} y={Y - 3}  textAnchor="middle" fontSize="10" fill={COLOR.muted}>PORT</text>
      <text x={x + PW / 2} y={Y + 11} textAnchor="middle" fontSize="13" fontWeight="bold" fill={COLOR.port}>{label}</text>
    </g>
  );

  return (
    <Box sx={{ overflowX: "auto" }}>
      <svg width={SVG_W} height={130} style={{ display: "block", minWidth: SVG_W }}>

        {/* Vẽ các đoạn dây */}
        {Array.from({ length: count + 1 }, (_, seg) => {
          const broken = brokenSet.has(seg);
          const x1 = seg === 0     ? p1x + PW : mXs[seg - 1] + NW;
          const x2 = seg === count ? p2x       : mXs[seg];
          const mx = (x1 + x2) / 2;
          return (
            <g key={seg}>
              <line x1={x1} y1={Y} x2={x2} y2={Y}
                    stroke={broken ? COLOR.err : COLOR.ok}
                    strokeWidth={broken ? 1.8 : 2.5}
                    strokeDasharray={broken ? "7 5" : "none"}
                    opacity={broken ? 0.7 : 1} />
              {broken && (
                <g>
                  <circle cx={mx} cy={Y} r={9} fill={COLOR.bg} stroke={COLOR.err} strokeWidth={1.5} />
                  <text x={mx} y={Y + 4.5} textAnchor="middle" fontSize="11" fontWeight="bold" fill={COLOR.err}>✕</text>
                  <text x={mx} y={Y - 16}  textAnchor="middle" fontSize="9"  fill={COLOR.err} letterSpacing="0.5">BREAK</text>
                </g>
              )}
            </g>
          );
        })}

        {/* Port P1 */}
        <Port x={p1x} label="P1" />

        {/* Các thiết bị */}
        {originalId.map((id, i) => {
          const active = statusMap[id] === "active";
          const x = mXs[i];
          const c = active ? COLOR.ok : COLOR.err;
          return (
            <g key={id}>
              <rect x={x} y={Y - NH / 2} width={NW} height={NH} rx={7}
                    fill={active ? "rgba(61,214,140,0.1)" : "rgba(255,92,92,0.1)"}
                    stroke={c} strokeWidth={1.8} />
              <text x={x + NW / 2} y={Y - 3}           textAnchor="middle" fontSize="9"  fill={COLOR.muted}>ID</text>
              <text x={x + NW / 2} y={Y + 12}           textAnchor="middle" fontSize="14" fontWeight="bold" fill={c}>{id}</text>
              <text x={x + NW / 2} y={Y + NH / 2 + 15} textAnchor="middle" fontSize="9"  fill={c}>{active ? "online" : "offline"}</text>
            </g>
          );
        })}

        {/* Port P2 */}
        <Port x={p2x} label="P2" />
      </svg>
    </Box>
  );
}

export default function ScanDetailModal({ open, onClose, scan, detail, loading }) {
  if (!scan) return null;

  const analysis   = detail ? analyzeWire(scan, detail) : null;
  const desc       = getDescription(analysis);
  const raw        = scan._raw || {};
  const offlineIds = (detail?.devices || []).filter(d => d.status === "inactive").map(d => d.modbus_id);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
            PaperProps={{ sx: { bgcolor: "#141720", border: "1px solid #2a2f42", borderRadius: 2 } }}>

      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                         pb: 1, borderBottom: "1px solid #2a2f42" }}>
        <Box>
          <Typography fontWeight="bold" fontSize={15} color="#fff">Scan Detail</Typography>
          <Typography fontSize={12} color={COLOR.muted}>
            Scan ID: {scan.id} · {scan.duration} · Site: {scan.site}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" sx={{ color: COLOR.muted }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>

        {/* Thông báo trạng thái */}
        <Box sx={{ mb: 2, p: 1.5, borderRadius: 1, bgcolor: `${desc.color}11`, border: `1px solid ${desc.color}44` }}>
          {loading
            ? <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={14} />
                <Typography fontSize={13} color={COLOR.muted}>Analyzing wire state...</Typography>
              </Box>
            : <Typography fontSize={13} color={desc.color} lineHeight={1.6}>{desc.text}</Typography>
          }
        </Box>

        {/* Sơ đồ dây */}
        <Typography fontSize={11} color={COLOR.muted} sx={{ mb: 1, textTransform: "uppercase", letterSpacing: 1 }}>
          Wire Diagram
        </Typography>
        <Box sx={{ bgcolor: COLOR.bg, borderRadius: 1, p: 2, border: "1px solid #2a2f42",
                   minHeight: 100, display: "flex", alignItems: "center",
                   justifyContent: loading ? "center" : "flex-start" }}>
          {loading ? <CircularProgress size={28} /> : <WireDiagram scan={scan} detail={detail} />}
        </Box>

        {/* Chú thích màu */}
        <Box sx={{ mt: 1.5, display: "flex", gap: 2, flexWrap: "wrap" }}>
          {[
            { color: COLOR.ok,  label: "Normal wire",    type: "line" },
            { color: COLOR.err, label: "Break point",    type: "line" },
            { color: COLOR.ok,  label: "Online device",  type: "box"  },
            { color: COLOR.err, label: "Offline device", type: "box"  },
          ].map(({ color, label, type }) => (
            <Box key={label} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              {type === "line"
                ? <Box sx={{ width: 24, height: 2, bgcolor: color, borderRadius: 1 }} />
                : <Box sx={{ width: 14, height: 14, border: `1.5px solid ${color}`, borderRadius: 1, bgcolor: `${color}1a` }} />
              }
              <Typography fontSize={11} color={COLOR.muted}>{label}</Typography>
            </Box>
          ))}
        </Box>

        <Divider sx={{ my: 2, borderColor: "#2a2f42" }} />

        {/* Chip thông tin */}
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: offlineIds.length > 0 ? 1.5 : 0 }}>
          <Chip label={`Active Port: ${raw.active_port ?? "—"}`} size="small" variant="outlined"
                sx={{ color: COLOR.port, borderColor: `${COLOR.port}44`, fontSize: 12 }} />
          <Chip label={`Cable: ${raw.line_ok ? "✅ Normal" : "❌ Broken"}`} size="small" variant="outlined"
                sx={{ color: raw.line_ok ? COLOR.ok : COLOR.err,
                      borderColor: raw.line_ok ? `${COLOR.ok}44` : `${COLOR.err}44`, fontSize: 12 }} />
          <Chip label={scan.comment} size="small" variant="outlined"
                color={scan.comment?.includes("Warning") ? "warning" : "success"} sx={{ fontSize: 12 }} />
          <Chip label={scan.device} size="small" variant="outlined"
                sx={{ color: COLOR.muted, borderColor: "#2a2f42", fontSize: 12 }} />
        </Box>

        {/* Danh sách thiết bị offline */}
        {!loading && offlineIds.length > 0 && (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
            <Typography fontSize={12} color={COLOR.muted}>Offline devices:</Typography>
            {offlineIds.map(id => (
              <Chip key={id} label={`ID ${id}`} color="error" size="small" sx={{ fontSize: 11 }} />
            ))}
          </Box>
        )}

      </DialogContent>
    </Dialog>
  );
}
