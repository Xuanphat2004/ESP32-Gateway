import { useState, useEffect, useMemo, useRef } from "react";
import { Bar } from "react-chartjs-2";
import axios from "axios";
import { Box, Typography, ToggleButton, ToggleButtonGroup, CircularProgress } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { DatePicker }           from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs }         from "@mui/x-date-pickers/AdapterDayjs";
import dayjs                    from "dayjs";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const TIME_MODES = [
  { key: "hour",  label: "Hour" },
  { key: "week",  label: "Week" },
  { key: "month", label: "Month" },
  { key: "year",  label: "Year" },
];

// ── Gọi API Django thật ──────────────────────────────────────────────────────
// Backend trả về dạng ĐỘNG: { labels:[...], series:[{key,meter_id,label,color,data}, ...] }
// Bao nhiêu meter cũng tự hiện, không cần sửa code frontend.
async function fetchData(mode, dateParam) {
  const token = sessionStorage.getItem("token");
  const res = await axios.get("http://localhost:8000/solardb/energy-chart/", {
    params:  { type: mode, date: dateParam },
    headers: { Authorization: `Token ${token}` },
  });
  return {
    labels: res.data.labels ?? [],
    series: res.data.series ?? [],
  };
}

export default function EnergyConsumptionChart() {
  const theme = useTheme();
  const [mode, setMode]                   = useState("hour");
  const [selectedMeter, setSelectedMeter] = useState("all");   // "all" | meterKey
  const [selectedDate, setSelectedDate]   = useState(dayjs()); // ngày đang xem
  const [data, setData]                   = useState({ labels: [], series: [] });
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");

  const dateParam = selectedDate.format("YYYY-MM-DD");

  // ── Fetch khi đổi mode hoặc ngày ──────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");

    fetchData(mode, dateParam)
      .then((d) => { if (alive) setData(d); })
      .catch((err) => {
        console.error("Energy chart fetch error:", err);
        if (alive) {
          setError("Failed to load energy data");
          setData({ labels: [], series: [] });
        }
      })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [mode, dateParam]);

  // ── WebSocket live-update ─────────────────────────────────────────────────
  // Chỉ live-update khi đang xem HÔM NAY. Xem ngày cũ thì dữ liệu cố định.
  const refetchTimer = useRef(null);

  useEffect(() => {
    const isToday = selectedDate.isSame(dayjs(), "day");
    if (!isToday) return;            // ngày cũ → không cần WS

    const meterIds = data.series.map((s) => s.meter_id);
    if (meterIds.length === 0) return;

    const sockets = meterIds.map((id) => {
      const ws = new WebSocket(`ws://localhost:8000/ws/meter_register/${id}/`);
      ws.onmessage = () => {
        clearTimeout(refetchTimer.current);
        refetchTimer.current = setTimeout(() => {
          fetchData(mode, dateParam)
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
  }, [mode, dateParam, data.series.length]);

  // ── Series đang hiển thị ──────────────────────────────────────────────────
  const visibleSeries = useMemo(
    () => selectedMeter === "all"
      ? data.series
      : data.series.filter((s) => s.key === selectedMeter),
    [data.series, selectedMeter]
  );

  // ── Tổng kWh ──────────────────────────────────────────────────────────────
  const total = useMemo(
    () => visibleSeries.reduce(
      (sum, s) => sum + s.data.reduce((a, v) => a + (v || 0), 0), 0
    ),
    [visibleSeries]
  );

  // ── Cấu hình Chart.js ──────────────────────────────────────────────────────
  const chartData = {
    labels: data.labels,
    datasets: visibleSeries.map((s) => ({
      label: s.label,
      data: s.data,
      backgroundColor: s.color,
      stack: "energy",
      borderRadius: 3,
      maxBarThickness: mode === "hour" ? 18 : 44,
    })),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { labels: { color: "#cbd5e1", boxWidth: 12, font: { size: 12 } } },
      tooltip: {
        backgroundColor: "#0b1f2a",
        borderColor: "#1e3a4a", borderWidth: 1,
        callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y} kWh` },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { color: "#94a3b8", font: { size: 11 }, maxRotation: 0, autoSkip: true },
      },
      y: {
        stacked: true,
        grid: { color: "#1e3a4a" },
        ticks: { color: "#94a3b8", font: { size: 11 } },
        title: { display: true, text: "kWh", color: "#64748b" },
      },
    },
  };

  const selectedLabel = data.series.find((s) => s.key === selectedMeter)?.label;
  const isToday = selectedDate.isSame(dayjs(), "day");

  return (
    <Box sx={{ boxShadow: "0 4px 6px rgba(19,16,16,0.1)", display: "flex", flexDirection: "column" }}>

      {/* Header bar */}
      <Box sx={{
        display: "flex", flexDirection: "row",
        justifyContent: "space-between", alignItems: "center",
        backgroundColor: theme.palette.background.head_box,
        px: "17px", py: "6px",
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
      <Box sx={{
        backgroundColor: theme.palette.background.box,
        p: 2, display: "flex", flexDirection: "column", gap: 1.5,
      }}>

        {/* Hàng điều khiển: chọn ngày + lọc meter */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="Select date"
              value={selectedDate}
              maxDate={dayjs()}
              onChange={(v) => v && setSelectedDate(v)}
              slotProps={{
                textField: {
                  size: "small",
                  sx: {
                    width: 170,
                    input: { color: "white", fontSize: 13 },
                    label: { color: "#7c95a6" },
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#15323f" },
                    "& .MuiSvgIcon-root": { color: "#7c95a6" },
                  },
                },
              }}
            />
          </LocalizationProvider>

          {/* Nút Today — chỉ hiện khi không phải hôm nay */}
          {!isToday && (
            <ToggleButton value="today" selected={false}
              size="small"
              onClick={() => setSelectedDate(dayjs())}
              sx={{
                color: "#00bcd4", borderColor: "#00bcd4",
                textTransform: "none", fontSize: 13, px: 1.6, py: 0.5,
                border: "1px solid #00bcd4",
              }}>
              Today
            </ToggleButton>
          )}

          {/* Lọc meter — render ĐỘNG theo series backend trả về */}
          <ToggleButtonGroup size="small" exclusive value={selectedMeter}
            onChange={(_, v) => v && setSelectedMeter(v)}
            sx={{ ...tgStyle, flexWrap: "wrap" }}>
            <ToggleButton value="all">All</ToggleButton>
            {data.series.map((s) => (
              <ToggleButton key={s.key} value={s.key}>
                <Box component="span" sx={{ width: 9, height: 9, borderRadius: "2px",
                                            bgcolor: s.color, mr: 0.8 }} />
                {s.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        {/* Biểu đồ */}
        <Box sx={{ height: 320, position: "relative" }}>
          {error ? (
            <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography sx={{ color: "#ff6b6b", fontSize: 13 }}>{error}</Typography>
            </Box>
          ) : data.series.length === 0 && !loading ? (
            <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography sx={{ color: "#7c95a6", fontSize: 13 }}>
                No energy data for this period
              </Typography>
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
