import { Box, Chip, Typography, Divider, IconButton } from "@mui/material";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import { getData } from "../ApiComponent/api";
import { WS_BASE } from "../config";
import ArrowBackIcon       from "@mui/icons-material/ArrowBack";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import RouterIcon          from "@mui/icons-material/Router";
import LocationOnIcon      from "@mui/icons-material/LocationOn";

// ── Color palette ─────────────────────────────────────────────────────────────
// Static base (dark-mode defaults) — used by module-level utility functions
const C = {
  ok:    "#3dd68c",
  err:   "#ff5c5c",
  warn:  "#f5c542",
  port:  "#4f9eff",
  muted: "#7a849a",
  bg:    "#0d0f14",
  gw:    "#4f9eff",
};

// Hook — overrides theme-sensitive values for components
function useColors() {
  const theme  = useTheme();
  const isDark = theme.palette.mode === "dark";
  if (isDark) return { ...C, panelBg: theme.palette.background.box };
  return {
    ...C,
    warn:    "#b45309",
    muted:   "#64748b",
    bg:      theme.palette.background.option,
    panelBg: theme.palette.background.option,
  };
}

// ── analyzeWire — same logic as ScanDetailModal ───────────────────────────────
function analyzeWire(raw, devices) {
  if (!raw || !devices?.length) return null;

  const originalId = [...devices]
    .sort((a, b) => a.modbus_id - b.modbus_id)
    .map(d => d.modbus_id);
  const count = originalId.length;
  if (count === 0) return null;

  const { wire_p1_ok, wire_p2_ok, final_id_p1: fp1, final_id_p2: fp2 } = raw;
  const hasOffline = devices.some(d => d.status === "inactive");

  if ((wire_p1_ok || wire_p2_ok) && !hasOffline)
    return { type: "normal", breaks: [], gapSet: new Set(), originalId, fp1, fp2, count };

  if (wire_p1_ok || wire_p2_ok)
    return { type: "device_offline", breaks: [], gapSet: new Set(), originalId, fp1, fp2, count };

  const leftSeg  = fp1 === -1    ? 0     : fp1 + 1;
  const rightSeg = fp2 === count ? count : fp2;

  const segDesc = (seg) => {
    if (seg === 0)     return `P1 ✂ ID${originalId[0]}`;
    if (seg === count) return `ID${originalId[count - 1]} ✂ P2`;
    return `ID${originalId[seg - 1]} ✂ ID${originalId[seg]}`;
  };

  const breaks = [];
  if (leftSeg === rightSeg) {
    breaks.push({ segIndex: leftSeg, desc: segDesc(leftSeg) });
  } else {
    breaks.push({ segIndex: leftSeg,  desc: segDesc(leftSeg)  });
    breaks.push({ segIndex: rightSeg, desc: segDesc(rightSeg) });
  }

  const gapSet = new Set();
  for (let d = leftSeg; d < rightSeg; d++) {
    if (d >= 0 && d < count) gapSet.add(originalId[d]);
  }

  return { type: breaks.length === 1 ? "single" : "double", breaks, gapSet, originalId, fp1, fp2, count };
}

function getDescription(analysis) {
  if (!analysis) return { text: "No scan data available.", color: C.muted };
  const { type, breaks } = analysis;
  if (type === "normal")
    return { text: "✅ Line is normal. All devices are responding.", color: C.ok };
  if (type === "device_offline")
    return { text: "⚠️ Cable is intact but some devices are not responding. Check power or Modbus config.", color: C.warn };
  if (type === "single")
    return { text: `⚠️ Single cable break at: ${breaks[0].desc}. Fallback port is active.`, color: C.warn };
  if (type === "double")
    return { text: `🔴 Two cable breaks — ${breaks[0].desc} | ${breaks[1].desc}. Devices between break points are isolated.`, color: C.err };
  return { text: "Unknown state.", color: C.muted };
}

