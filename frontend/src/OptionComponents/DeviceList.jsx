import { Button } from "@mui/material";
import { useState, useEffect, useRef } from "react";
import { Box } from "@mui/system";
import { useTheme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import {
  Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper,
} from "@mui/material";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Brush,
} from "recharts";
import { DatePicker }           from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs }         from "@mui/x-date-pickers/AdapterDayjs";
import dayjs                    from "dayjs";
import { getData } from "../ApiComponent/api";
import { useSearchParams } from "react-router-dom";


// ── Helper: format ISO timestamp → DD/MM/YYYY HH:MM:SS ──────────────────
const formatTs = (ts) => {
  if (!ts || ts === '--') return '--';
  try {
    // "2026-05-28T15:36:23+07:00" → "28/05/2026 15:36:23"
    const d = new Date(ts);
    if (isNaN(d.getTime())) {
      // fallback: cắt chuỗi nếu không parse được
      return ts.replace('T', ' ').slice(0, 19);
    }
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} `
         + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch { return ts; }
};

//======================================== INVERTER ===================================================
const InverterTable = ({ siteId }) => {
  const theme = useTheme();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const fetchInverter = async () => {
      try {
        const response = await fetch(`http://localhost:8000/solardb/get-all-inverter-records/?site_id=${siteId}`);
        if (!response.ok) throw new Error(`Lỗi ${response.status}`);
        const data = await response.json();
        setRows(data.map(item => ({
          name: item.inverter_name ?? "--", system_diagram: item.system_diagram ?? "--",
          state: item.state ?? "--", meter_read_total_energy: item.meter_read_total_energy ?? "--",
          active_power: item.active_power ?? "--", input_power: item.input_power ?? "--",
          efficiency: item.efficiency ?? "--", production_today: item.production_today ?? "--",
          internal_temp: item.internal_temp ?? "--", down_string_count: item.down_string_count ?? "--",
          yield_today: item.yield_today ?? "--",
        })));
      } catch (error) { console.error("Fetch error:", error); }
    };
    fetchInverter();
  }, [siteId]);

  useEffect(() => {
    const socket = new WebSocket(`ws://localhost:8000/ws/inverter/${siteId}/`);
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setRows(data.map(item => ({
        name: item.inverter_name ?? "--", system_diagram: item.system_diagram ?? "--",
        state: item.state ?? "--", meter_read_total_energy: item.meter_read_total_energy ?? "--",
        active_power: item.active_power ?? "--", input_power: item.input_power ?? "--",
        efficiency: item.efficiency ?? "--", production_today: item.production_today ?? "--",
        internal_temp: item.internal_temp ?? "--", down_string_count: item.down_string_count ?? "--",
        yield_today: item.yield_today ?? "--",
      })));
    };
    socket.onerror = (e) => console.error("WS inverter error:", e);
    return () => socket.close();
  }, [siteId]);

  return (
    <TableContainer component={Paper} sx={{ maxHeight: 500, backgroundColor: "#1b1b1b", overflow: "auto" }}>
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            {["Inverter Name","Syst.Diag.","State","Meter-read","Active Power","Input Power",
              "Efficiency","Production Today","Internal Temp","Down String","Yield Today"].map(col => (
              <TableCell key={col} sx={{ backgroundColor: theme.palette.text.header_option, color: "white", minWidth: 130 }}>{col}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {["name","system_diagram","state","meter_read_total_energy","active_power","input_power",
                "efficiency","production_today","internal_temp","down_string_count","yield_today"].map(key => (
                <TableCell key={key} sx={{ color: theme.palette.table.text, backgroundColor: i%2===0 ? theme.palette.table.background_odd : theme.palette.table.background_even }}>{row[key]}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};


//======================================================================================================================
//==================================================== METER ===========================================================
//======================================================================================================================

const MeterTable = ({ siteId }) => {
  const theme = useTheme();

  // ── State tầng 1: Bảng tổng quát ──
  const [rows, setRows] = useState([]);

  // ── State tầng 2: Bảng chi tiết thanh ghi ──
  const [selectedMeter,  setSelectedMeter]  = useState(null);
  const [detailRows,     setDetailRows]     = useState([]);
  const [loadingDetail,  setLoadingDetail]  = useState(false);

  // ── State tầng 3: Lịch sử + chart của 1 thanh ghi ──
  const [selectedRegister, setSelectedRegister] = useState(null);
  const [historyRows,      setHistoryRows]      = useState([]);
  const [loadingHistory,   setLoadingHistory]   = useState(false);

  // ── State filter ngày ──
  const [filterDate, setFilterDate] = useState(null);

  // ── Refs (khai báo SAU state — tránh Temporal Dead Zone) ──────────────
  // detailRowsRef: merge detailRows trong EFFECT 3 không bị stale closure
  const detailRowsRef = useRef([]);
  useEffect(() => { detailRowsRef.current = detailRows; }, [detailRows]);

  // selectedRegisterRef: EFFECT 3 biết user đang xem register nào (tầng 3)
  // Không đưa selectedRegister vào deps EFFECT 3 → socket không restart khi đổi register
  const selectedRegisterRef = useRef(null);
  useEffect(() => { selectedRegisterRef.current = selectedRegister; }, [selectedRegister]);

  // filterDateRef: EFFECT 3 biết đang xem hôm nay hay ngày cũ
  const filterDateRef = useRef(null);
  useEffect(() => { filterDateRef.current = filterDate; }, [filterDate]);


  // ── EFFECT 1: Fetch bảng tổng quát lần đầu ──
  useEffect(() => {
    const fetchMeter = async () => {
      try {
        const data = await getData(siteId ? "/solardb/get-latest-meter-records/" : "/solardb/get-all-meters/");
        if (!data) throw new Error("Network error");
        setRows(data.map(item => ({
          site_name: item.site_name ?? "--", meter_id: item.meter_id ?? "--",
          name: item.meter_name ?? "--", device_model: item.device_model ?? "--",
          attribute: item.attribute ?? "--", status: item.status ?? "--",
          voltage_l1: item.voltage_l1 ?? "--", current_l1: item.current_l1 ?? "--",
          current_l1_dmd: item.current_l1_dmd ?? "--", frequency_l1: item.frequency_l1 ?? "--",
          apparent_power_l1: item.apparent_power_l1 ?? "--", real_power: item.real_power ?? "--",
          timestamp: item.timestamp ?? "--",
        })));
      } catch (error) { console.error("Fetch meter list error:", error); }
    };
    fetchMeter();
  }, [siteId]);


  // ── EFFECT 2: WS bảng tổng quát realtime ──
  useEffect(() => {
    const socket = new WebSocket(
      siteId ? `ws://localhost:8000/ws/meter/${siteId}/` : `ws://localhost:8000/ws/all_meters/`
    );
    socket.onopen  = () => console.log("[WS] Tổng quát connected");
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setRows(data.map(item => ({
        site_name: item.site_name ?? "--", meter_id: item.meter_id ?? "--",
        name: item.meter_name ?? "--", device_model: item.device_model ?? "--",
        attribute: item.attribute ?? "--", status: item.status ?? "--",
        voltage_l1: item.voltage_l1 ?? "--", current_l1: item.current_l1 ?? "--",
        current_l1_dmd: item.current_l1_dmd ?? "--", frequency_l1: item.frequency_l1 ?? "--",
        apparent_power_l1: item.apparent_power_l1 ?? "--", real_power: item.real_power ?? "--",
        timestamp: item.timestamp ?? "--",
      })));
    };
    socket.onclose = (e) => console.warn("[WS] Tổng quát closed:", e.code);
    socket.onerror = (e) => console.error("[WS] Tổng quát error:", e);
    return () => socket.close();
  }, [siteId]);


  // ── EFFECT 3: WS bảng chi tiết ─────────────────────────────────────────
  //
  // Làm 2 việc cùng lúc:
  //   1. Cập nhật bảng chi tiết (tầng 2) — merge value mới vào detailRows
  //   2. Cập nhật lịch sử + chart (tầng 3) — chèn vào historyRows theo timestamp
  //
  // Tại sao không dùng WS riêng cho tầng 3?
  //   - WS register_history cần 1 kết nối mới mỗi lần click register → phức tạp
  //   - group_send × 350 register mỗi poll → tốn kém
  //   - WS này đã nhận ĐỦ data của toàn bộ meter → lọc ra register cần xem là xong
  //   - Dùng ref thay vì state trong closure → không cần restart socket khi chuyển register
  useEffect(() => {
    if (!selectedMeter) return;
    const socket = new WebSocket(`ws://localhost:8000/ws/meter_register/${selectedMeter.meter_id}/`);
    socket.onopen  = () => console.log(`[WS] Chi tiết connected: meter_id=${selectedMeter.meter_id}`);

    socket.onmessage = (event) => {
      const newRows = JSON.parse(event.data);

      // ── Phần 1: Cập nhật bảng chi tiết (tầng 2) ──────────────────────────
      const prev = detailRowsRef.current;
      if (prev.length === 0) {
        setDetailRows(newRows);
      } else {
        const currentMap = {};
        prev.forEach(row => { currentMap[row.parameter_name] = row; });
        newRows.forEach(newRow => {
          currentMap[newRow.parameter_name] = currentMap[newRow.parameter_name]
            ? { ...currentMap[newRow.parameter_name], value: newRow.value, timestamp: newRow.timestamp }
            : newRow;
        });
        const existingNames = prev.map(r => r.parameter_name);
        const newNames = Object.keys(currentMap).filter(n => !existingNames.includes(n));
        setDetailRows([...prev.map(r => currentMap[r.parameter_name]), ...newNames.map(n => currentMap[n])]);
      }

      // ── Phần 2: Cập nhật lịch sử + chart (tầng 3) ───────────────────────
      // Chỉ chạy khi: đang xem tầng 3 (selectedRegisterRef.current != null)
      //               VÀ đang xem hôm nay (filterDateRef.current == null)
      const currentReg = selectedRegisterRef.current;
      if (!currentReg || filterDateRef.current !== null) return;

      // Tìm register đang xem trong data vừa nhận
      // So sánh theo register_address (số) — chính xác hơn parameter_name (chuỗi)
      const matchingReg = newRows.find(r => String(r.register) === String(currentReg.register_address));
      if (!matchingReg) return;

      // ── FIX thứ tự vẽ chart ─────────────────────────────────────────────
      // Record cũ replay sau khi có mạng lại sẽ mang timestamp QUÁ KHỨ.
      //   - Chặn record không thuộc NGÀY HÔM NAY (vd outage qua ngày khác).
      //   - KHÔNG append cuối: chèn rồi sort theo timestamp + dedupe
      //     → chart vẽ đúng vị trí thời gian, không vọt lên ở mép phải.
      const tsMs = new Date(matchingReg.timestamp).getTime();
      if (!Number.isFinite(tsMs) || !dayjs(tsMs).isSame(dayjs(), "day")) return;

      // Build history row cùng format với API trả về
      const historyRow = {
        received_at:      matchingReg.timestamp,   // ISO string từ worker
        register_address: matchingReg.register,
        register_name:    matchingReg.parameter_name,
        value:            matchingReg.value,
        unit:             matchingReg.unit,
      };

      setHistoryRows(prev => {
        const map = new Map(prev.map(r => [r.received_at, r]));  // dedupe theo timestamp
        map.set(historyRow.received_at, historyRow);
        return [...map.values()].sort(
          (a, b) => new Date(a.received_at) - new Date(b.received_at)
        );
      });
    };

    socket.onclose = (e) => console.warn("[WS] Chi tiết closed:", e.code);
    socket.onerror = e => console.error("[WS] Chi tiết error:", e);
    return () => socket.close();
  }, [selectedMeter]);  // ← chỉ restart khi đổi meter, KHÔNG restart khi đổi register


  // EFFECT 4 đã được hợp nhất vào EFFECT 3 — xem comment bên trên


  // ── Hàm fetch lịch sử — dùng chung cho mọi trường hợp ──
  const fetchHistory = async (register_name, meter_id, date) => {
    setLoadingHistory(true);
    setHistoryRows([]);

    let url = `/solardb/get-register-history/?meter_id=${meter_id}&register_name=${encodeURIComponent(register_name)}`;
    if (date) url += `&date=${date}`;

    try {
      const data = await getData(url);
      // API trả về đã sort theo timestamp, nhưng sort thêm lần nữa cho chắc
      const sorted = (data || [])
        .slice()
        .sort((a, b) => new Date(a.received_at) - new Date(b.received_at));
      setHistoryRows(sorted);
    } catch (err) {
      console.error("Fetch lịch sử error:", err);
    } finally {
      setLoadingHistory(false);
    }
  };


  // ── Hàm chuyển ngày ──
  const goToDay = (dayjsObj) => {
    if (dayjsObj.isAfter(dayjs(), 'day')) return;

    const isToday = dayjsObj.isSame(dayjs(), 'day');

    if (isToday) {
      setFilterDate(null);
      fetchHistory(selectedRegister.register_name, selectedMeter.meter_id, null);
    } else {
      setFilterDate(dayjsObj);
      fetchHistory(selectedRegister.register_name, selectedMeter.meter_id, dayjsObj.format("YYYY-MM-DD"));
    }
  };


  // ── Hàm click dòng meter → mở bảng chi tiết ──
  const handleRowClick = async (meter_id, meter_name) => {
    setLoadingDetail(true);
    setDetailRows([]);
    setSelectedMeter({ meter_id, meter_name });
    try {
      const data = await getData(`/solardb/get-meter-registers/${meter_id}/`);
      if (!data) throw new Error("Fetch chi tiết thất bại");
      setDetailRows(data);
    } catch (err) {
      console.error("Fetch chi tiết error:", err);
    } finally {
      setLoadingDetail(false);
    }
  };


  // ── Hàm click thanh ghi → mở bảng lịch sử ──
  // register_address được lấy từ field "register" trong detailRows (API trả về)
  const handleRegisterClick = async (register_name, register_address) => {
    setFilterDate(null);
    setSelectedRegister({ register_name, register_address });
    await fetchHistory(register_name, selectedMeter.meter_id, null);
  };


  // ============================================================================================
  // RENDER tầng 3 — Lịch sử + Chart + Filter 1 ngày
  if (selectedRegister && selectedMeter) {

    // Formatter dùng chung cho XAxis + Brush: epoch ms → "HH:MM" (local timezone)
    const hhmm = (ms) => {
      const d = new Date(ms), p = (n) => String(n).padStart(2, "0");
      return `${p(d.getHours())}:${p(d.getMinutes())}`;
    };

    // chartData: dùng timestamp dạng SỐ (epoch ms) cho trục X kiểu thời gian,
    // và sort tăng dần → line nối đúng thứ tự thời gian dù record cũ replay về sau.
    const chartData = historyRows
      .map(row => ({
        ts:    new Date(row.received_at).getTime(),  // epoch ms
        value: parseFloat(row.value) || 0,
      }))
      .filter(d => Number.isFinite(d.ts))
      .sort((a, b) => a.ts - b.ts);

    const viewingDateLabel = filterDate
      ? filterDate.format("DD/MM/YYYY")
      : `${dayjs().format("DD/MM/YYYY")} (Today - Realtime)`;

    const currentDay = filterDate ?? dayjs();
    const isToday    = currentDay.isSame(dayjs(), 'day');

    const historyColumns = [
      { key: "received_at",      label: "Last Update"   },
      { key: "register_address", label: "Register Addr" },
      { key: "register_name",    label: "Register Name" },
      { key: "value",            label: "Value"         },
      { key: "unit",             label: "Unit"          },
    ];

    return (
      <Box>
        {/* Nút quay lại */}
        <Button variant="outlined"
          onClick={() => { setSelectedRegister(null); setHistoryRows([]); setFilterDate(null); }}
          sx={{ mb: 2, color: theme.palette.text.header_option, borderColor: theme.palette.text.header_option }}>
          ← Return Register List
        </Button>

        {/* Tiêu đề */}
        <Typography sx={{ color: theme.palette.text.header_option, mb: 2 }}>
          History of: <strong>{selectedRegister.register_name}</strong>
          {" "}— Meter: <strong>{selectedMeter.meter_name}</strong>
          {" "}<span style={{ color: "#aaa", fontSize: 13 }}>({historyRows.length} records)</span>
        </Typography>

        {/* ── FILTER BAR ── */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3, flexWrap: "wrap" }}>

          <Button variant="outlined" size="small"
            onClick={() => goToDay(currentDay.subtract(1, 'day'))}
            sx={{ color: theme.palette.text.header_option, borderColor: theme.palette.text.header_option, minWidth: 36 }}>
            ◄
          </Button>

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="Select Date"
              value={filterDate ?? dayjs()}
              maxDate={dayjs()}
              onChange={(newVal) => {
                if (!newVal) return;
                goToDay(newVal);
              }}
              slotProps={{
                textField: {
                  size: "small",
                  sx: { width: 160, input: { color: "white" }, label: { color: "#aaa" } }
                }
              }}
            />
          </LocalizationProvider>

          <Button variant="outlined" size="small"
            onClick={() => goToDay(currentDay.add(1, 'day'))}
            disabled={isToday}
            sx={{
              color: isToday ? "#555" : theme.palette.text.header_option,
              borderColor: isToday ? "#555" : theme.palette.text.header_option,
              minWidth: 36,
            }}>
            ►
          </Button>

          {!isToday && (
            <Button variant="outlined" size="small"
              onClick={() => goToDay(dayjs())}
              sx={{ color: "#aaa", borderColor: "#aaa" }}>
              Today
            </Button>
          )}

          <Typography sx={{ color: "#aaa", fontSize: 13, ml: 1 }}>
            Viewing: <strong style={{ color: theme.palette.text.header_option }}>{viewingDateLabel}</strong>
          </Typography>

        </Box>

        {loadingHistory ? (
          <Typography sx={{ color: "gray" }}>Loading history...</Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>

            {/* ── CHART ── */}
            <Box sx={{ backgroundColor: theme.palette.table.background_odd, borderRadius: 2, p: 2 }}>
              <Typography sx={{ color: theme.palette.text.header_option, mb: 1, fontSize: 14 }}>
                Value over time — {viewingDateLabel}
              </Typography>

              {historyRows.length === 0 ? (
                <Typography sx={{ color: "#aaa", textAlign: "center", py: 4 }}>
                  No data for this day
                </Typography>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />

                    {/* Trục X kiểu thời gian (số) → điểm rơi đúng vị trí timestamp,
                        record cũ replay nằm đúng khe quá khứ thay vì vọt ở mép phải */}
                    <XAxis
                      dataKey="ts"
                      type="number"
                      scale="time"
                      domain={["dataMin", "dataMax"]}
                      tickFormatter={hhmm}
                      tick={{ fill: "#aaa", fontSize: 11 }}
                      tickCount={8}
                      angle={-30}
                      textAnchor="end"
                      height={45}
                    />

                    <YAxis tick={{ fill: "#aaa", fontSize: 11 }} />

                    <Tooltip
                      contentStyle={{ backgroundColor: "#1b1b1b", border: "1px solid #555", color: "#eee" }}
                      labelStyle={{ color: "#aaa" }}
                      labelFormatter={(ms) => {
                        const d = new Date(ms), p = (n) => String(n).padStart(2, "0");
                        return `🕐 ${p(d.getDate())}/${p(d.getMonth()+1)} `
                             + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
                      }}
                      formatter={(value) => [value, selectedRegister.register_name]}
                    />

                    {chartData.length > 20 && (
                      <Brush
                        dataKey="ts"
                        height={20}
                        stroke={theme.palette.text.header_option}
                        fill="#1b1b1b"
                        travellerWidth={8}
                        tickFormatter={hhmm}
                      />
                    )}

                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={theme.palette.text.header_option}
                      strokeWidth={2}
                      dot={chartData.length < 50}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Box>

            {/* ── BẢNG LỊCH SỬ — hiển thị mới nhất ở trên ── */}
            <TableContainer component={Paper}
              sx={{
                maxHeight: 350, overflow: "auto",
                backgroundColor: theme.palette.table.background_odd,
                '&:hover::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.background.head_box },
              }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    {historyColumns.map(col => (
                      <TableCell key={col.key} align="center"
                        sx={{ backgroundColor: theme.palette.text.header_option, color: "white", minWidth: 150 }}>
                        {col.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {historyRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ color: "#aaa", py: 4 }}>
                        No data for this day
                      </TableCell>
                    </TableRow>
                  ) : (
                    [...historyRows].reverse().map((row, i) => (
                      <TableRow key={i}>
                        {historyColumns.map(col => (
                          <TableCell key={col.key} align="center"
                            sx={{
                              color: theme.palette.table.text,
                              backgroundColor: i%2===0 ? theme.palette.table.background_odd : theme.palette.table.background_even,
                            }}>
                            {(col.key === "timestamp" || col.key === "received_at")
                          ? formatTs(row[col.key])
                          : (row[col.key] ?? "--")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

          </Box>
        )}
      </Box>
    );
  }


  // ── RENDER tầng 2: Bảng chi tiết thanh ghi ──
  if (selectedMeter) {
    const detailColumns = [
      { key: "timestamp",      label: "Timestamp"      },
      { key: "parameter_name", label: "Parameter Name" },
      { key: "register",       label: "Register"       },
      { key: "value",          label: "Value"          },
      { key: "unit",           label: "Unit"           },
    ];

    return (
      <Box>
        <Button variant="outlined"
          onClick={() => { setSelectedMeter(null); setDetailRows([]); }}
          sx={{ mb: 2, color: theme.palette.text.header_option, borderColor: theme.palette.text.header_option }}>
          ← Return Summary List
        </Button>

        <Typography sx={{ color: theme.palette.text.header_option, mb: 1 }}>
          Register of: <strong>{selectedMeter.meter_name}</strong>
          <span style={{ color: "#aaa", fontSize: 13, marginLeft: 16 }}>
            — Click a line to see history
          </span>
        </Typography>

        {loadingDetail ? (
          <Typography sx={{ color: "gray" }}>Loading data....</Typography>
        ) : (
          <TableContainer component={Paper}
            sx={{
              maxHeight: 500, overflow: "auto",
              backgroundColor: theme.palette.table.background_odd,
              '&:hover::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.background.head_box },
            }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  {detailColumns.map(col => (
                    <TableCell key={col.key} align="center"
                      sx={{ backgroundColor: theme.palette.text.header_option, color: "white", minWidth: 150 }}>
                      {col.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {detailRows.map((row, i) => (
                  <TableRow key={i}
                    // Đây là số nguyên, dùng làm WS URL và group key
                    onClick={() => handleRegisterClick(row.parameter_name, row.register)}
                    sx={{ cursor: "pointer", "&:hover": { filter: "brightness(1.7)" } }}>
                    {detailColumns.map(col => (
                      <TableCell key={col.key} align="center"
                        sx={{
                          color: theme.palette.table.text,
                          backgroundColor: i%2===0 ? theme.palette.table.background_odd : theme.palette.table.background_even,
                        }}>
                        {(col.key === "timestamp" || col.key === "received_at")
                          ? formatTs(row[col.key])
                          : (row[col.key] ?? "--")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    );
  }


  // ── RENDER tầng 1: Bảng tổng quát ──
  const overviewCols = [
    { key: "site_name",         label: "Site Name"         },
    { key: "name",              label: "Meter Name"        },
    { key: "device_model",      label: "Device Model"      },
    { key: "meter_id",          label: "Meter ID"          },
    { key: "attribute",         label: "Attribute"         },
    { key: "status",            label: "Status"            },
    { key: "voltage_l1",        label: "Voltage L1"        },
    { key: "frequency_l1",      label: "Frequency L1"      },
    { key: "current_l1",        label: "Current L1"        },
    { key: "current_l1_dmd",    label: "Current L1 Dmd"    },
    { key: "apparent_power_l1", label: "Apparent Power L1" },
    { key: "real_power",        label: "Real Power"        },
    { key: "timestamp",         label: "Last Update"       },
  ];

  return (
    <TableContainer component={Paper}
      sx={{ maxHeight: 500, overflow: "auto", '&:hover::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.background.head_box } }}>
      <Table stickyHeader sx={{ minWidth: "1300px" }}>
        <TableHead>
          <TableRow>
            {overviewCols.map(col => (
              <TableCell key={col.key} align="center"
                sx={{ backgroundColor: theme.palette.text.header_option, color: "white", minWidth: 120, zIndex: 1 }}>
                {col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}
              onClick={() => handleRowClick(row.meter_id, row.name)}
              sx={{ cursor: "pointer", "&:hover": { filter: "brightness(1.7)" } }}>
              {overviewCols.map(col => (
                <TableCell key={col.key} align="center"
                  sx={{ color: theme.palette.table.text, backgroundColor: i%2===0 ? theme.palette.table.background_odd : theme.palette.table.background_even }}>
                  {(col.key === "timestamp" || col.key === "received_at")
                    ? formatTs(row[col.key])
                    : row[col.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};


//======================================================================================================================
//================================================ WEATHER STATION =====================================================
//======================================================================================================================

const WeatherTable = ({ siteId }) => {
  const theme = useTheme();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const response = await fetch(`http://localhost:8000/solardb/get-latest-weather-station-records/?site_id=${siteId}`);
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();
        setRows(data.map(item => ({
          name: item.weather_station_name ?? "--", state: item.state ?? "--",
          poa: item.poa ?? "--", poa2: item.poa2 ?? "--", ghi: item.ghi ?? "--",
          ambient_temp: item.ambient_temp ?? "--", module_temp_1: item.module_temp ?? "--",
          module_temp_2: item.module_temp_2 ?? "--", module_temp_3: item.module_temp_3 ?? "--",
          humidity: item.humidity ?? "--", wind_direction: item.wind_direction ?? "--",
          wind_speed: item.wind_speed ?? "--", rainfall: item.rainfall ?? "--",
        })));
      } catch (error) { console.error("Fetch error:", error); }
    };
    fetchWeather();
  }, [siteId]);

  useEffect(() => {
    const socket = new WebSocket(`ws://localhost:8000/ws/weather_station/${siteId}/`);
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setRows(data.map(item => ({
        name: item.weather_station_name ?? "--", state: item.state ?? "--",
        poa: item.poa ?? "--", poa2: item.poa2 ?? "--", ghi: item.ghi ?? "--",
        ambient_temp: item.ambient_temp ?? "--", module_temp_1: item.module_temp ?? "--",
        module_temp_2: item.module_temp_2 ?? "--", module_temp_3: item.module_temp_2 ?? "--",
        humidity: item.humidity ?? "--", wind_direction: item.wind_direction ?? "--",
        wind_speed: item.wind_speed ?? "--", rainfall: item.rainfall ?? "--",
      })));
    };
    socket.onerror = (e) => console.error("WS weather error:", e);
    return () => socket.close();
  }, [siteId]);

  const weatherKeys   = ["name","state","poa","poa2","ghi","ambient_temp","module_temp_1","module_temp_2","module_temp_3","humidity","wind_direction","wind_speed","rainfall"];
  const weatherLabels = ["Weather Station","State","POA(W/m²)","POA2","GHI","Ambient Temp","Module Temp.1","Module Temp.2","Module Temp.3","Humidity (%)","Wind Dir","Wind Speed","Rainfall (mm)"];

  return (
    <TableContainer component={Paper} sx={{ maxHeight: 500, overflow: "auto" }}>
      <Table stickyHeader sx={{ minWidth: "1300px" }}>
        <TableHead>
          <TableRow>
            {weatherLabels.map(label => (
              <TableCell key={label} sx={{ backgroundColor: theme.palette.text.header_option, color: "white", minWidth: 130 }}>{label}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {weatherKeys.map(key => (
                <TableCell key={key} sx={{ color: theme.palette.table.text, backgroundColor: i%2===0 ? theme.palette.table.background_odd : theme.palette.table.background_even }}>{row[key]}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};


//======================================================================================================================
//==================================================== MAIN ============================================================
//======================================================================================================================

export default function DeviceList() {
  const theme = useTheme();
  const buttons = ["INVERTER", "METER", "WEATHER STATION"];
  const [selected, setSelected] = useState("INVERTER");
  const [searchParams] = useSearchParams();
  const siteId = searchParams.get("siteId");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", padding: "20px", gap: "5", width: "100%", height: "100%" }}>
      <Box sx={{ display: "flex", gap: 2, flex: 0.2, marginBottom: "10px" }}>
        {buttons.map((label) => (
          <Button key={label} variant="outlined" onClick={() => setSelected(label)}
            sx={{
              color: theme.palette.text.header_option, borderColor: theme.palette.text.header_option,
              backgroundColor: selected === label ? theme.palette.background.option : "transparent",
              "&:hover": { backgroundColor: "#d1cfcf" },
            }}>
            {label}
          </Button>
        ))}
      </Box>
      <Box sx={{ flex: 3 }}>
        {selected === "INVERTER" ? <InverterTable siteId={siteId} /> :
         selected === "METER"    ? <MeterTable    siteId={siteId} /> :
                                   <WeatherTable  siteId={siteId} />}
      </Box>
    </Box>
  );
}
