import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Box, Typography, Chip, Divider, Button, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableRow, TableCell, IconButton,
  Checkbox, FormControlLabel, TextField, InputAdornment,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getData, postData, deleteData } from "../ApiComponent/api";
import BoltIcon          from "@mui/icons-material/Bolt";
import ElectricMeterIcon from "@mui/icons-material/ElectricMeter";
import ArrowBackIcon     from "@mui/icons-material/ArrowBack";
import LocationOnIcon    from "@mui/icons-material/LocationOn";
import RouterIcon        from "@mui/icons-material/Router";
import CloseIcon         from "@mui/icons-material/Close";
import ShowChartIcon     from "@mui/icons-material/ShowChart";
import SettingsIcon      from "@mui/icons-material/Settings";
import SearchIcon        from "@mui/icons-material/Search";
import DeleteIcon        from "@mui/icons-material/Delete";
import WarningAmberIcon  from "@mui/icons-material/WarningAmber";
import { WS_BASE } from "../config";

// ── Constants ────────────────────────────────────────────────────────────────
const STALE_SECONDS  = 120;
const MAX_PARAMS     = 12;

const WX_CODE = {
  0:  { label: "Clear sky",      icon: "☀️"  },
  1:  { label: "Mainly clear",   icon: "🌤️"  },
  2:  { label: "Partly cloudy",  icon: "⛅"  },
  3:  { label: "Overcast",       icon: "☁️"  },
  45: { label: "Fog",            icon: "🌫️" },
  48: { label: "Icy fog",        icon: "🌫️" },
  51: { label: "Light drizzle",  icon: "🌦️" },
  53: { label: "Drizzle",        icon: "🌦️" },
  55: { label: "Heavy drizzle",  icon: "🌦️" },
  61: { label: "Light rain",     icon: "🌧️" },
  63: { label: "Rain",           icon: "🌧️" },
  65: { label: "Heavy rain",     icon: "🌧️" },
  80: { label: "Showers",        icon: "🌦️" },
  81: { label: "Showers",        icon: "🌦️" },
  82: { label: "Heavy showers",  icon: "🌧️" },
  95: { label: "Thunderstorm",   icon: "⛈️" },
  96: { label: "Thunderstorm",   icon: "⛈️" },
  99: { label: "Thunderstorm",   icon: "⛈️" },
};
const wxInfo = (code) => WX_CODE[code] ?? { label: "—", icon: "🌡️" };

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

// X positions (center) for each meter icon in the SVG, keyed by meter count
const METER_SLOTS = {
  0: [],
  1: [160],
  2: [105, 215],
  3: [72, 160, 248],
  4: [52, 122, 198, 268],
  5: [38, 98, 160, 222, 282],
};