// ── Large Wire Diagram with Gateway ──────────────────────────────────────────
function LargeWireDiagram({ raw, devices, gatewayId, gatewayLive }) {
  const navigate = useNavigate();
  const C        = useColors();
  const analysis = analyzeWire(raw, devices);

  if (!analysis) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center",
                 height: 280, color: C.muted, fontSize: 14 }}>
        No line data available
      </Box>
    );
  }

  const { originalId, breaks, count, gapSet } = analysis;
  const brokenSet = new Set(breaks.map(b => b.segIndex));
  const statusMap = {};
  devices.forEach(d => { statusMap[d.modbus_id] = d.status; });

  // ── Dimensions ──────────────────────────────────────────────────────────────
  const GW = 150, GH = 48;   // Gateway box
  const PW = 42,  PH = 42;   // P1/P2 bus-endpoint boxes
  const NW = 64,  NH = 48;   // Device boxes (below the bus)
  const PAD      = 20;        // Outer horizontal padding
  const HALF_SEG = 50;        // Gap: P1 box-right → first tap  &  last tap → P2 box-left
  const SEG      = 78;        // Gap between consecutive taps
  const DROP_H   = 34;        // Drop-wire length (bus → device box top)

  // Internet globe (above gateway)
  const INET_R   = 16;        // globe radius
  const INET_CY  = 18;        // globe center Y from SVG top
  const INET_BOT = INET_CY + INET_R + 11;   // bottom of globe area (incl. label)

  const GW_TOP   = INET_BOT + 22;            // gateway box top Y
  const GW_BOT   = GW_TOP + GH;
  const VERT_GAP = 36;
  const Y_BUS    = GW_BOT + VERT_GAP + PH / 2;  // Center Y of main bus

  // Horizontal positions
  const p1x        = PAD;
  const p1BusRight = p1x + PW;
  const tapXs      = Array.from({ length: count }, (_, i) => p1BusRight + HALF_SEG + i * SEG);
  const p2x        = tapXs[count - 1] + HALF_SEG;   // P2 box left edge
  const SVG_W      = p2x + PW + PAD;
  const SVG_H      = Y_BUS + PH / 2 + DROP_H + NH + 26 + 20;  // bottom padding

  // Gateway centered
  const gwX   = SVG_W / 2 - GW / 2;
  const gwY   = GW_TOP;
  const gwP1x = gwX + GW * 0.27;
  const gwP2x = gwX + GW * 0.73;

  // Port box top-center (where gateway bezier arrives)
  const p1cx    = p1x + PW / 2;
  const p2cx    = p2x + PW / 2;
  const portTopY = Y_BUS - PH / 2;
  const MID_Y   = GW_BOT + (portTopY - GW_BOT) * 0.55;

  // Bezier wires — gateway internal, always green
  const p1Path = `M ${gwP1x} ${GW_BOT} C ${gwP1x} ${MID_Y} ${p1cx} ${portTopY - 8} ${p1cx} ${portTopY}`;
  const p2Path = `M ${gwP2x} ${GW_BOT} C ${gwP2x} ${MID_Y} ${p2cx} ${portTopY - 8} ${p2cx} ${portTopY}`;

  // Internet globe
  const inetCX    = SVG_W / 2;
  const inetColor = gatewayLive ? C.ok : C.err;
  const gwTopCX   = gwX + GW / 2;   // gateway top-center X (= SVG_W/2 since gateway is centered)

  const Port = ({ x, label }) => (
    <g>
      <rect x={x} y={Y_BUS - PH / 2} width={PW} height={PH} rx={5}
            fill="rgba(79,158,255,0.1)" stroke={C.port} strokeWidth={1.5} />
      <text x={x + PW / 2} y={Y_BUS - 3}  textAnchor="middle" fontSize="7"  fill={C.muted}>PORT</text>
      <text x={x + PW / 2} y={Y_BUS + 10} textAnchor="middle" fontSize="12" fontWeight="bold" fill={C.port}>{label}</text>
    </g>
  );

  return (
    <Box sx={{ overflowX: "auto", overflowY: "hidden", width: "100%", height: "100%",
               display: "flex", justifyContent: "center", alignItems: "center" }}>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ display: "block", height: "100%", width: "auto", minWidth: `${SVG_W}px` }}
      >

        {/* ── Internet / Globe ── */}
        {/* Globe outline */}
        <circle cx={inetCX} cy={INET_CY} r={INET_R} fill={`${inetColor}12`}
                stroke={inetColor} strokeWidth={1.8} />
        {/* Equator ellipse */}
        <ellipse cx={inetCX} cy={INET_CY} rx={INET_R} ry={INET_R * 0.32}
                 fill="none" stroke={inetColor} strokeWidth={1.2} opacity={0.7} />
        {/* Upper latitude arc (clipped to circle boundary) */}
        <ellipse cx={inetCX} cy={INET_CY - INET_R * 0.45} rx={INET_R * 0.88} ry={INET_R * 0.22}
                 fill="none" stroke={inetColor} strokeWidth={1} opacity={0.45} />
        {/* Center vertical meridian */}
        <line x1={inetCX} y1={INET_CY - INET_R} x2={inetCX} y2={INET_CY + INET_R}
              stroke={inetColor} strokeWidth={1.2} opacity={0.7} />
        {/* (no label below globe) */}

        {/* Vertical wire: globe bottom → gateway top */}
        <line x1={gwTopCX} y1={INET_CY + INET_R}
              x2={gwTopCX} y2={GW_TOP}
              stroke={inetColor} strokeWidth={2}
              strokeDasharray={gatewayLive ? "none" : "7 4"} opacity={0.85} />

        {/* ── Gateway box ── */}
        <rect x={gwX} y={gwY} width={GW} height={GH} rx={8}
              fill="rgba(79,158,255,0.08)" stroke={C.gw} strokeWidth={1.5} />
        <text x={gwX + GW / 2} y={gwY + GH / 2 + 4} textAnchor="middle"
              fontSize="10" fontWeight="bold" fill={C.gw}>GATEWAY</text>

        {/* ── Bezier wires: gateway board → P1/P2 bus endpoints (always green) ── */}
        <path d={p1Path} fill="none" stroke={C.ok} strokeWidth={1.8} />
        <path d={p2Path} fill="none" stroke={C.ok} strokeWidth={1.8} />

        {/* ── P1 / P2 endpoint boxes ── */}
        <Port x={p1x}  label="P1" />
        <Port x={p2x}  label="P2" />

        {/* ── Horizontal bus segments ── */}
        {Array.from({ length: count + 1 }, (_, seg) => {
          const broken = brokenSet.has(seg);
          const x1 = seg === 0     ? p1BusRight   : tapXs[seg - 1];
          const x2 = seg === count ? p2x           : tapXs[seg];
          const mx = (x1 + x2) / 2;
          return (
            <g key={seg}>
              <line x1={x1} y1={Y_BUS} x2={x2} y2={Y_BUS}
                    stroke={broken ? C.err : C.ok}
                    strokeWidth={broken ? 2 : 2.5}
                    strokeDasharray={broken ? "7 5" : "none"}
                    opacity={broken ? 0.75 : 1} />
              {broken && (
                <g>
                  <circle cx={mx} cy={Y_BUS} r={8} fill={C.bg} stroke={C.err} strokeWidth={1.5} />
                  <text x={mx} y={Y_BUS + 4}  textAnchor="middle" fontSize="9" fontWeight="bold" fill={C.err}>✕</text>
                  <text x={mx} y={Y_BUS - 13} textAnchor="middle" fontSize="7.5" fill={C.err} letterSpacing="1">BREAK</text>
                </g>
              )}
            </g>
          );
        })}

        {/* ── Devices: tap point on bus → drop wire → device box below ── */}
        {originalId.map((id, i) => {
          const isGap   = gapSet.has(id);
          const active  = statusMap[id] === "active" && !isGap;
          const tapX    = tapXs[i];
          const devTop  = Y_BUS + PH / 2 + DROP_H;
          const devLeft = tapX - NW / 2;
          const c   = active ? C.ok : C.err;
          const lbl = active ? "online" : (isGap ? "no link" : "offline");

          return (
            <g key={id}
               onClick={() => navigate(`/devicelist/?meterId=${id}&tab=METER`)}
               style={{ cursor: "pointer" }}>
              {/* Tap dot on bus */}
              <circle cx={tapX} cy={Y_BUS} r={3.5} fill={C.ok} />

              {/* Drop wire — red if device not responding */}
              <line x1={tapX} y1={Y_BUS} x2={tapX} y2={devTop}
                    stroke={active ? C.muted : C.err} strokeWidth={1.5}
                    strokeDasharray={isGap ? "4 3" : "none"}
                    opacity={active ? 0.55 : 0.8} />

              {/* Device box — brightens on hover via CSS filter */}
              <rect x={devLeft} y={devTop} width={NW} height={NH} rx={6}
                    fill={active ? "rgba(61,214,140,0.1)" : "rgba(255,92,92,0.1)"}
                    stroke={c} strokeWidth={1.8}
                    strokeDasharray={isGap ? "5 3" : "none"} />
              <text x={tapX} y={devTop + NH / 2 + 6} textAnchor="middle"
                    fontSize="16" fontWeight="bold" fill={c}>{id}</text>

              {/* Status label below box */}
              <text x={tapX} y={devTop + NH + 13} textAnchor="middle" fontSize="8.5" fill={c}>{lbl}</text>
            </g>
          );
        })}
      </svg>
    </Box>
  );
}

