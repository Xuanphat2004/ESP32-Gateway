import { useState, useEffect, useMemo, useRef } from "react";
import { Bar } from "react-chartjs-2";
import axios from "axios";
import {
  Box, Typography, ToggleButton, ToggleButtonGroup, CircularProgress,
  IconButton, Select, MenuItem, Button, FormControl,
} from "@mui/material";
import ChevronLeftIcon  from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { useTheme } from "@mui/material/styles";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend,
} from "chart.js";

dayjs.extend(isoWeek);
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const TIME_MODES = [
  { key: "hour",  label: "Hour" },
  { key: "week",  label: "Week" },
  { key: "month", label: "Month" },
  { key: "year",  label: "Year" },
];

const API_BASE = "http://localhost:8000";

// ── Gọi API biểu đồ ──────────────────────────────────────────────────────────
async function fetchData(mode, dateParam, siteId) {
  const token = sessionStorage.getItem("token");
  const params = { type: mode, date: dateParam };
  if (siteId && siteId !== "all") params.site_id = siteId;
  const res = await axios.get(`${API_BASE}/solardb/energy-chart/`, {
    params,
    headers: { Authorization: `Token ${token}` },
  });
  return { labels: res.data.labels ?? [], series: res.data.series ?? [] };
}

// ── Nhãn khoảng thời gian đang xem (hiển thị giữa 2 mũi tên) ──────────────────
function periodLabel(mode, date) {
  if (mode === "hour")  return date.format("DD/MM/YYYY");
  if (mode === "week") {
    const monday = date.startOf("isoWeek");
    const sunday = monday.add(6, "day");
    return `${monday.format("DD/MM")} - ${sunday.format("DD/MM/YYYY")}`;
  }
  if (mode === "month") return date.format("MM/YYYY");
  if (mode === "year")  return date.format("YYYY");
  return "";
}

// ── Dịch chuyển ngày theo mode khi bấm mũi tên ───────────────────────────────
function shiftDate(mode, date, dir) {
  const unit = mode === "hour" ? "day"
             : mode === "week" ? "week"
             : mode === "month" ? "month" : "year";
  return date.add(dir, unit);
}