// gatewayOnline: gateway có gửi scan gần đây không (< 5 phút)
// scanDevices:   [{modbus_id, status}] từ lần scan mới nhất
// meterCount:    fallback nếu chưa có scan
function SiteTopologyDiagram({ gatewayOnline, scanDevices, meterCount, gatewayId }) {
  const LIVE  = "#4caf50";
  const DEAD  = "#f44336";
  const GRAY  = "#546e7a";
  const gwId  = gatewayId ? String(gatewayId).slice(0, 15) : "—";

  // Ưu tiên dùng scan devices; fallback về meter_count (hiển thị dưới dạng unknown)
  const hasScan   = scanDevices && scanDevices.length > 0;
  const rawCount  = hasScan ? scanDevices.length : (meterCount || 0);
  const showN     = Math.min(rawCount, 5);
  const mXs       = METER_SLOTS[showN] ?? [];
  const extra     = Math.max(rawCount - 5, 0);

  // Per-meter: nếu có scan → green/red theo status; nếu không có scan → gray (unknown)
  const deviceColor = (i) => {
    if (!hasScan) return GRAY;
    return scanDevices[i]?.status === "active" ? LIVE : DEAD;
  };
  const deviceActive = (i) => hasScan && scanDevices[i]?.status === "active";

  // Gateway icon màu: online=green, offline=red
  const gwColor = gatewayOnline ? LIVE : DEAD;
  const gwDim   = gatewayOnline ? "#1b5e20" : "#7f0000";

  return (
    <svg width="100%" viewBox="0 0 320 172" xmlns="http://www.w3.org/2000/svg">

      {/* ═══ INTERNET GLOBE (top center) ═══ */}
      {/* Outer circle */}
      <circle cx="160" cy="21" r="17" fill="#06060f" stroke={gwColor} strokeWidth="1.5"/>
      {/* Central longitude oval */}
      <ellipse cx="160" cy="21" rx="7.5" ry="17" fill="none" stroke={gwColor} strokeWidth="1" opacity="0.55"/>
      {/* Equator */}
      <line x1="143" y1="21" x2="177" y2="21" stroke={gwColor} strokeWidth="1" opacity="0.55"/>
      {/* Upper latitude arc */}
      <path d="M 146,13 Q 160,10 174,13" fill="none" stroke={gwColor} strokeWidth="0.9" opacity="0.45"/>
      {/* Lower latitude arc */}
      <path d="M 146,29 Q 160,32 174,29" fill="none" stroke={gwColor} strokeWidth="0.9" opacity="0.45"/>
      {/* Glow khi gateway online */}
      {gatewayOnline && (
        <circle cx="160" cy="21" r="17" fill={LIVE} opacity="0.04">
          <animate attributeName="opacity" values="0.03;0.09;0.03" dur="2.5s" repeatCount="indefinite"/>
        </circle>
      )}

      {/* ═══ GW ↔ WEB vertical line ═══ */}
      <line x1="160" y1="40" x2="160" y2="78"
            stroke={gwDim} strokeWidth="1.5" opacity="0.35"
            strokeDasharray={gatewayOnline ? undefined : "4,3"}/>
      {!gatewayOnline && (
        <>
          <line x1="153" y1="52" x2="167" y2="66" stroke={DEAD} strokeWidth="2" strokeLinecap="round"/>
          <line x1="167" y1="52" x2="153" y2="66" stroke={DEAD} strokeWidth="2" strokeLinecap="round"/>
        </>
      )}
      {gatewayOnline && [0, 0.5, 1.0].map((delay, i) => (
        <circle key={i} cx="160" r="3" fill="#69f0ae">
          <animate attributeName="cy" from="76" to="42"
                   dur="1.5s" begin={`${delay}s`} repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;1;1;0"
                   dur="1.5s" begin={`${delay}s`} repeatCount="indefinite"/>
        </circle>
      ))}

      {/* ═══ GATEWAY (middle) ═══ */}
      <line x1="150" y1="80" x2="150" y2="70" stroke={gwColor} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="160" y1="80" x2="160" y2="64" stroke={gwColor} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="170" y1="80" x2="170" y2="70" stroke={gwColor} strokeWidth="1.5" strokeLinecap="round"/>
      {gatewayOnline ? (
        <>
          <path d="M 155,67 Q 160,61 165,67" fill="none" stroke={gwColor} strokeWidth="1.3" strokeLinecap="round">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="1.8s" repeatCount="indefinite"/>
          </path>
          <path d="M 151,70 Q 160,58 169,70" fill="none" stroke={gwColor} strokeWidth="1" strokeLinecap="round">
            <animate attributeName="opacity" values="0.1;0.6;0.1" dur="1.8s" begin="0.4s" repeatCount="indefinite"/>
          </path>
        </>
      ) : (
        <path d="M 151,70 Q 160,58 169,70" fill="none" stroke={gwColor} strokeWidth="1" strokeLinecap="round" opacity="0.2"/>
      )}
      <rect x="140" y="80" width="40" height="28" rx="3"
            fill="#060808" stroke={gwColor} strokeWidth="1.5"/>
      <circle cx="172" cy="94" r="2.5" fill={gwColor}>
        {gatewayOnline && <animate attributeName="opacity" values="1;0.2;1" dur="1.8s" repeatCount="indefinite"/>}
      </circle>
      <text x="160" y="120" textAnchor="middle" fill={gwColor}
            fontSize="8" fontFamily="monospace" fontWeight="bold">GATEWAY</text>
      <text x="160" y="129" textAnchor="middle" fill={GRAY}
            fontSize="6.5" fontFamily="monospace">{gwId}</text>

      {/* ═══ METER lines + icons ═══ */}
      {mXs.map((mx, i) => {
        const active  = deviceActive(i);
        const mColor  = deviceColor(i);
        const lineClr = active ? gwDim : (hasScan ? "#7f0000" : "#37474f");
        return (
          <g key={i}>
            {/* Diagonal line: animated if active, dashed-red if inactive, gray if unknown */}
            <line x1={mx} y1="140" x2="160" y2="108"
                  stroke={lineClr} strokeWidth="1.2"
                  strokeDasharray={active ? undefined : "3,3"}/>
            {/* Animated dots chỉ khi meter active VÀ gateway online */}
            {active && gatewayOnline && [0, 0.65].map((delay, di) => (
              <circle key={di} r="2.5" fill="#a5d6a7">
                <animate attributeName="cx" from={String(mx)} to="160"
                         dur="1.5s" begin={`${delay + i * 0.18}s`} repeatCount="indefinite"/>
                <animate attributeName="cy" from="140" to="108"
                         dur="1.5s" begin={`${delay + i * 0.18}s`} repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;1;1;0"
                         dur="1.5s" begin={`${delay + i * 0.18}s`} repeatCount="indefinite"/>
              </circle>
            ))}
            {/* Meter box */}
            <rect x={mx - 15} y="140" width="30" height="20" rx="2"
                  fill="#060808" stroke={mColor} strokeWidth="1.2"/>
            <text x={mx} y="154" textAnchor="middle" fill={mColor}
                  fontSize="7.5" fontFamily="monospace" fontWeight="bold">
              {hasScan ? `#${scanDevices[i].modbus_id}` : `M${i + 1}`}
            </text>
          </g>
        );
      })}

      {extra > 0 && (
        <text x="306" y="154" textAnchor="middle" fill={GRAY}
              fontSize="8.5" fontFamily="monospace">+{extra}</text>
      )}
      {showN === 0 && (
        <text x="160" y="152" textAnchor="middle" fill="#37474f"
              fontSize="8.5" fontFamily="monospace">No devices registered</text>
      )}

      {/* ═══ Status label ═══ */}
      <text x="160" y="168" textAnchor="middle"
            fill={gatewayOnline ? "#69f0ae" : "#ef9a9a"}
            fontSize="8" fontFamily="monospace" fontWeight="600">
        {gatewayOnline ? "● GATEWAY CONNECTED" : "● GATEWAY OFFLINE"}
      </text>
    </svg>
  );
}


