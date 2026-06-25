import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Box, Typography, Chip, Divider, Button, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableRow, TableCell, IconButton,
  Checkbox, FormControlLabel, TextField, InputAdornment,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getData, postData } from "../ApiComponent/api";
import BoltIcon          from "@mui/icons-material/Bolt";
import ElectricMeterIcon from "@mui/icons-material/ElectricMeter";
import ArrowBackIcon     from "@mui/icons-material/ArrowBack";
import LocationOnIcon    from "@mui/icons-material/LocationOn";
import RouterIcon        from "@mui/icons-material/Router";
import CloseIcon         from "@mui/icons-material/Close";
import ShowChartIcon     from "@mui/icons-material/ShowChart";
import SettingsIcon      from "@mui/icons-material/Settings";
import SearchIcon        from "@mui/icons-material/Search";

// ── Constants ────────────────────────────────────────────────────────────────
const STALE_SECONDS  = 120;
const MAX_PARAMS     = 12;

// ── Helpers ──────────────────────────────────────────────────────────────────
const isStale = (ts) => {
  if (!ts || ts === "--") return true;
  const d = new Date(ts);
  return isNaN(d.getTime()) || Date.now() - d.getTime() > STALE_SECONDS * 1000;
};

const fmtVal = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n.toFixed(2) : (v ?? "--");
};

const PARAM_PRIORITY = [
  /energy.*total|total.*energy|active_energy/i,
  /voltage.*l1|urmsa|^voltage_a/i,
  /voltage.*l2|urmsb|^voltage_b/i,
  /voltage.*l3|urmsc|^voltage_c/i,
  /current.*l1|irmsa|^current_a/i,
  /current.*l2|irmsb/i,
  /current.*l3|irmsc/i,
  /active.*power.*total|pmeant|real_power/i,
  /reactive.*power/i,
  /apparent.*power/i,
  /power.*factor.*total|pf_total/i,
  /frequency|freg/i,
  /temperature|temp/i,
];

const sortedParams = (paramMap) =>
  Object.values(paramMap)
    .sort((a, b) => {
      const ai = PARAM_PRIORITY.findIndex((p) => p.test(a.parameter_name));
      const bi = PARAM_PRIORITY.findIndex((p) => p.test(b.parameter_name));
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) ||
             a.parameter_name.localeCompare(b.parameter_name);
    })
    .slice(0, MAX_PARAMS);

// Cấu hình hiển thị cố định trong MeterCard — khớp layout hình tham khảo
// label: tên hiển thị | patterns: regex tìm register trong DB | unit: đơn vị fallback
const DISPLAY_CONFIG = [
  // Patterns cập nhật theo tên THỰC TẾ trong DB (từ debug log):
  //   Meter 1 (ID:1) : Total-Active-Power-Forward, Total-Reactive-Power,
  //                    Total-Apparent-Power, Grid-Frequency
  //   Meter 2 (ID:4) : Active-Power-L1, Apparent-Power-L1, Frequency-L1
  //   Meter 3 (ID:10): Real-Power-Total, Reactive-Power-Total,
  //                    Apparent-Power-Total, Power-Factor-Total

  { label: "Total Energy",
    patterns: [/real-energy-total/i, /active-energy.*total/i,
               /energy.*forward.*total/i, /active_energy_forward_t/i, /total.*energy/i],
    unit: "kWh" },

  { label: "Voltage L1",
    patterns: [/phase-a-voltage-l1/i, /^voltage-l1-n$/i, /voltage.*l1.*n/i,
               /urmsa$/i, /voltage.*l1$/i],
    unit: "V" },
  { label: "Voltage L2",
    patterns: [/phase-b-voltage-l2/i, /^voltage-l2-n$/i, /voltage.*l2.*n/i,
               /urmsb$/i, /voltage.*l2$/i],
    unit: "V" },
  { label: "Voltage L3",
    patterns: [/phase-c-voltage-l3/i, /^voltage-l3-n$/i, /voltage.*l3.*n/i,
               /urmsc$/i, /voltage.*l3$/i],
    unit: "V" },
  { label: "Avg Voltage (3P)",
    patterns: [/voltage-l-n-3p-avg/i, /voltage.*3p.*avg/i],
    unit: "V" },

  { label: "Current L1",
    patterns: [/^phase-a-current$/i, /^current-l1-n$/i, /^current-l1$/i,
               /irmsa$/i],
    unit: "A" },
  { label: "Current L2",
    patterns: [/^phase-b-current$/i, /^current-l2-n$/i, /^current-l2$/i,
               /irmsb$/i],
    unit: "A" },
  { label: "Current L3",
    patterns: [/^phase-c-current$/i, /^current-l3-n$/i, /^current-l3$/i,
               /irmsc$/i],
    unit: "A" },
  { label: "Avg Current (3P)",
    patterns: [/current-3p-avg/i, /current.*3p.*avg/i],
    unit: "A" },

  { label: "Active Power",
    patterns: [
      /total-active-power-forward/i,   // Meter 1: Total-Active-Power-Forward
      /^active-power-l1$/i,            // Meter 2: Active-Power-L1
      /real-power-total/i,             // Meter 3: Real-Power-Total
      /^pmeant/i, /real_power$/i,      // fallback
    ],
    unit: "W" },

  { label: "Reactive Power",
    patterns: [
      /total-reactive-power/i,         // Meter 1: Total-Reactive-Power
      /reactive-power-total/i,         // Meter 3: Reactive-Power-Total
      /^qmeant$/i,
    ],
    unit: "VAr" },

  { label: "Apparent Power",
    patterns: [
      /total-apparent-power/i,         // Meter 1: Total-Apparent-Power
      /^apparent-power-l1$/i,          // Meter 2: Apparent-Power-L1
      /apparent-power-total/i,         // Meter 3: Apparent-Power-Total
      /^sameant$/i,
    ],
    unit: "VA" },

  { label: "Power Factor",
    patterns: [
      /total-power-factor/i,           // Meter 1 (dự đoán)
      /^power-factor-l1$/i,            // Meter 2 (dự đoán)
      /power-factor-total/i,           // Meter 3: Power-Factor-Total
      /^pf-total$/i, /^pf_total$/i, /^pf-l1$/i,
    ],
    unit: "-" },

  { label: "Frequency",
    patterns: [
      /^grid-frequency$/i,             // Meter 1: Grid-Frequency
      /^frequency-l1$/i,               // Meter 2: Frequency-L1
      /^frequency$/i, /^freg$/i,       // Meter 3 / fallback
    ],
    unit: "Hz" },

  { label: "Temperature",
    patterns: [/^temp$/i, /temperature/i],
    unit: "°C" },
];