export default function EnergyConsumptionChart() {
  const theme = useTheme();
  const [mode, setMode]                   = useState("hour");
  const [selectedMeter, setSelectedMeter] = useState("all");
  const [selectedDate, setSelectedDate]   = useState(dayjs());
  const [sites, setSites]                 = useState([]);
  const [selectedSite, setSelectedSite]   = useState("all");
  const [data, setData]                   = useState({ labels: [], series: [] });
  const [loading, setLoading]             = useState(false);
  const [exporting, setExporting]         = useState(false);
  const [error, setError]                 = useState("");

  const dateParam = selectedDate.format("YYYY-MM-DD");

  // ── Lấy danh sách site cho dropdown ──────────────────────────────────────
  useEffect(() => {
    const token = sessionStorage.getItem("token");
    axios.get(`${API_BASE}/solardb/get-my-sites/`, {
      headers: { Authorization: `Token ${token}` },
    })
    .then((res) => setSites(res.data || []))
    .catch((e) => console.error("Fetch sites error:", e));
  }, []);

  // ── Fetch dữ liệu khi đổi mode / ngày / site ─────────────────────────────
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");

    fetchData(mode, dateParam, selectedSite)
      .then((d) => { if (alive) setData(d); })
      .catch((err) => {
        console.error("Energy chart fetch error:", err);
        if (alive) { setError("Failed to load energy data"); setData({ labels: [], series: [] }); }
      })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [mode, dateParam, selectedSite]);

  // ── WebSocket live-update (chỉ khi đang xem hiện tại) ────────────────────
  const refetchTimer = useRef(null);
  useEffect(() => {
    const isCurrent = selectedDate.isSame(dayjs(), mode === "hour" ? "day" : mode);
    if (!isCurrent) return;

    const meterIds = data.series.map((s) => s.meter_id);
    if (meterIds.length === 0) return;

    const sockets = meterIds.map((id) => {
      const ws = new WebSocket(`ws://localhost:8000/ws/meter_register/${id}/`);
      ws.onmessage = () => {
        clearTimeout(refetchTimer.current);
        refetchTimer.current = setTimeout(() => {
          fetchData(mode, dateParam, selectedSite)
            .then((d) => setData(d))
            .catch((e) => console.error("Energy re-fetch error:", e));
        }, 1500);
      };
      ws.onerror = (e) => console.error(`WS energy meter ${id} error:`, e);
      return ws;
    });

    return () => {
      clearTimeout(refetchTimer.current);
      sockets.forEach((s) => s.close());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, dateParam, selectedSite, data.series.length]);

  // ── Export Excel ─────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try {
      const token = sessionStorage.getItem("token");
      const params = { type: mode, date: dateParam };
      if (selectedSite !== "all") params.site_id = selectedSite;

      const res = await axios.get(`${API_BASE}/solardb/energy-export/`, {
        params,
        headers: { Authorization: `Token ${token}` },
        responseType: "blob",   // nhận file nhị phân
      });

      // Tạo link tải file
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = `energy_report_${mode}_${dateParam}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export error:", e);
      setError("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const visibleSeries = useMemo(
    () => selectedMeter === "all"
      ? data.series
      : data.series.filter((s) => s.key === selectedMeter),
    [data.series, selectedMeter]
  );

  const total = useMemo(
    () => visibleSeries.reduce((sum, s) => sum + s.data.reduce((a, v) => a + (v || 0), 0), 0),
    [visibleSeries]
  );

  const chartData = {
    labels: data.labels,
    datasets: visibleSeries.map((s) => ({
      label: s.label, data: s.data, backgroundColor: s.color,
      stack: "energy", borderRadius: 3,
      maxBarThickness: mode === "hour" ? 18 : 44,
    })),
  };

  const options = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { labels: { color: "#cbd5e1", boxWidth: 12, font: { size: 12 } } },
      tooltip: {
        backgroundColor: "#0b1f2a", borderColor: "#1e3a4a", borderWidth: 1,
        callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y} kWh` },
      },
    },
    scales: {
      x: { stacked: true, grid: { display: false },
           ticks: { color: "#94a3b8", font: { size: 11 }, maxRotation: 0, autoSkip: true } },
      y: { stacked: true, grid: { color: "#1e3a4a" },
           ticks: { color: "#94a3b8", font: { size: 11 } },
           title: { display: true, text: "kWh", color: "#64748b" } },
    },
  };

  const selectedLabel = data.series.find((s) => s.key === selectedMeter)?.label;
  // Chặn mũi tên phải vượt quá hiện tại
  const isCurrentPeriod = selectedDate.isSame(dayjs(), mode === "hour" ? "day" : mode);

  return (
    <Box sx={{ boxShadow: "0 4px 6px rgba(19,16,16,0.1)", display: "flex", flexDirection: "column" }}>

      {/* Header bar */}
      <Box sx={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        backgroundColor: theme.palette.background.head_box, px: "17px", py: "6px",
      }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5 }}>
          <Typography color="white">Energy Consumption</Typography>
          <Typography variant="body2" color="#5b7384">
            {selectedMeter === "all" ? "All meters" : selectedLabel}
          </Typography>
          <Typography variant="body2" color="#00bcd4" fontWeight={700}>
            {total.toFixed(1)} kWh
          </Typography>
          {loading && <CircularProgress size={13} sx={{ color: "#00bcd4" }} />}
        </Box>

        <ToggleButtonGroup size="small" exclusive value={mode}
          onChange={(_, v) => v && setMode(v)} sx={tgStyle}>
          {TIME_MODES.map((t) => (
            <ToggleButton key={t.key} value={t.key}>{t.label}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Content */}
      <Box sx={{ backgroundColor: theme.palette.background.box, p: 2,
                 display: "flex", flexDirection: "column", gap: 1.5 }}>

        {/* Hàng điều khiển: site + mũi tên ngày + export */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>

          {/* Dropdown chọn site */}
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <Select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              sx={{
                color: "white", fontSize: 13,
                ".MuiOutlinedInput-notchedOutline": { borderColor: "#15323f" },
                ".MuiSvgIcon-root": { color: "#7c95a6" },
              }}
            >
              <MenuItem value="all">All Sites</MenuItem>
              {sites.map((s) => (
                <MenuItem key={s.site_id} value={s.site_id}>{s.site_name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Mũi tên ◀ ▶ + nhãn khoảng thời gian */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5,
                     border: "1px solid #15323f", borderRadius: 1, px: 0.5 }}>
            <IconButton size="small" onClick={() => setSelectedDate((d) => shiftDate(mode, d, -1))}
                        sx={{ color: "#00bcd4" }}>
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <Typography sx={{ color: "white", fontSize: 13, minWidth: 130, textAlign: "center" }}>
              {periodLabel(mode, selectedDate)}
            </Typography>
            <IconButton size="small" disabled={isCurrentPeriod}
                        onClick={() => setSelectedDate((d) => shiftDate(mode, d, 1))}
                        sx={{ color: isCurrentPeriod ? "#33505e" : "#00bcd4" }}>
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Nút về hiện tại */}
          {!isCurrentPeriod && (
            <Button size="small" onClick={() => setSelectedDate(dayjs())}
              sx={{ color: "#00bcd4", border: "1px solid #00bcd4", textTransform: "none", fontSize: 13 }}>
              Now
            </Button>
          )}

          {/* Nút Export Excel */}
          <Button size="small" variant="contained" disabled={exporting || data.series.length === 0}
            onClick={handleExport} startIcon={exporting ? <CircularProgress size={14} /> : <FileDownloadIcon />}
            sx={{ ml: "auto", bgcolor: "#00838f", textTransform: "none", fontSize: 13,
                  "&:hover": { bgcolor: "#006978" } }}>
            {exporting ? "Exporting..." : "Export Excel"}
          </Button>
        </Box>

        {/* Lọc meter */}
        <ToggleButtonGroup size="small" exclusive value={selectedMeter}
          onChange={(_, v) => v && setSelectedMeter(v)} sx={{ ...tgStyle, flexWrap: "wrap" }}>
          <ToggleButton value="all">All</ToggleButton>
          {data.series.map((s) => (
            <ToggleButton key={s.key} value={s.key}>
              <Box component="span" sx={{ width: 9, height: 9, borderRadius: "2px",
                                          bgcolor: s.color, mr: 0.8 }} />
              {s.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {/* Biểu đồ */}
        <Box sx={{ height: 320, position: "relative" }}>
          {error ? (
            <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography sx={{ color: "#ff6b6b", fontSize: 13 }}>{error}</Typography>
            </Box>
          ) : data.series.length === 0 && !loading ? (
            <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography sx={{ color: "#7c95a6", fontSize: 13 }}>No energy data for this period</Typography>
            </Box>
          ) : (
            <Bar data={chartData} options={options} />
          )}
        </Box>
      </Box>
    </Box>
  );
}

const tgStyle = {
  bgcolor: "#08222e",
  "& .MuiToggleButton-root": {
    color: "#7c95a6", border: "1px solid #15323f",
    textTransform: "none", fontSize: 13, px: 1.6, py: 0.5,
  },
  "& .Mui-selected": {
    bgcolor: "#00bcd4 !important", color: "#06222e !important", fontWeight: 700,
  },
};