function SiteCard({ site, summary, loading, onSelect }) {
  const theme        = useTheme();
  const accent       = theme.palette.text.header_option  || "#08ffff";
  const cardBg       = theme.palette.background.box      || "#0d1b2a";
  const headBg       = theme.palette.background.head_box || "#0a1628";
  const divClr       = theme.palette.divider             || "#1f2d3a";

  const meterCount    = summary?.meter_count    ?? 0;
  const gatewayOnline = summary?.gateway_online ?? false;
  const scanDevices   = summary?.scan_devices   ?? [];
  const scanActive    = summary?.scan_active    ?? 0;
  const scanTotal     = summary?.scan_total     ?? 0;
  // Hiển thị N/Total dùng scan nếu có, fallback về meter DB
  const displayOnline = scanTotal > 0 ? scanActive  : (summary?.meters_online ?? 0);
  const displayTotal  = scanTotal > 0 ? scanTotal   : meterCount;
  const power         = summary?.total_power  != null ? Number(summary.total_power).toFixed(1)  : "--";
  const energy        = summary?.total_energy != null ? Number(summary.total_energy).toFixed(2) : "--";

  return (
    <Box onClick={onSelect} sx={{
      backgroundColor: cardBg,
      border: `1px solid ${divClr}`,
      borderRadius: 2,
      overflow: "hidden",
      cursor: "pointer",
      transition: "border-color 0.2s, transform 0.15s",
      "&:hover": {
        borderColor: accent,
        transform: "translateY(-2px)",
        boxShadow: `0 6px 24px rgba(0,0,0,0.5)`,
      },
    }}>

      {/* ── Header ── */}
      <Box sx={{
        backgroundColor: headBg,
        px: 2, py: 1.2,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: `1px solid ${divClr}`,
      }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <ElectricMeterIcon sx={{ color: accent, fontSize: 17 }} />
          <Typography sx={{ color: accent, fontWeight: 700, fontSize: 14, letterSpacing: 0.5 }}>
            {site.site_name}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {!loading && summary && (
            <Typography sx={{ color: "#546e7a", fontSize: 10 }}>
              {displayOnline}/{displayTotal} active
            </Typography>
          )}
          <Box sx={{
            width: 8, height: 8, borderRadius: "50%",
            backgroundColor: gatewayOnline ? "#4caf50" : (summary ? "#f44336" : "#546e7a"),
            boxShadow: gatewayOnline ? "0 0 6px #4caf50" : "none",
          }} />
        </Box>
      </Box>

      {/* ── Topology diagram ── */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
          <CircularProgress size={22} sx={{ color: accent }} />
        </Box>
      ) : (
        <Box sx={{ px: 1, pt: 1, pb: 0.5 }}>
          <SiteTopologyDiagram
            gatewayOnline={gatewayOnline}
            scanDevices={scanDevices}
            meterCount={meterCount}
            gatewayId={site.gateway_id}
          />
        </Box>
      )}

      {/* ── Metrics row ── */}
      {!loading && (
        <Box sx={{ display: "flex", gap: 1, px: 1.5, pb: 1.2 }}>
          <Box sx={{
            flex: 1, backgroundColor: headBg, borderRadius: 1, py: 0.7, px: 1,
            textAlign: "center", border: `1px solid ${divClr}`,
          }}>
            <Typography sx={{ color: "#546e7a", fontSize: 9, letterSpacing: 0.5 }}>ACTIVE POWER</Typography>
            <Typography sx={{ color: "#00e5ff", fontWeight: 700, fontSize: 16, fontFamily: "monospace", mt: 0.2 }}>
              {power}
            </Typography>
            <Typography sx={{ color: "#546e7a", fontSize: 9 }}>W</Typography>
          </Box>
          <Box sx={{
            flex: 1, backgroundColor: headBg, borderRadius: 1, py: 0.7, px: 1,
            textAlign: "center", border: `1px solid ${divClr}`,
          }}>
            <Typography sx={{ color: "#546e7a", fontSize: 9, letterSpacing: 0.5 }}>TOTAL ENERGY</Typography>
            <Typography sx={{ color: "#69f0ae", fontWeight: 700, fontSize: 16, fontFamily: "monospace", mt: 0.2 }}>
              {energy}
            </Typography>
            <Typography sx={{ color: "#546e7a", fontSize: 9 }}>kWh</Typography>
          </Box>
        </Box>
      )}

      {/* ── Footer ── */}
      <Box sx={{
        px: 2, py: 1, borderTop: `1px solid ${divClr}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <LocationOnIcon sx={{ color: "#546e7a", fontSize: 13 }} />
          <Typography sx={{ color: "#546e7a", fontSize: 10 }}>
            {site.location || "—"}
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
          gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
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


function MeterCard({ meter, registers, cardParams, onDetail, onChart, onSettings, onDelete }) {
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
          <IconButton size="small" onClick={onDelete}
            sx={{ color: "#546e7a", p: 0.3, "&:hover": { color: "#f44336" } }}>
            <DeleteIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Rows — giãn đều theo chiều cao card */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {rows.map((row, i) => (
          <Box key={row.label} sx={{
            flex: 1,
            display: "flex", alignItems: "center", px: 1.5,
            backgroundColor: i % 2 === 0 ? rowOdd : rowEven,
            borderBottom: `1px solid ${divClr}`,
          }}>
            <Typography sx={{
              color: textClr, fontSize: 11, flex: 1, minWidth: 0,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {row.label}
            </Typography>
            <Typography sx={{
              color: row.value === "--" ? "#37474f" : GREEN,
              fontWeight: 700, fontSize: 12,
              minWidth: 60, textAlign: "right", fontFamily: "monospace",
            }}>
              {row.value}
            </Typography>
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


// ════════════════════════════════════════════════════════════════════════════
// GATEWAY ↔ WEB STATUS WIDGET — SVG animated
// ════════════════════════════════════════════════════════════════════════════
function GatewayStatusWidget({ online, gatewayId }) {
  const accent   = online ? "#4caf50" : "#f44336";
  const dimLine  = online ? "#2e7d32" : "#7f0000";
  const bgColor  = online ? "rgba(8,22,8,0.85)" : "rgba(22,8,8,0.85)";
  const gwLabel  = gatewayId ? String(gatewayId).slice(0, 11) : "—";

  return (
    <Box sx={{
      mx: 1.5, my: 0.5,
      backgroundColor: bgColor,
      border: `1px solid ${dimLine}`,
      borderRadius: 1.5,
      overflow: "hidden",
    }}>
      <svg width="100%" viewBox="0 0 200 82" xmlns="http://www.w3.org/2000/svg">

        {/* ── GATEWAY (left) ── */}
        <rect x="10" y="28" width="36" height="24" rx="3"
              fill="#060f06" stroke={accent} strokeWidth="1.5"/>
        {/* LED dot */}
        <circle cx="40" cy="40" r="2.5" fill={accent}>
          {online && (
            <animate attributeName="opacity" values="1;0.2;1" dur="1.8s" repeatCount="indefinite"/>
          )}
        </circle>
        {/* Antennas */}
        <line x1="20" y1="28" x2="20" y2="19" stroke={accent} strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="28" y1="28" x2="28" y2="13" stroke={accent} strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="36" y1="28" x2="36" y2="19" stroke={accent} strokeWidth="1.5" strokeLinecap="round"/>
        {/* Signal arcs */}
        {online ? (
          <>
            <path d="M 23,16 Q 28,10 33,16" fill="none" stroke={accent} strokeWidth="1.3" strokeLinecap="round">
              <animate attributeName="opacity" values="0.4;1;0.4" dur="1.8s" repeatCount="indefinite"/>
            </path>
            <path d="M 19,19 Q 28,6 37,19" fill="none" stroke={accent} strokeWidth="1" strokeLinecap="round">
              <animate attributeName="opacity" values="0.1;0.55;0.1" dur="1.8s" begin="0.4s" repeatCount="indefinite"/>
            </path>
          </>
        ) : (
          <path d="M 19,19 Q 28,6 37,19" fill="none" stroke={accent} strokeWidth="1" strokeLinecap="round" opacity="0.25"/>
        )}
        <text x="28" y="64" textAnchor="middle" fill={accent}
              fontSize="8" fontFamily="monospace" fontWeight="bold">GW</text>
        <text x="28" y="73" textAnchor="middle" fill="#546e7a"
              fontSize="6.2" fontFamily="monospace">{gwLabel}</text>

        {/* ── CONNECTION (center) ── */}
        {online ? (
          <>
            <line x1="48" y1="40" x2="152" y2="40"
                  stroke={dimLine} strokeWidth="1.5" opacity="0.35"/>
            {[0, 0.6, 1.2].map((delay, i) => (
              <circle key={i} cy="40" r="3.5" fill="#69f0ae">
                <animate attributeName="cx" from="48" to="152"
                         dur="1.8s" begin={`${delay}s`} repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;1;1;0"
                         dur="1.8s" begin={`${delay}s`} repeatCount="indefinite"/>
              </circle>
            ))}
          </>
        ) : (
          <>
            <line x1="48" y1="40" x2="152" y2="40"
                  stroke={dimLine} strokeWidth="1.5" strokeDasharray="5,4"/>
            <line x1="96" y1="35" x2="104" y2="45"
                  stroke="#f44336" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="104" y1="35" x2="96" y2="45"
                  stroke="#f44336" strokeWidth="2.5" strokeLinecap="round"/>
          </>
        )}

        {/* ── INTERNET GLOBE (right) ── */}
        <circle cx="173" cy="38" r="17" fill="#06060f" stroke={accent} strokeWidth="1.5"/>
        <ellipse cx="173" cy="38" rx="7.5" ry="17" fill="none" stroke={accent} strokeWidth="1" opacity="0.55"/>
        <line x1="156" y1="38" x2="190" y2="38" stroke={accent} strokeWidth="1" opacity="0.55"/>
        <path d="M 159,30 Q 173,27 187,30" fill="none" stroke={accent} strokeWidth="0.9" opacity="0.45"/>
        <path d="M 159,46 Q 173,49 187,46" fill="none" stroke={accent} strokeWidth="0.9" opacity="0.45"/>
        {online && (
          <circle cx="173" cy="38" r="17" fill={accent} opacity="0.04">
            <animate attributeName="opacity" values="0.03;0.09;0.03" dur="2.5s" repeatCount="indefinite"/>
          </circle>
        )}

        {/* ── Status label ── */}
        <text x="100" y="80" textAnchor="middle"
              fill={online ? "#69f0ae" : "#ef9a9a"}
              fontSize="8.5" fontFamily="monospace" fontWeight="600">
          {online ? "● DATA FLOWING" : "● NO SIGNAL"}
        </text>
      </svg>
    </Box>
  );
}


// ── WeatherWidget ─────────────────────────────────────────────────────────────
function WeatherWidget({ weather, loading, error, headBg, divClr }) {
  const theme = useTheme();
  const labelColor = "#546e7a";

  if (loading) return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 1.5 }}>
      <CircularProgress size={16} sx={{ color: labelColor }} />
    </Box>
  );
  if (error || !weather) return (
    <Box sx={{ px: 1.5, py: 1, textAlign: "center" }}>
      <Typography sx={{ color: labelColor, fontSize: 10 }}>Weather unavailable</Typography>
    </Box>
  );

  const { label, icon } = wxInfo(weather.weather_code);

  return (
    <Box sx={{ px: 1.5, py: 1 }}>
      <Box sx={{ backgroundColor: headBg, borderRadius: 1, p: 1.2, border: `1px solid ${divClr}` }}>
        {/* Top row: icon + temperature */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.8 }}>
          <Typography sx={{ fontSize: 32, lineHeight: 1 }}>{icon}</Typography>
          <Box sx={{ textAlign: "right" }}>
            <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: 24, fontFamily: "monospace", lineHeight: 1 }}>
              {weather.temperature_2m?.toFixed(1)}°C
            </Typography>
            <Typography sx={{ color: labelColor, fontSize: 9 }}>
              Feels like {weather.apparent_temperature?.toFixed(1)}°C
            </Typography>
          </Box>
        </Box>
        {/* Condition label */}
        <Typography sx={{ color: "#90a4ae", fontSize: 10, mb: 1 }}>{label}</Typography>
        {/* Stats row */}
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <Box sx={{ flex: 1, textAlign: "center", backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 1, py: 0.6 }}>
            <Typography sx={{ color: "#4fc3f7", fontSize: 12, fontWeight: 700 }}>
              {weather.relative_humidity_2m}%
            </Typography>
            <Typography sx={{ color: labelColor, fontSize: 8 }}>Humidity</Typography>
          </Box>
          <Box sx={{ flex: 1, textAlign: "center", backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 1, py: 0.6 }}>
            <Typography sx={{ color: "#80cbc4", fontSize: 12, fontWeight: 700 }}>
              {weather.wind_speed_10m?.toFixed(1)} m/s
            </Typography>
            <Typography sx={{ color: labelColor, fontSize: 8 }}>Wind</Typography>
          </Box>
          <Box sx={{ flex: 1, textAlign: "center", backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 1, py: 0.6 }}>
            <Typography sx={{ color: "#b39ddb", fontSize: 12, fontWeight: 700 }}>
              {weather.precipitation?.toFixed(1)} mm
            </Typography>
            <Typography sx={{ color: labelColor, fontSize: 8 }}>Rain</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
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
  const [deletingMeter, setDeletingMeter] = useState(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [weather,       setWeather]       = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError,  setWeatherError]  = useState(false);
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

  // Weather từ Open-Meteo — refresh mỗi 5 phút
  useEffect(() => {
    if (!siteInfo?.latitude || !siteInfo?.longitude) return;
    const lat = siteInfo.latitude;
    const lng = siteInfo.longitude;
    const fetchWeather = async () => {
      setWeatherLoading(true);
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
          `&current=temperature_2m,apparent_temperature,relative_humidity_2m,` +
          `wind_speed_10m,weather_code,precipitation&wind_speed_unit=ms&timezone=Asia%2FHo_Chi_Minh`
        );
        const json = await res.json();
        setWeather(json.current ?? null);
        setWeatherError(false);
      } catch {
        setWeatherError(true);
      } finally {
        setWeatherLoading(false);
      }
    };
    fetchWeather();
    const t = setInterval(fetchWeather, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [siteInfo?.latitude, siteInfo?.longitude]);

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

  // Xác nhận xóa meter
  const handleConfirmDelete = useCallback(async () => {
    if (!deletingMeter) return;
    setDeleteInProgress(true);
    const res = await deleteData(`/solardb/delete-meter/${deletingMeter.meter_id}/`);
    setDeleteInProgress(false);
    if (res && res.success) {
      const id = deletingMeter.meter_id;
      setMeterList((prev) => prev.filter((m) => m.meter_id !== id));
      setMeterRegs((prev)  => { const n = { ...prev };  delete n[id]; return n; });
      setMeterOverview((prev) => { const n = { ...prev }; delete n[id]; return n; });
      setCardConfigs((prev) => { const n = { ...prev };  delete n[id]; return n; });
    }
    setDeletingMeter(null);
  }, [deletingMeter]);

  // WS overview (status + real_power)
  useEffect(() => {
    if (wsOverRef.current) wsOverRef.current.close();
    const token = sessionStorage.getItem("token");
    const ws = new WebSocket(`${WS_BASE}/ws/meter/${siteId}/?token=${token}`);
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
      const ws = new WebSocket(`${WS_BASE}/ws/meter_register/${meter.meter_id}/?token=${token}`);
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
          {/* Gateway ↔ Web status widget */}
          <Box sx={{ pt: 1.5, pb: 0.5 }}>
            <Typography sx={{ color: "#546e7a", fontSize: 9, fontWeight: 600, letterSpacing: 1, mb: 0.5, px: 1.5 }}>
              CONNECTION STATUS
            </Typography>
            <GatewayStatusWidget online={metersOnline > 0} gatewayId={siteInfo?.gateway_id} />
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

          <Divider sx={{ borderColor: divClr, mx: 1.5 }} />

          {/* Weather */}
          <Box sx={{ px: 0, pb: 1.5 }}>
            <Typography sx={{ color: "#546e7a", fontSize: 9, fontWeight: 600, letterSpacing: 1, mb: 0.5, px: 1.5, pt: 1 }}>
              WEATHER
            </Typography>
            <WeatherWidget
              weather={weather}
              loading={weatherLoading}
              error={weatherError}
              headBg={headBg}
              divClr={divClr}
            />
            {weather && (
              <Typography sx={{ color: "#37474f", fontSize: 8, textAlign: "right", px: 1.5, mt: 0.3 }}>
                via Open-Meteo · updates every 5 min
              </Typography>
            )}
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
                onDelete={() => setDeletingMeter(meter)}
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

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog
        open={!!deletingMeter}
        onClose={() => !deleteInProgress && setDeletingMeter(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.box || "#0d1b2a",
            border: `1px solid #c62828`,
            borderRadius: 2,
            backgroundImage: "none",
          },
        }}
      >
        <DialogTitle sx={{ p: 0 }}>
          <Box sx={{
            backgroundColor: "#1a0a0a",
            px: 2.5, py: 1.5,
            display: "flex", alignItems: "center", gap: 1.2,
            borderBottom: "1px solid #c62828",
          }}>
            <WarningAmberIcon sx={{ color: "#f44336", fontSize: 22 }} />
            <Typography sx={{ color: "#f44336", fontWeight: 700, fontSize: 15 }}>
              Confirm Delete Meter
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ px: 2.5, pt: 2.5, pb: 1 }}>
          <Typography sx={{ color: "#cfd8dc", fontSize: 14, lineHeight: 1.7 }}>
            Are you sure you want to delete{" "}
            <Typography component="span" sx={{ color: "#f44336", fontWeight: 700 }}>
              {deletingMeter?.meter_name ?? `Meter ${deletingMeter?.meter_id}`}
            </Typography>
            ?
          </Typography>
          <Typography sx={{ color: "#78909c", fontSize: 12, mt: 1.2, lineHeight: 1.6 }}>
            All measurement data (register history) for this meter will be permanently deleted.
            If the gateway continues to send data for this meter, new data will still be received and displayed normally.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: "1px solid #37474f", gap: 1 }}>
          <Button
            size="small" variant="outlined"
            onClick={() => setDeletingMeter(null)}
            disabled={deleteInProgress}
            sx={{ color: "#78909c", borderColor: "#546e7a", minWidth: 80 }}
          >
            Cancel
          </Button>
          <Button
            size="small" variant="contained"
            onClick={handleConfirmDelete}
            disabled={deleteInProgress}
            startIcon={deleteInProgress ? <CircularProgress size={14} color="inherit" /> : <DeleteIcon />}
            sx={{
              backgroundColor: "#c62828", color: "#fff", fontWeight: 700, minWidth: 100,
              "&:hover": { backgroundColor: "#b71c1c" },
              "&.Mui-disabled": { backgroundColor: "#7f0000", color: "#ef9a9a" },
            }}
          >
            {deleteInProgress ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
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