// Tìm register trong paramMap khớp với patterns của 1 mục DISPLAY_CONFIG
const findReg = (paramMap, patterns) => {
  const keys = Object.keys(paramMap);
  for (const pat of patterns) {
    const found = keys.find((k) => pat.test(k));
    if (found) return paramMap[found];
  }
  return null;
};


// ════════════════════════════════════════════════════════════════════════════
// MÀN HÌNH 1 — DANH SÁCH SITE
// ════════════════════════════════════════════════════════════════════════════

function SiteCard({ site, summary, loading, onSelect }) {
  const theme   = useTheme();
  const accent  = theme.palette.text.header_option || "#08ffff";
  const cardBg  = theme.palette.background.box     || "#0d1b2a";
  const headBg  = theme.palette.background.head_box || "#0a1628";
  const divClr  = theme.palette.divider             || "#1f2d3a";

  const power  = summary?.total_power  != null ? Number(summary.total_power).toFixed(1)  : "--";
  const energy = summary?.total_energy != null ? Number(summary.total_energy).toFixed(2) : "--";

  return (
    <Box
      onClick={onSelect}
      sx={{
        backgroundColor: cardBg,
        border: `1px solid ${divClr}`,
        borderRadius: 2,
        overflow: "hidden",
        cursor: "pointer",
        transition: "border-color 0.2s, transform 0.15s",
        "&:hover": {
          borderColor: accent,
          transform: "translateY(-2px)",
          boxShadow: `0 4px 20px rgba(0,0,0,0.4)`,
        },
      }}
    >
      {/* Header */}
      <Box sx={{
        backgroundColor: headBg,
        px: 2, py: 1.5,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: `1px solid ${divClr}`,
      }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <ElectricMeterIcon sx={{ color: accent, fontSize: 18 }} />
          <Typography sx={{ color: accent, fontWeight: 700, fontSize: 14, letterSpacing: 0.5 }}>
            {site.site_name}
          </Typography>
        </Box>
        <Box sx={{
          width: 8, height: 8, borderRadius: "50%",
          backgroundColor: summary ? "#4caf50" : "#f44336",
          boxShadow: summary ? "0 0 6px #4caf50" : "none",
        }} />
      </Box>

      {/* Body */}
      <Box sx={{ px: 2, py: 1.5 }}>
        {/* Location */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1.5 }}>
          <LocationOnIcon sx={{ color: "#546e7a", fontSize: 13 }} />
          <Typography sx={{ color: "#607d8b", fontSize: 11 }}>
            {site.location || "—"}
          </Typography>
        </Box>

        {/* Metrics */}
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
            <CircularProgress size={18} sx={{ color: accent }} />
          </Box>
        ) : (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Box sx={{
              flex: 1, backgroundColor: headBg, borderRadius: 1, p: 1,
              textAlign: "center", border: `1px solid ${divClr}`,
            }}>
              <Typography sx={{ color: "#546e7a", fontSize: 9, letterSpacing: 0.5 }}>
                ACTIVE POWER
              </Typography>
              <Typography sx={{
                color: "#00e5ff", fontWeight: 700, fontSize: 18,
                fontFamily: "monospace", mt: 0.3,
              }}>
                {power}
              </Typography>
              <Typography sx={{ color: "#546e7a", fontSize: 10 }}>W</Typography>
            </Box>
            <Box sx={{
              flex: 1, backgroundColor: headBg, borderRadius: 1, p: 1,
              textAlign: "center", border: `1px solid ${divClr}`,
            }}>
              <Typography sx={{ color: "#546e7a", fontSize: 9, letterSpacing: 0.5 }}>
                TOTAL ENERGY
              </Typography>
              <Typography sx={{
                color: "#69f0ae", fontWeight: 700, fontSize: 18,
                fontFamily: "monospace", mt: 0.3,
              }}>
                {energy}
              </Typography>
              <Typography sx={{ color: "#546e7a", fontSize: 10 }}>kWh</Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{
        px: 2, py: 1, borderTop: `1px solid ${divClr}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <RouterIcon sx={{ color: "#546e7a", fontSize: 13 }} />
          <Typography sx={{ color: "#546e7a", fontSize: 10 }}>
            {site.gateway_id ?? "—"}
          </Typography>
        </Box>
        <Typography sx={{ color: accent, fontSize: 11, fontWeight: 600 }}>
          View Details →
        </Typography>
      </Box>
    </Box>
  );
}

function SiteListScreen({ onSelectSite }) {
  const theme   = useTheme();
  const accent  = theme.palette.text.header_option || "#08ffff";

  const [sites,     setSites]     = useState([]);
  const [summaries, setSummaries] = useState({});
  const [loading,   setLoading]   = useState(true);
  const [loadingSummary, setLoadingSummary] = useState({});

  useEffect(() => {
    getData("/solardb/get-my-sites/").then(async (data) => {
      if (!data) { setLoading(false); return; }
      setSites(data);
      setLoading(false);

      // Fetch summary cho từng site song song
      const initLoading = {};
      data.forEach(s => { initLoading[s.site_id] = true; });
      setLoadingSummary(initLoading);

      const results = await Promise.allSettled(
        data.map((s) => getData(`/solardb/get-site-summary/${s.site_id}/`))
      );
      const sMap = {};
      const doneLoading = {};
      data.forEach((s, i) => {
        const r = results[i];
        if (r.status === "fulfilled" && r.value && !r.value.error) {
          sMap[s.site_id] = r.value;
        }
        doneLoading[s.site_id] = false;
      });
      setSummaries(sMap);
      setLoadingSummary(doneLoading);
    });
  }, []);

  return (
    <Box sx={{ p: 3, height: "100%", overflowY: "auto" }}>
      {/* Tiêu đề */}
      <Box sx={{ mb: 3 }}>
        <Typography sx={{
          color: accent, fontWeight: 700, fontSize: 20, letterSpacing: 1,
        }}>
          SITE VIEW
        </Typography>
        <Typography sx={{ color: "#546e7a", fontSize: 12, mt: 0.3 }}>
          {sites.length} site{sites.length !== 1 ? "s" : ""} available — select a site to view details
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress sx={{ color: accent }} />
        </Box>
      ) : sites.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <ElectricMeterIcon sx={{ fontSize: 48, color: "#263238" }} />
          <Typography sx={{ color: "#37474f", mt: 1 }}>
            No sites found. Create a site first.
          </Typography>
        </Box>
      ) : (
        <Box sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 2,
        }}>
          {sites.map((site) => (
            <SiteCard
              key={site.site_id}
              site={site}
              summary={summaries[site.site_id]}
              loading={loadingSummary[site.site_id]}
              onSelect={() => onSelectSite(site.site_id)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// METER DETAIL MODAL — hiện tất cả tham số theo kiểu bảng như hình tham khảo
// ════════════════════════════════════════════════════════════════════════════
function MeterDetailModal({ open, onClose, meter, registers }) {
  const theme  = useTheme();
  const accent = theme.palette.text.header_option  || "#08ffff";
  const headBg = theme.palette.background.head_box || "#0a1628";
  const divClr = theme.palette.divider             || "#1f2d3a";

  if (!meter) return null;

  const online = meter.status === "Online";

  // Tất cả tham số — sắp xếp theo priority, KHÔNG giới hạn số lượng
  const allParams = Object.values(registers)
    .sort((a, b) => {
      const ai = PARAM_PRIORITY.findIndex((p) => p.test(a.parameter_name));
      const bi = PARAM_PRIORITY.findIndex((p) => p.test(b.parameter_name));
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) ||
             a.parameter_name.localeCompare(b.parameter_name);
    });

  // Timestamp mới nhất của batch
  const lastUpdate = allParams.length > 0 && allParams[0].timestamp
    ? new Date(allParams[0].timestamp).toLocaleString("vi-VN")
    : "--";

  // Chia 2 cột nếu nhiều tham số
  const half = Math.ceil(allParams.length / 2);
  const col1 = allParams.slice(0, half);
  const col2 = allParams.slice(half);

  const ParamRow = ({ reg, shade }) => (
    <TableRow sx={{ backgroundColor: shade ? (theme.palette.table?.background_odd || "#0d1b2a")
                                           : (theme.palette.table?.background_even || "#0f1f2e") }}>
      <TableCell sx={{ color: theme.palette.table?.text || "#9cb4c5",
                       fontSize: 12, py: 0.6, px: 1.5, borderBottom: `1px solid ${divClr}`,
                       whiteSpace: "nowrap" }}>
        {reg.parameter_name?.replace(/_/g, " ")}
      </TableCell>
      <TableCell align="right"
        sx={{ color: "#e0f2f1", fontWeight: 700, fontSize: 13, py: 0.6, px: 1,
              borderBottom: `1px solid ${divClr}`, fontFamily: "monospace",
              minWidth: 80 }}>
        {fmtVal(reg.value)}
      </TableCell>
      <TableCell sx={{ color: "#546e7a", fontSize: 11, py: 0.6, px: 1,
                       borderBottom: `1px solid ${divClr}`, minWidth: 44 }}>
        {reg.unit || "—"}
      </TableCell>
    </TableRow>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: theme.palette.background.box || "#0d1b2a",
          border: `1px solid ${divClr}`,
          borderRadius: 2,
          backgroundImage: "none",
        },
      }}
    >
      {/* ── Header ── */}
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{
          backgroundColor: headBg,
          px: 2.5, py: 1.5,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          borderBottom: `1px solid ${divClr}`,
        }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <ElectricMeterIcon sx={{ color: accent, fontSize: 22 }} />
            <Box>
              <Typography sx={{ color: accent, fontWeight: 700, fontSize: 16, letterSpacing: 0.5 }}>
                {meter.meter_name ?? `METER ${meter.meter_id}`}
              </Typography>
              <Typography sx={{ color: "#546e7a", fontSize: 11 }}>
                Last update: {lastUpdate}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {/* Status chip to lớn — giống nút "Run" trong hình tham khảo */}
            <Box sx={{
              px: 2.5, py: 0.6, borderRadius: 1,
              backgroundColor: online ? "#1b5e20" : "#7f0000",
              border: `1px solid ${online ? "#4caf50" : "#f44336"}`,
              display: "flex", alignItems: "center", gap: 0.8,
            }}>
              <Box sx={{
                width: 8, height: 8, borderRadius: "50%",
                backgroundColor: online ? "#69f0ae" : "#ef9a9a",
                boxShadow: online ? "0 0 5px #69f0ae" : "none",
              }} />
              <Typography sx={{ color: online ? "#69f0ae" : "#ef9a9a",
                                fontWeight: 700, fontSize: 13 }}>
                {online ? "Online" : "Offline"}
              </Typography>
            </Box>
            <IconButton onClick={onClose} size="small"
              sx={{ color: "#546e7a", "&:hover": { color: "#fff" } }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      {/* ── Body: 2 cột tham số ── */}
      <DialogContent sx={{ p: 1.5 }}>
        {allParams.length === 0 ? (
          <Box sx={{ py: 6, textAlign: "center" }}>
            <Typography sx={{ color: "#37474f" }}>No data received yet.</Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
            {/* Cột 1 */}
            <Box sx={{ flex: 1, border: `1px solid ${divClr}`, borderRadius: 1, overflow: "hidden" }}>
              <Box sx={{ backgroundColor: headBg, px: 1.5, py: 0.6,
                         borderBottom: `1px solid ${divClr}` }}>
                <Typography sx={{ color: accent, fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>
                  PARAMETER
                </Typography>
              </Box>
              <Table size="small">
                <TableBody>
                  {col1.map((reg, i) => (
                    <ParamRow key={reg.parameter_name} reg={reg} shade={i % 2 === 0} />
                  ))}
                </TableBody>
              </Table>
            </Box>

            {/* Cột 2 (chỉ hiện nếu có data) */}
            {col2.length > 0 && (
              <Box sx={{ flex: 1, border: `1px solid ${divClr}`, borderRadius: 1, overflow: "hidden" }}>
                <Box sx={{ backgroundColor: headBg, px: 1.5, py: 0.6,
                           borderBottom: `1px solid ${divClr}` }}>
                  <Typography sx={{ color: accent, fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>
                    PARAMETER
                  </Typography>
                </Box>
                <Table size="small">
                  <TableBody>
                    {col2.map((reg, i) => (
                      <ParamRow key={reg.parameter_name} reg={reg} shade={i % 2 === 0} />
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      {/* ── Footer ── */}
      <DialogActions sx={{ px: 2, py: 1.2, borderTop: `1px solid ${divClr}`,
                           backgroundColor: headBg }}>
        <Typography sx={{ color: "#546e7a", fontSize: 11, flex: 1 }}>
          {allParams.length} parameter{allParams.length !== 1 ? "s" : ""} displayed
        </Typography>
        <Button size="small" startIcon={<ShowChartIcon />}
          variant="outlined" onClick={onClose}
          sx={{ color: "#42a5f5", borderColor: "#42a5f5",
                "&:hover": { backgroundColor: "#42a5f518" } }}>
          View Chart
        </Button>
        <Button size="small" variant="outlined" onClick={onClose}
          sx={{ color: "#546e7a", borderColor: "#546e7a" }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}




// ════════════════════════════════════════════════════════════════════════════
// DIALOG CHỈNH SỬA THAM SỐ HIỂN THỊ TRÊN CARD
// ════════════════════════════════════════════════════════════════════════════
function CardConfigDialog({ open, onClose, meter, registers, savedParams, onSave }) {
  const theme  = useTheme();
  const accent = theme.palette.text.header_option  || "#08ffff";
  const headBg = theme.palette.background.head_box || "#0a1628";
  const divClr = theme.palette.divider             || "#1f2d3a";

  // Tất cả tên tham số có trong register hiện tại
  const allParams = Object.keys(registers).sort();

  // State local: danh sách đang chọn + filter search
  const [selected, setSelected] = useState([]);
  const [search,   setSearch]   = useState("");
  const [saving,   setSaving]   = useState(false);

  // Khi mở dialog → load config đã lưu (hoặc mặc định tất cả)
  useEffect(() => {
    if (open) {
      setSelected(savedParams.length > 0 ? [...savedParams] : [...allParams]);
      setSearch("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = allParams.filter((p) =>
    p.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (param) => {
    setSelected((prev) =>
      prev.includes(param) ? prev.filter((p) => p !== param) : [...prev, param]
    );
  };

  const selectAll   = () => setSelected([...allParams]);
  const deselectAll = () => setSelected([]);

  const handleSave = async () => {
    setSaving(true);
    await postData(`/solardb/card-config/${meter.meter_id}/save/`, { params: selected });
    setSaving(false);
    onSave(meter.meter_id, selected);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: theme.palette.background.box || "#0d1b2a",
          border: `1px solid ${divClr}`,
          borderRadius: 2,
          backgroundImage: "none",
        },
      }}
    >
      {/* Header */}
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{
          backgroundColor: headBg,
          px: 2.5, py: 1.5,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          borderBottom: `1px solid ${divClr}`,
        }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <SettingsIcon sx={{ color: accent, fontSize: 18 }} />
            <Box>
              <Typography sx={{ color: accent, fontWeight: 700, fontSize: 15 }}>
                Configure Card
              </Typography>
              <Typography sx={{ color: "#546e7a", fontSize: 11 }}>
                {meter?.meter_name} — select parameters to display
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={onClose}
            sx={{ color: "#546e7a", "&:hover": { color: "#fff" } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      {/* Body */}
      <DialogContent sx={{ p: 2 }}>
        {/* Search */}
        <TextField
          size="small"
          fullWidth
          placeholder="Search parameter..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "#546e7a", fontSize: 18 }} />
              </InputAdornment>
            ),
            sx: { color: "#e0e0e0", backgroundColor: headBg, fontSize: 13 },
          }}
          sx={{ mb: 1.5, "& .MuiOutlinedInput-notchedOutline": { borderColor: divClr } }}
        />

        {/* Select all / Deselect all */}
        <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
          <Button size="small" variant="outlined" onClick={selectAll}
            sx={{ fontSize: 11, color: accent, borderColor: accent, py: 0.2 }}>
            Select All
          </Button>
          <Button size="small" variant="outlined" onClick={deselectAll}
            sx={{ fontSize: 11, color: "#546e7a", borderColor: "#546e7a", py: 0.2 }}>
            Clear All
          </Button>
          <Typography sx={{ color: "#546e7a", fontSize: 11, ml: "auto", alignSelf: "center" }}>
            {selected.length} / {allParams.length} selected
          </Typography>
        </Box>

        {/* Danh sách tham số */}
        {allParams.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography sx={{ color: "#37474f", fontSize: 13 }}>
              No register data received yet for this meter.
            </Typography>
          </Box>
        ) : (
          <Box sx={{
            maxHeight: 320, overflowY: "auto",
            border: `1px solid ${divClr}`, borderRadius: 1,
            "&::-webkit-scrollbar": { width: 5 },
            "&::-webkit-scrollbar-thumb": { backgroundColor: headBg },
          }}>
            {filtered.map((param, i) => {
              const reg  = registers[param];
              const isOn = selected.includes(param);
              return (
                <Box
                  key={param}
                  onClick={() => toggle(param)}
                  sx={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    px: 1.5, py: 0.6, cursor: "pointer",
                    backgroundColor: i % 2 === 0
                      ? (theme.palette.table?.background_odd  || "#0d1b2a")
                      : (theme.palette.table?.background_even || "#0f1f2e"),
                    borderBottom: `1px solid ${divClr}`,
                    opacity: isOn ? 1 : 0.45,
                    "&:hover": { opacity: 1, filter: "brightness(1.3)" },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Checkbox
                      checked={isOn}
                      size="small"
                      sx={{ p: 0, color: "#546e7a", "&.Mui-checked": { color: accent } }}
                    />
                    <Typography sx={{ color: "#b0bec5", fontSize: 12 }}>
                      {param}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
                    <Typography sx={{ color: "#69f0ae", fontSize: 12, fontFamily: "monospace" }}>
                      {reg?.value != null ? fmtVal(reg.value) : "--"}
                    </Typography>
                    <Typography sx={{ color: "#546e7a", fontSize: 10 }}>
                      {reg?.unit || ""}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>

      {/* Footer */}
      <DialogActions sx={{ px: 2, py: 1.2, borderTop: `1px solid ${divClr}`, backgroundColor: headBg }}>
        <Button size="small" variant="outlined" onClick={onClose}
          sx={{ color: "#546e7a", borderColor: "#546e7a" }}>
          Cancel
        </Button>
        <Button size="small" variant="contained" onClick={handleSave}
          disabled={saving || selected.length === 0}
          sx={{ backgroundColor: accent, color: "#000", fontWeight: 700,
                "&:hover": { backgroundColor: accent, opacity: 0.85 },
                "&.Mui-disabled": { backgroundColor: "#37474f", color: "#546e7a" } }}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}


function MeterCard({ meter, registers, cardParams, onDetail, onChart, onSettings }) {
  const theme    = useTheme();
  const online   = meter.status === "Online";
  const accent   = theme.palette.text.header_option      || "#08ffff";
  const headBg   = theme.palette.background.head_box     || "#0a1628";
  const cardBg   = theme.palette.background.box          || "#0d1b2a";
  const rowOdd   = theme.palette.table?.background_odd   || "#0d1b2a";
  const rowEven  = theme.palette.table?.background_even  || "#0f1f2e";
  const textClr  = theme.palette.table?.text             || "#9cb4c5";
  const divClr   = theme.palette.divider                 || "#1f2d3a";
  const GREEN    = "#4caf50";

  // Nếu user đã lưu config → dùng params đó; không thì fallback DISPLAY_CONFIG
  const rows = cardParams && cardParams.length > 0
    ? cardParams.map((paramName) => {
        const reg = registers[paramName];
        return {
          label: paramName.replace(/-/g, " "),
          value: reg ? fmtVal(reg.value) : "--",
          unit:  reg?.unit || "--",
        };
      })
    : DISPLAY_CONFIG.map((cfg) => {
        const reg = findReg(registers, cfg.patterns);
        return {
          label: cfg.label,
          value: reg ? fmtVal(reg.value) : "--",
          unit:  reg?.unit || cfg.unit,
        };
      });

  return (
    <Box sx={{
      display: "flex", flexDirection: "column",
      backgroundColor: cardBg,
      border: `1px solid ${divClr}`,
      borderRadius: 1, overflow: "hidden", minWidth: 0,
    }}>
      {/* Header */}
      <Box sx={{
        backgroundColor: headBg, px: 1.5, py: 0.8,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: `1px solid ${divClr}`,
      }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, minWidth: 0, flex: 1 }}>
          <ElectricMeterIcon sx={{ color: accent, fontSize: 15, flexShrink: 0 }} />
          <Typography sx={{
            color: accent, fontWeight: 700, fontSize: 12, letterSpacing: 0.5,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {meter.meter_name ?? `METER ${meter.meter_id}`}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
          <Chip label={online ? "Online" : "Offline"} size="small"
            sx={{
              backgroundColor: online ? "#1b5e20" : "#7f0000",
              color: online ? "#69f0ae" : "#ef9a9a",
              fontWeight: 700, fontSize: 10, height: 20,
              border: `1px solid ${online ? "#2e7d32" : "#c62828"}`,
            }}
          />
          <IconButton size="small" onClick={onSettings}
            sx={{ color: "#546e7a", p: 0.3, "&:hover": { color: accent } }}>
            <SettingsIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Rows — cố định theo DISPLAY_CONFIG */}
      <Box sx={{ flex: 1 }}>
        {rows.map((row, i) => (
          <Box key={row.label} sx={{
            display: "flex", alignItems: "center", px: 1.5, py: 0.4,
            backgroundColor: i % 2 === 0 ? rowOdd : rowEven,
            borderBottom: `1px solid ${divClr}`,
          }}>
            {/* Tên tham số */}
            <Typography sx={{
              color: textClr, fontSize: 11, flex: 1, minWidth: 0,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {row.label}
            </Typography>
            {/* Giá trị — màu xanh lá */}
            <Typography sx={{
              color: row.value === "--" ? "#37474f" : GREEN,
              fontWeight: 700, fontSize: 12,
              minWidth: 60, textAlign: "right", fontFamily: "monospace",
            }}>
              {row.value}
            </Typography>
            {/* Đơn vị */}
            <Typography sx={{
              color: "#546e7a", fontSize: 10,
              minWidth: 36, textAlign: "right", ml: 0.5,
            }}>
              {row.unit}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Buttons */}
      <Box sx={{
        display: "flex", gap: 0.8, p: 0.8,
        borderTop: `1px solid ${divClr}`, backgroundColor: headBg,
      }}>
        <Button size="small" variant="outlined" onClick={onDetail}
          sx={{ flex: 1, fontSize: 11, py: 0.2, color: accent, borderColor: accent,
                "&:hover": { backgroundColor: `${accent}18` } }}>
          Detail
        </Button>
        <Button size="small" variant="outlined" onClick={onChart}
          sx={{ flex: 1, fontSize: 11, py: 0.2, color: "#42a5f5", borderColor: "#42a5f5",
                "&:hover": { backgroundColor: "#42a5f518" } }}>
          Chart
        </Button>
      </Box>
    </Box>
  );
}


function SiteDetailScreen({ siteId, onBack }) {
  const theme    = useTheme();
  const navigate = useNavigate();
  const accent   = theme.palette.text.header_option  || "#08ffff";
  const panelBg  = theme.palette.background.box      || "#0d1b2a";
  const headBg   = theme.palette.background.head_box || "#0a1628";
  const divClr   = theme.palette.divider             || "#1f2d3a";

  const [siteInfo,      setSiteInfo]      = useState(null);
  const [meterList,     setMeterList]     = useState([]);
  const [meterOverview, setMeterOverview] = useState({});
  const [meterRegs,     setMeterRegs]     = useState({});
  const [summary,       setSummary]       = useState(null);
  const [detailMeter,   setDetailMeter]   = useState(null);
  const [cardConfigs,   setCardConfigs]   = useState({});   // { [meter_id]: string[] }
  const [configMeter,   setConfigMeter]   = useState(null); // meter đang mở dialog settings
  const wsRegRefs = useRef([]);
  const wsOverRef = useRef(null);

  // Site info
  useEffect(() => {
    getData("/solardb/get-my-sites/").then((sites) => {
      if (!sites) return;
      const s = sites.find((x) => String(x.site_id) === String(siteId));
      if (s) setSiteInfo(s);
    });
  }, [siteId]);

  // Site summary (mỗi 30s)
  useEffect(() => {
    const fetch = () =>
      getData(`/solardb/get-site-summary/${siteId}/`).then((d) => {
        if (d && !d.error) setSummary(d);
      });
    fetch();
    const t = setInterval(fetch, 30_000);
    return () => clearInterval(t);
  }, [siteId]);

  // Fetch meter list (1 lần) — lọc theo siteId nếu response có site_id
  useEffect(() => {
    getData("/solardb/get-latest-meter-records/").then((data) => {
      if (!data) return;
      // Thử lọc theo site_id; nếu không có field thì lấy tất cả
      const hasSiteId = data.some((m) => m.site_id != null);
      const filtered  = hasSiteId
        ? data.filter((m) => String(m.site_id) === String(siteId))
        : data;
      setMeterList(
        filtered.map((m) => ({
          meter_id:   m.meter_id,
          meter_name: m.meter_name ?? `Meter ${m.meter_id}`,
        }))
      );
    });
  }, [siteId]);

  // Load card config cho từng meter sau khi có meterList
  useEffect(() => {
    if (!meterList.length) return;
    meterList.forEach(async (meter) => {
      const data = await getData(`/solardb/card-config/${meter.meter_id}/`);
      if (data && Array.isArray(data.params)) {
        setCardConfigs((prev) => ({ ...prev, [meter.meter_id]: data.params }));
      }
    });
  }, [meterList]);

  // Callback sau khi user lưu config từ dialog
  const handleSaveConfig = useCallback((meterId, params) => {
    setCardConfigs((prev) => ({ ...prev, [meterId]: params }));
  }, []);

  // WS overview (status + real_power)
  useEffect(() => {
    if (wsOverRef.current) wsOverRef.current.close();
    const token = sessionStorage.getItem("token");
    const ws = new WebSocket(`ws://localhost:8000/ws/meter/${siteId}/?token=${token}`);
    wsOverRef.current = ws;
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      const ov = {};
      data.forEach((m) => {
        ov[m.meter_id] = { status: m.status, real_power: m.real_power, timestamp: m.timestamp };
      });
      setMeterOverview(ov);
    };
    ws.onerror = () => console.error("[SiteDetail] Overview WS error");
    return () => ws.close();
  }, [siteId]);

  // Fetch dữ liệu ban đầu cho từng meter qua HTTP ──────────────────────────
  // WS chỉ gửi data khi có MQTT message mới → không có gì hiện ngay khi load.
  // Fetch HTTP trước để hiện data ngay lập tức, WS cập nhật realtime sau đó.
  // Polling mỗi 30s để giữ data mới kể cả khi WS không hoạt động.
  useEffect(() => {
    if (!meterList.length) return;

    const fetchAllMeters = () => {
      meterList.forEach(async (meter) => {
        const data = await getData(`/solardb/get-meter-registers/${meter.meter_id}/`);
        if (!data || !Array.isArray(data)) return;
        const paramMap = {};
        data.forEach((r) => {
          if (r.parameter_name) {
            paramMap[r.parameter_name] = {
              parameter_name: r.parameter_name,
              value:          r.value,
              unit:           r.unit,
              timestamp:      r.timestamp,
            };
          }
        });
        setMeterRegs((prev) => ({ ...prev, [meter.meter_id]: paramMap }));
      });
    };

    fetchAllMeters();                              // chạy ngay lập tức khi load
    const t = setInterval(fetchAllMeters, 30_000); // polling mỗi 30s
    return () => clearInterval(t);
  }, [meterList]);

  // WS mỗi meter (registers)
  useEffect(() => {
    if (!meterList.length) return;
    const token = sessionStorage.getItem("token");
    wsRegRefs.current.forEach((ws) => ws.close());
    wsRegRefs.current = [];
    meterList.forEach((meter) => {
      const ws = new WebSocket(`ws://localhost:8000/ws/meter_register/${meter.meter_id}/?token=${token}`);
      ws.onmessage = (e) => {
        const rows = JSON.parse(e.data);
        const paramMap = {};
        rows.forEach((r) => { paramMap[r.parameter_name] = r; });
        setMeterRegs((prev) => ({ ...prev, [meter.meter_id]: paramMap }));
      };
      wsRegRefs.current.push(ws);
    });
    return () => { wsRegRefs.current.forEach((ws) => ws.close()); wsRegRefs.current = []; };
  }, [meterList]);

  // Computed
  const meters = useMemo(() =>
    meterList.map((m) => {
      const ov    = meterOverview[m.meter_id] ?? {};
      const online = !isStale(ov.timestamp) && ov.status === "Online";
      return { ...m, status: online ? "Online" : "Offline", real_power: ov.real_power ?? 0 };
    }),
    [meterList, meterOverview]
  );

  const metersOnline  = meters.filter((m) => m.status === "Online").length;
  const metersOffline = meters.length - metersOnline;
  const totalPower    = meters.reduce((s, m) => s + (parseFloat(m.real_power) || 0), 0);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Top bar: nút back + tên site */}
      <Box sx={{
        display: "flex", alignItems: "center", gap: 1.5,
        px: 2, py: 1, borderBottom: `1px solid ${divClr}`,
        backgroundColor: headBg, flexShrink: 0,
      }}>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={onBack}
          sx={{ color: accent, borderColor: accent, fontSize: 11 }}
          variant="outlined">
          All Sites
        </Button>
        <Divider orientation="vertical" flexItem sx={{ borderColor: divClr }} />
        <ElectricMeterIcon sx={{ color: accent, fontSize: 18 }} />
        <Typography sx={{ color: accent, fontWeight: 700, fontSize: 15 }}>
          {siteInfo?.site_name ?? "—"}
        </Typography>
        <Typography sx={{ color: "#546e7a", fontSize: 12 }}>
          {siteInfo?.location ?? ""}
        </Typography>
      </Box>

      {/* Main content */}
      <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left panel */}
        <Box sx={{
          width: 240, minWidth: 240,
          backgroundColor: panelBg,
          borderRight: `1px solid ${divClr}`,
          display: "flex", flexDirection: "column",
          overflowY: "auto",
          "&::-webkit-scrollbar": { width: 5 },
          "&:hover::-webkit-scrollbar-thumb": { backgroundColor: headBg },
        }}>
          {/* Connect status */}
          <Box sx={{ px: 1.5, pt: 1.5, pb: 1 }}>
            <Typography sx={{ color: "#546e7a", fontSize: 9, fontWeight: 600, letterSpacing: 1, mb: 0.8 }}>
              CONNECT STATUS
            </Typography>
            <Box sx={{
              display: "flex", alignItems: "center", gap: 1,
              backgroundColor: headBg, borderRadius: 1, px: 1.2, py: 0.8,
              border: `1px solid ${metersOnline > 0 ? "#2e7d32" : "#c62828"}`,
            }}>
              <Box sx={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                backgroundColor: metersOnline > 0 ? "#4caf50" : "#f44336",
                boxShadow: metersOnline > 0 ? "0 0 6px #4caf50" : "none",
              }} />
              <Typography sx={{ color: metersOnline > 0 ? "#69f0ae" : "#ef9a9a", fontSize: 12 }}>
                {metersOnline > 0 ? "Connected" : "Disconnected"}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ borderColor: divClr, mx: 1.5 }} />

          {/* Active Power */}
          <Box sx={{ px: 1.5, py: 1 }}>
            <Typography sx={{ color: "#546e7a", fontSize: 9, fontWeight: 600, letterSpacing: 1, mb: 0.8 }}>
              ACTIVE POWER
            </Typography>
            <Box sx={{ backgroundColor: headBg, borderRadius: 1, py: 1.2, textAlign: "center",
                       border: `1px solid ${divClr}` }}>
              <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 0.4 }}>
                <BoltIcon sx={{ color: "#ffd54f", fontSize: 16 }} />
                <Typography sx={{ color: "#00e5ff", fontWeight: 700, fontSize: 24, fontFamily: "monospace" }}>
                  {totalPower.toFixed(1)}
                </Typography>
                <Typography sx={{ color: "#546e7a", fontSize: 11 }}>W</Typography>
              </Box>
            </Box>
          </Box>

          {/* Total Energy */}
          <Box sx={{ px: 1.5, pb: 1 }}>
            <Typography sx={{ color: "#546e7a", fontSize: 9, fontWeight: 600, letterSpacing: 1, mb: 0.8 }}>
              TOTAL ENERGY
            </Typography>
            <Box sx={{ backgroundColor: headBg, borderRadius: 1, py: 1.2, textAlign: "center",
                       border: `1px solid ${divClr}` }}>
              <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 0.4 }}>
                <Typography sx={{ color: "#69f0ae", fontWeight: 700, fontSize: 24, fontFamily: "monospace" }}>
                  {summary?.total_energy != null ? Number(summary.total_energy).toFixed(2) : "--"}
                </Typography>
                <Typography sx={{ color: "#546e7a", fontSize: 11 }}>kWh</Typography>
              </Box>
            </Box>
          </Box>

          <Divider sx={{ borderColor: divClr, mx: 1.5 }} />

          {/* Meter count */}
          <Box sx={{ px: 1.5, py: 1 }}>
            <Typography sx={{ color: "#546e7a", fontSize: 9, fontWeight: 600, letterSpacing: 1, mb: 0.8 }}>
              METERS
            </Typography>
            <Box sx={{ display: "flex", gap: 0.8 }}>
              <Box sx={{ flex: 1, backgroundColor: "#0a1f0a", border: "1px solid #2e7d32",
                         borderRadius: 1, py: 0.8, textAlign: "center" }}>
                <Typography sx={{ color: "#69f0ae", fontWeight: 700, fontSize: 20 }}>{metersOnline}</Typography>
                <Typography sx={{ color: "#81c784", fontSize: 9 }}>Online/{meters.length}</Typography>
              </Box>
              <Box sx={{ flex: 1, backgroundColor: "#1f0a0a", border: "1px solid #c62828",
                         borderRadius: 1, py: 0.8, textAlign: "center" }}>
                <Typography sx={{ color: "#ef9a9a", fontWeight: 700, fontSize: 20 }}>{metersOffline}</Typography>
                <Typography sx={{ color: "#ef9a9a", fontSize: 9 }}>Offline/{meters.length}</Typography>
              </Box>
            </Box>
          </Box>

          <Divider sx={{ borderColor: divClr, mx: 1.5 }} />

          {/* Mini meter list */}
          <Box sx={{ px: 1.5, py: 1 }}>
            <Typography sx={{ color: "#546e7a", fontSize: 9, fontWeight: 600, letterSpacing: 1, mb: 0.8 }}>
              METER LIST
            </Typography>
            {meters.map((m) => (
              <Box key={m.meter_id} sx={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                py: 0.5, px: 1, mb: 0.5, borderRadius: 1,
                backgroundColor: headBg, border: `1px solid ${divClr}`,
                cursor: "pointer", "&:hover": { borderColor: accent },
              }}
                onClick={() => navigate(`/devicelist?siteId=${siteId}`)}>
                <Typography sx={{ color: "#b0bec5", fontSize: 11 }}>{m.meter_name}</Typography>
                <Box sx={{
                  width: 7, height: 7, borderRadius: "50%",
                  backgroundColor: m.status === "Online" ? "#4caf50" : "#f44336",
                  boxShadow: m.status === "Online" ? "0 0 5px #4caf50" : "none",
                }} />
              </Box>
            ))}
          </Box>
        </Box>

        {/* Right panel — Meter Cards */}
        <Box sx={{
          flex: 1, height: "100%", overflowY: "auto", p: 1.5,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 1.5, alignContent: "start",
          "&::-webkit-scrollbar": { width: 5 },
          "&:hover::-webkit-scrollbar-thumb": { backgroundColor: headBg },
        }}>
          {meters.length === 0 ? (
            <Box sx={{ gridColumn: "1/-1", textAlign: "center", py: 10 }}>
              <ElectricMeterIcon sx={{ color: "#263238", fontSize: 48 }} />
              <Typography sx={{ color: "#37474f", mt: 1 }}>No meters in this site.</Typography>
            </Box>
          ) : (
            meters.map((meter) => (
              <MeterCard
                key={meter.meter_id}
                meter={meter}
                registers={meterRegs[meter.meter_id] ?? {}}
                cardParams={cardConfigs[meter.meter_id] ?? []}
                onDetail={() => setDetailMeter(meter)}
                onChart={() => navigate(`/devicelist?siteId=${siteId}`)}
                onSettings={() => setConfigMeter(meter)}
              />
            ))
          )}
        </Box>
      </Box>

      {/* ── Meter Detail Modal ── */}
      <MeterDetailModal
        open={!!detailMeter}
        onClose={() => setDetailMeter(null)}
        meter={detailMeter}
        registers={detailMeter ? (meterRegs[detailMeter.meter_id] ?? {}) : {}}
      />

      {/* ── Card Config Dialog ── */}
      <CardConfigDialog
        open={!!configMeter}
        onClose={() => setConfigMeter(null)}
        meter={configMeter}
        registers={configMeter ? (meterRegs[configMeter.meter_id] ?? {}) : {}}
        savedParams={configMeter ? (cardConfigs[configMeter.meter_id] ?? []) : []}
        onSave={handleSaveConfig}
      />
    </Box>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// ROOT — điều hướng giữa 2 màn hình bằng URL param
// ════════════════════════════════════════════════════════════════════════════
export default function SiteView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const siteId = searchParams.get("siteId");

  if (siteId) {
    return (
      <SiteDetailScreen
        siteId={siteId}
        onBack={() => setSearchParams({})}
      />
    );
  }
  return (
    <SiteListScreen
      onSelectSite={(id) => setSearchParams({ siteId: String(id) })}
    />
  );
}