// ── Legend helpers ────────────────────────────────────────────────────────────
function LegendSep() {
  const theme = useTheme();
  const sep   = theme.palette.mode === "dark" ? "#ffffff18" : "rgba(13,148,136,0.18)";
  return <Box sx={{ width: 1, height: 14, bgcolor: sep, mx: 0.5 }} />;
}

function LegendItem({ color, icon, label }) {
  const C      = useColors();
  const iconEl = (() => {
    if (icon === "line-solid")
      return <Box sx={{ width: 22, height: 2.5, bgcolor: color, borderRadius: 1 }} />;
    if (icon === "line-dashed")
      return (
        <Box sx={{ width: 22, height: 2.5, borderRadius: 1,
                   background: `repeating-linear-gradient(90deg,${color} 0,${color} 5px,transparent 5px,transparent 9px)` }} />
      );
    if (icon === "line-vert")
      return (
        <Box sx={{ width: 2.5, height: 14, borderRadius: 1,
                   background: `repeating-linear-gradient(180deg,${color} 0,${color} 4px,transparent 4px,transparent 7px)` }} />
      );
    if (icon === "box-solid")
      return <Box sx={{ width: 13, height: 13, border: `2px solid ${color}`,
                        borderRadius: "3px", bgcolor: `${color}18` }} />;
    if (icon === "box-dashed")
      return <Box sx={{ width: 13, height: 13,
                        border: `2px dashed ${color}`,
                        borderRadius: "3px", bgcolor: `${color}18` }} />;
    if (icon === "circle-x")
      return (
        <Box sx={{ width: 14, height: 14, borderRadius: "50%",
                   border: `2px solid ${color}`, bgcolor: C.bg,
                   display: "flex", alignItems: "center", justifyContent: "center",
                   fontSize: 9, color, fontWeight: "bold" }}>✕</Box>
      );
    return null;
  })();

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
      {iconEl}
      <Typography fontSize={13} color={color}>{label}</Typography>
    </Box>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SCREEN 1 — Site selection
// ══════════════════════════════════════════════════════════════════════════════
function SiteListScreen({ onSelect }) {
  const theme = useTheme();
  const C     = useColors();
  const [sites, setSites] = useState([]);

  useEffect(() => {
    getData("/solardb/get-my-sites/").then(data => {
      if (data) setSites(data);
    });
  }, []);

  return (
    <Box sx={{ padding: "24px" }}>
      <Typography fontSize={14} color={C.muted} sx={{ mb: 3 }}>
        Select a site to view site status:
      </Typography>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
        {sites.map(site => (
          <Box
            key={site.site_id}
            onClick={() => onSelect(site)}
            sx={{
              cursor: "pointer",
              padding: "20px 24px",
              borderRadius: 2,
              border: `1px solid ${theme.palette.background.head_box}`,
              backgroundColor: C.panelBg,
              minWidth: 220,
              transition: "border-color 0.2s",
              "&:hover": {
                borderColor: C.port,
              },
            }}
          >
            <Typography fontWeight="bold" fontSize={15}
                        color={theme.palette.text.header_option} sx={{ mb: 1 }}>
              {site.site_name}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
              <LocationOnIcon sx={{ fontSize: 13, color: C.muted }} />
              <Typography fontSize={12} color={C.muted}>{site.location || "—"}</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <RouterIcon sx={{ fontSize: 13, color: C.muted }} />
              <Typography fontSize={11} color={C.muted} fontFamily="monospace">
                {site.gateway_id || "—"}
              </Typography>
            </Box>
          </Box>
        ))}

        {sites.length === 0 && (
          <Typography fontSize={13} color={C.muted}>No sites found.</Typography>
        )}
      </Box>
    </Box>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SCREEN 2 — Line diagram for a selected site
// ══════════════════════════════════════════════════════════════════════════════
function LineMonitorScreen({ site, onBack }) {
  const theme    = useTheme();
  const C        = useColors();
  const navigate = useNavigate();

  const gatewayId  = site.gateway_id?.replace(/:/g, "_") ?? null;

  const [scanRaw,      setScanRaw]      = useState(null);
  const [devices,      setDevices]      = useState([]);
  const [scanMeta,     setScanMeta]     = useState(null);
  const [wsOnline,     setWsOnline]     = useState(false);  // browser → Django WS
  const [gatewayLive,  setGatewayLive]  = useState(false);  // gateway actively sending data
  const gwLiveTimer = useRef(null);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const resp = await getData(`/solardb/get-latest-scan/?site_id=${site.site_id}`);
      if (resp?.data) {
        const s = resp.data;
        setScanMeta({
          scan_id:        s.scan_id,
          scanned_at:     s.scanned_at,
          severity:       s.severity,
          active_count:   s.active_count,
          inactive_count: s.inactive_count,
          total_devices:  s.total_devices,
        });
        setScanRaw({
          wire_p1_ok:  s.wire_p1_ok,
          wire_p2_ok:  s.wire_p2_ok,
          line_ok:     s.line_ok,
          active_port: s.active_port,
          final_id_p1: s.final_id_p1,
          final_id_p2: s.final_id_p2,
        });
        const detail = await getData(`/solardb/get-scan-devices/${s.scan_id}/`);
        if (detail?.devices) setDevices(detail.devices);
      }
    };
    load();
  }, [site.site_id]);

  // ── WebSocket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gatewayId) return;
    const token = sessionStorage.getItem("token");
    const ws    = new WebSocket(`${WS_BASE}/ws/scan/${gatewayId}/?token=${token}`);

    ws.onopen  = () => setWsOnline(true);
    ws.onerror = () => { setWsOnline(false); setGatewayLive(false); };
    ws.onclose = () => { setWsOnline(false); setGatewayLive(false); };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Gateway is live — reset 10-min timer
        setGatewayLive(true);
        if (gwLiveTimer.current) clearTimeout(gwLiveTimer.current);
        gwLiveTimer.current = setTimeout(() => setGatewayLive(false), 10 * 60 * 1000);

        setScanMeta({
          scan_id:        data.scan_id,
          scanned_at:     new Date(data.timestamp).toLocaleString("en-GB"),
          severity:       data.severity,
          active_count:   data.active_ids?.length  ?? 0,
          inactive_count: data.inactive_ids?.length ?? 0,
          total_devices:  data.total ?? 0,
        });
        setScanRaw({
          wire_p1_ok:  data.wire_p1_ok,
          wire_p2_ok:  data.wire_p2_ok,
          line_ok:     data.line_ok,
          active_port: data.active_port,
          final_id_p1: data.final_id_p1 ?? -1,
          final_id_p2: data.final_id_p2 ?? (data.total ?? 0),
        });
        setDevices([
          ...(data.active_ids   || []).map(id => ({ modbus_id: id, status: "active"   })),
          ...(data.inactive_ids || []).map(id => ({ modbus_id: id, status: "inactive" })),
        ]);

      } catch (e) {
        console.error("[WS Scan] Parse error:", e);
      }
    };

    return () => {
      ws.close();
      if (gwLiveTimer.current) clearTimeout(gwLiveTimer.current);
    };
  }, [gatewayId]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const analysis    = analyzeWire(scanRaw, devices);
  const desc        = getDescription(analysis);
  const gapSet      = analysis?.gapSet || new Set();
  const allInactive = devices.filter(d => d.status === "inactive").map(d => d.modbus_id);
  const noLinkIds   = allInactive.filter(id =>  gapSet.has(id));
  const offlineIds  = allInactive.filter(id => !gapSet.has(id));

  const severityColor = !scanMeta      ? C.muted
                      : scanMeta.severity === "ok"      ? C.ok
                      : scanMeta.severity === "warning"  ? C.warn : C.err;

  const severityLabel = !scanMeta      ? "—"
                      : scanMeta.severity === "ok"      ? "✅ NORMAL"
                      : scanMeta.severity === "warning"  ? "⚠️ WARNING"
                      : "🔴 FAULT";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%",
               gap: "12px", padding: "16px" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Box sx={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 1,
        backgroundColor: theme.palette.background.head_box,
        padding: "8px 16px", borderRadius: 1,
      }}>
        {/* Left */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton size="small" onClick={onBack}
                      sx={{ color: theme.palette.text.header_option }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography fontWeight="bold" fontSize={15}
                      color={theme.palette.text.header_option}>
            {site.site_name}
          </Typography>
          <Typography fontSize={11} color={C.muted} fontFamily="monospace">  
            {site.gateway_id || "—"}
          </Typography>
        </Box>

        {/* Right */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2.5 }}>
          {/* Realtime WS indicator */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <FiberManualRecordIcon sx={{ fontSize: 9, color: wsOnline ? C.ok : C.muted }} />
            <Typography fontSize={11} color={wsOnline ? C.ok : C.muted}
                        sx={{ letterSpacing: 0.8 }}>
              {wsOnline ? "REALTIME" : "NO REALTIME"}
            </Typography>
          </Box>

          <Typography fontSize={13} color={severityColor} fontWeight="bold">
            {severityLabel}
          </Typography>
          <Typography fontSize={12} color={C.muted}>
            {scanMeta?.active_count ?? "—"} / {scanMeta?.total_devices ?? "—"} devices
          </Typography>
          <Typography fontSize={11} color={C.ok}>
            {scanMeta?.scanned_at ?? "No data"}
          </Typography>
        </Box>
      </Box>


      {/* ── Diagram box ─────────────────────────────────────────────────────── */}
      <Box sx={{
        flex: 1,
        backgroundColor: C.panelBg,
        borderRadius: 1,
        border: `1px solid ${theme.palette.background.head_box}`,
        display: "flex", flexDirection: "column",
        minHeight: 0,
      }}>
        {/* SVG — scales to fit height, centered, horizontal scroll if many devices */}
        <Box sx={{ flex: 1, padding: "12px", display: "flex",
                   justifyContent: "center", minHeight: 0, overflow: "hidden" }}>
          <LargeWireDiagram raw={scanRaw} devices={devices} gatewayId={site.gateway_id} gatewayLive={gatewayLive} />
        </Box>

        {/* Status description */}
        <Box sx={{
          margin: "0 12px 12px",
          p: 1.5, borderRadius: 1,
          bgcolor: `${desc.color}11`, border: `1px solid ${desc.color}33`,
        }}>
          <Typography fontSize={12} color={desc.color} lineHeight={1.7}>{desc.text}</Typography>
        </Box>
      </Box>

      {/* ── Bottom 3 panels ──────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>

        {/* Panel 1: Online devices */}
        <Box sx={{
          flex: 1, minWidth: 160,
          backgroundColor: C.panelBg,
          borderRadius: 1, padding: "12px 16px",
          border: `1px solid ${theme.palette.background.head_box}`,
        }}>
          <Typography fontSize={13} color={C.ok} fontWeight="bold"
                      sx={{ textTransform: "uppercase", letterSpacing: 1, mb: 1 }}>
            Online ({devices.filter(d => d.status === "active").length})
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {devices.filter(d => d.status === "active")
              .sort((a, b) => a.modbus_id - b.modbus_id)
              .map(d => (
                <Box key={d.modbus_id}
                  onClick={() => navigate(`/devicelist/?meterId=${d.modbus_id}&tab=METER`)}
                  sx={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    padding: "7px 14px", borderRadius: 1, cursor: "pointer",
                    border: `1.5px solid ${C.ok}`, bgcolor: `${C.ok}11`, minWidth: 52,
                    transition: "filter 0.15s",
                    "&:hover": { filter: "brightness(1.3)" },
                  }}>
                  <Typography fontSize={18} fontWeight="bold" color={C.ok}>{d.modbus_id}</Typography>
                </Box>
              ))}
            {devices.filter(d => d.status === "active").length === 0 && (
              <Typography fontSize={13} color={C.muted}>—</Typography>
            )}
          </Box>
        </Box>

        {/* Panel 2: Offline devices */}
        <Box sx={{
          flex: 1, minWidth: 160,
          backgroundColor: C.panelBg,
          borderRadius: 1, padding: "12px 16px",
          border: `1px solid ${theme.palette.background.head_box}`,
        }}>
          <Typography fontSize={13} color={C.err} fontWeight="bold"
                      sx={{ textTransform: "uppercase", letterSpacing: 1, mb: 1 }}>
            Offline ({devices.filter(d => d.status !== "active").length})
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {devices.filter(d => d.status !== "active")
              .sort((a, b) => a.modbus_id - b.modbus_id)
              .map(d => {
                const isGap = gapSet.has(d.modbus_id);
                const lbl   = isGap ? "no link" : "offline";
                return (
                  <Box key={d.modbus_id}
                    onClick={() => navigate(`/devicelist/?meterId=${d.modbus_id}&tab=METER`)}
                    sx={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      padding: "7px 14px", borderRadius: 1, cursor: "pointer",
                      border: `1.5px ${isGap ? "dashed" : "solid"} ${C.err}`,
                      bgcolor: `${C.err}11`, minWidth: 52,
                      transition: "filter 0.15s",
                      "&:hover": { filter: "brightness(1.3)" },
                    }}>
                    <Typography fontSize={18} fontWeight="bold" color={C.err}>{d.modbus_id}</Typography>
                    <Typography fontSize={11} color={C.err}>{lbl}</Typography>
                  </Box>
                );
              })}
            {devices.filter(d => d.status !== "active").length === 0 && (
              <Typography fontSize={13} color={C.muted}>—</Typography>
            )}
          </Box> 
        </Box>

        {/* Panel 3: Legend — 2-column grid */}
        <Box sx={{
          flex: 1, minWidth: 220,
          backgroundColor: C.panelBg,
          borderRadius: 1, padding: "12px 16px",
          border: `1px solid ${theme.palette.background.head_box}`,
        }}>
          <Typography fontSize={13} color={C.warn} fontWeight="bold"
                      sx={{ textTransform: "uppercase", letterSpacing: 1, mb: 1.2 }}>
            Legend
          </Typography>
          {/* max 3 items per column, wraps to next column automatically */}
          <Box sx={{
            display: "flex", flexDirection: "column", flexWrap: "wrap",
            maxHeight: "90px", gap: "6px", columnGap: "20px",
          }}>
            <LegendItem color={C.ok}  icon="line-solid"  label="Normal cable" />
            <LegendItem color={C.err} icon="line-dashed" label="Broken cable" />
            <LegendItem color={C.err} icon="circle-x"    label="Break point" />
            <LegendItem color={C.ok}  icon="box-solid"   label="Device online" />
            <LegendItem color={C.err} icon="box-solid"   label="Device offline" />
            <LegendItem color={C.err} icon="box-dashed"  label="No link" />
            <LegendItem color={C.err} icon="line-vert"   label="Tap wire (offline)" />
          </Box>
        </Box>

      </Box>
    </Box> 
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════════════════════════════
export default function SiteKPI() {
  const [selectedSite, setSelectedSite] = useState(null);
  // const = chặn việc gán lại biến trực tiếp
  // useState(null) trả về  [ giá_trị ,  hàm_thay_đổi ]
  // useState(null) = tạo ra 1 ô nhớ, ban đầu chứa null
  // selectedSite = tên biến mình tự đặt, dùng để đọc giá trị từ ô nhớ mà useState tạo ra — ô nhớ đó ban đầu chứa null
  // setSelectedSite = là 1 hàm cũng như là cách duy nhất để có thể thay đổi giá trị trong ô nhớ của biến selectedSite 

  if (selectedSite) { 
    // khi người dùng click vào 1 site bất kì
    return <LineMonitorScreen site={selectedSite} onBack={() => setSelectedSite(null)} />;
  }
  return <SiteListScreen onSelect={setSelectedSite} />;
}
