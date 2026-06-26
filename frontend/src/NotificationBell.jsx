import { useState, useEffect, useRef, useCallback } from "react";
import {
  IconButton, Badge, Popover, Box, Typography, Button,
  List, ListItemButton, ListItemIcon, ListItemText, Divider, Tooltip,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import NotificationsIcon from "@mui/icons-material/Notifications";
import WarningAmberIcon  from "@mui/icons-material/WarningAmber";
import ErrorOutlineIcon  from "@mui/icons-material/ErrorOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import InfoOutlinedIcon  from "@mui/icons-material/InfoOutlined";
import VolumeUpIcon      from "@mui/icons-material/VolumeUp";
import VolumeOffIcon     from "@mui/icons-material/VolumeOff";
import { useNavigate } from "react-router-dom";
import { getData } from "./ApiComponent/api";  // NotificationBell.jsx ở src/ → cùng cấp với ApiComponent

import { WS_BASE as _WS_BASE } from "./config";
// ⚙️ Cấu hình
const WS_BASE     = `${_WS_BASE}/ws/scan/`;
const ALARM_ROUTE = "/alarmsnooze";
const MAX_ITEMS   = 30;


// ── severity → icon + màu ────────────────────────────────────────────────
const severityMeta = (sev) => {
  switch (String(sev || "").toLowerCase()) {
    case "critical":
    case "error":   return { Icon: ErrorOutlineIcon,       color: "#ef5350" };
    case "warning": return { Icon: WarningAmberIcon,       color: "#ffa726" };
    case "normal":  return { Icon: CheckCircleOutlineIcon, color: "#66bb6a" };
    default:        return { Icon: InfoOutlinedIcon,       color: "#42a5f5" };
  }
};

// ── "vài giây trước" ─────────────────────────────────────────────────────
const timeAgo = (date) => {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24); return `${d} d ago`;
};

// ── Dựng thông báo từ payload scan ──────────────────────────────────────
let _seq = 0;
const buildNotification = (data, siteName) => {
  const offCount = Array.isArray(data.inactive_ids) ? data.inactive_ids.length : 0;

  // Cùng logic với AlarmSnooze:
  // Warning khi: severity="warning" HOẶC line_ok=false (dây đứt dù thiết bị vẫn online)
  const isWarning = String(data.severity || "").toLowerCase() === "warning"
                    || data.line_ok === false;

  // Nội dung thông báo — ưu tiên kiểm tra inactive trước, rồi line_ok
  let detail;
  if (offCount > 0) {
    detail = `${offCount} device(s) disconnected`;
  } else if (data.line_ok === false) {
    detail = "Line broken";
  } else {
    detail = "All devices connected — Line OK";
  }

  const title = isWarning ? "⚠ Line Scan Alarm" : "✅ Line Scan OK";

  const when = data.timestamp ? new Date(data.timestamp) : new Date();
  return {
    id:       `${data.scan_id ?? Date.now()}-${_seq++}`,
    severity: isWarning ? "warning" : "normal",
    title,
    message:  siteName ? `${detail} — ${siteName}` : detail,
    time:     isNaN(when.getTime()) ? new Date() : when,
    read:     false,
  };
};


export default function NotificationBell() {
  const theme    = useTheme();
  const navigate = useNavigate();

  const [items,    setItems]    = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [soundOn,  setSoundOn]  = useState(true);

  const soundOnRef = useRef(soundOn);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);

  const unread = items.filter((n) => !n.read).length;
  const open   = Boolean(anchorEl);

  // ── Thêm 1 thông báo + (tùy chọn) kêu "ping" ──────────────────────────
  const addNotification = useCallback((notif) => {
    setItems((prev) => [notif, ...prev].slice(0, MAX_ITEMS));
    if (soundOnRef.current) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880; gain.gain.value = 0.05;
        osc.start(); osc.stop(ctx.currentTime + 0.12);
      } catch { /* trình duyệt chặn audio khi chưa tương tác — bỏ qua */ }
    }
  }, []);

  // ── Kết nối WS scan cho TỪNG gateway, tự reconnect khi đứt ──────────
  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) return;

    let cancelled = false;
    const sockets = [];
    const timers  = [];

    const connectGateway = (rawGatewayId, siteName) => {
      const gid = rawGatewayId.replace(/:/g, "_");
      const url = `${WS_BASE}${gid}/?token=${token}`;

      const connect = () => {
        if (cancelled) return;
        const ws = new WebSocket(url);
        sockets.push(ws);

        ws.onopen = () => console.log("[Bell] Connected:", gid);

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            // Nhận TẤT CẢ kết quả scan — không lọc severity
            addNotification(buildNotification(data, siteName));
          } catch (err) {
            console.error("[Bell] Parse error:", err);
          }
        };

        ws.onclose = (e) => {
          // 4001 = chưa auth, 4003 = không phải chủ gateway → KHÔNG reconnect
          if (!cancelled && e.code !== 4001 && e.code !== 4003) {
            console.warn(`[Bell] WS dropped (${gid}), reconnecting in 3s...`);
            timers.push(setTimeout(connect, 3000));
          }
        };

        ws.onerror = () => ws.close();
      };

      connect();
    };

    getData("/solardb/get-my-sites/")
      .then((sites) => {
        if (cancelled || !Array.isArray(sites)) return;
        sites.forEach((s) => {
          if (s.gateway_id) connectGateway(s.gateway_id, s.site_name);
        });
      })
      .catch((err) => console.error("[Bell] Fetch sites error:", err));

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      sockets.forEach((ws) => ws.close());
    };
  }, [addNotification]);

  // ── Mở popover → đánh dấu tất cả đã đọc ──────────────────────────────
  const handleOpen  = (e) => {
    setAnchorEl(e.currentTarget);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };
  const handleClose     = () => setAnchorEl(null);
  const clearAll        = () => setItems([]);
  const handleItemClick = () => { handleClose(); navigate(ALARM_ROUTE); };

  const headerColor = theme.palette?.text?.header_option || "#90caf9";

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton onClick={handleOpen} sx={{ color: theme.palette.text.header_option }}>
          <Badge badgeContent={unread} max={99} color="error" overlap="circular">
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              width: 360, maxHeight: 460, overflow: "hidden",
              backgroundColor: "#1b1b1b", color: "#e0e0e0",
              border: "1px solid #333", borderRadius: 2,
            },
          },
        }}
      >
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1.2 }}>
          <Typography sx={{ fontWeight: 600, color: headerColor }}>
            Notifications {unread > 0 && `(${unread})`}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Tooltip title={soundOn ? "Mute sound" : "Unmute sound"}>
              <IconButton size="small" onClick={() => setSoundOn((s) => !s)} sx={{ color: "#aaa" }}>
                {soundOn ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Button size="small" onClick={clearAll} disabled={items.length === 0}
              sx={{ color: "#aaa", textTransform: "none", minWidth: 0 }}>
              Clear all
            </Button>
          </Box>
        </Box>
        <Divider sx={{ borderColor: "#333" }} />

        {/* Danh sách thông báo */}
        {items.length === 0 ? (
          <Box sx={{ py: 5, textAlign: "center", color: "#777" }}>
            <NotificationsIcon sx={{ fontSize: 36, opacity: 0.4 }} />
            <Typography sx={{ mt: 1, fontSize: 13 }}>No notifications yet</Typography>
          </Box>
        ) : (
          <List sx={{ p: 0, overflowY: "auto", maxHeight: 392 }}>
            {items.map((n) => {
              const { Icon, color } = severityMeta(n.severity);
              return (
                <ListItemButton key={n.id} onClick={handleItemClick}
                  sx={{ alignItems: "flex-start", borderBottom: "1px solid #2a2a2a", "&:hover": { backgroundColor: "#262626" } }}>
                  <ListItemIcon sx={{ minWidth: 36, mt: 0.3 }}>
                    <Icon sx={{ color }} fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={n.title}
                    secondary={
                      <>
                        <Typography component="span" sx={{ display: "block", color: "#bbb", fontSize: 13 }}>
                          {n.message}
                        </Typography>
                        <Typography component="span" sx={{ display: "block", color: "#777", fontSize: 11, mt: 0.3 }}>
                          {timeAgo(n.time)}
                        </Typography>
                      </>
                    }
                    primaryTypographyProps={{ sx: { color: "#eee", fontSize: 14, fontWeight: 500 } }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Popover>
    </>
  );
}