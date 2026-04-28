import { Button, Stack } from "@mui/material";
import MyBarChart from "../ChartComponents/BarChart";
import MyLineChart from "../ChartComponents/LineChart2";
import InverterRanking from "../DataComponents/InverterRanking";
import { useState, useEffect } from "react";
import { Bar } from "react-chartjs-2";
import axios from "axios";
import { DatePicker } from "@mui/x-date-pickers/DatePicker"; // table to choose calendar
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"; // support datepicker to know: which lib?, format data?...
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs"; // “bộ chuyển đổi” để MUI hiểu được thư viện Day.js mà bạn đang dùng.
import dayjs from "dayjs"; // lib datetime using
import MyButton from "../InteractComponent/myButton";
import MyCalendar from "../InteractComponent/myCalendar";
import { Box, maxHeight, sizeHeight } from "@mui/system";
import { ThemeContext } from "@emotion/react";
import { useTheme } from "@mui/material/styles";
import PowerIcon from "@mui/icons-material/Power";
import { DiBackbone } from "react-icons/di";
import { PiPlugChargingBold } from "react-icons/pi";
import { GiCharging } from "react-icons/gi";
import LocationPinIcon from "@mui/icons-material/LocationPin";
import Typography from "@mui/material/Typography";
import { Link } from "react-router-dom";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
} from "@mui/material";

//======================================== INVERTER SITE ===================================================
const InverterTable = ({ siteId }) => {
  // Khởi Tạo (Initialization)
  const theme = useTheme();
  const [rows, setRows] = useState([]);

  //Thiết Lập Side Effect (useEffect)
  //UseEffect này có chức năng đảm bảo rằng ngay khi người dùng mở trang DeviceList (cho một siteId nào đó), 
  //bảng sẽ được lấp đầy dữ liệu Inverter mới nhất bằng cách gọi một API HTTP một lần duy nhất.
  useEffect(() => {
    const fetchInverter = async () => {
      try {
        // Gọi API (HTTP Request)
        // const response = await fetch(`http://localhost:8000/solardb/get-latest-inverter-records/?site_id=${siteId}`);
        const response = await fetch(`http://localhost:8000/solardb/get-all-inverter-records/?site_id=${siteId}`);

        if (response.status === 404) {
            throw new Error("API Endpoint not found (404). Check URL or server routes.");// Lỗi 404: Không tìm thấy tài nguyên (API endpoint có thể sai)
        } 
        else if (response.status === 400) {
            const errorData = await response.json(); 
            throw new Error(`Invalid request (400). Server message: ${errorData.error || "Unknown error"}`);
        } 
        else if (response.status >= 500) {
            throw new Error(`Server error occurred (${response.status}). Please check the backend logs.`);// Lỗi 5xx: Lỗi Server nội bộ
        } 
        else if (!response.ok) {
            throw new Error(`Request failed with status code ${response.status}. Access denied or client error.`);// Bắt các lỗi 4xx khác (ví dụ: 401, 403)
        }
        const data = await response.json();
        // ánh xạ (mapping) dữ liệu thô nhận được từ backend thành một định dạng mới, thân thiện với bảng (table).
        const normalized = data.map(item => ({
          // toán tử Nullish Coalescing (??) để kiểm tra: 
          // nếu trường dữ liệu từ backend (item.inverter_name) là null hoặc undefined, 
          // nó sẽ thay thế bằng giá trị mặc định là "--".
          name: item.inverter_name ?? "--",
          system_diagram: item.system_diagram ?? "--",
          state: item.state ?? "--",
          meter_read_total_energy: item.meter_read_total_energy ?? "--",
          active_power: item.active_power ?? "--",
          input_power: item.input_power ?? "--",
          efficiency: item.efficiency ?? "--",
          production_today: item.production_today ?? "--",
          internal_temp: item.internal_temp ?? "--",
          down_string_count: item.down_string_count ?? "--",   // field này backend chưa trả, nên sẽ thành --
          yield_today: item.yield_today ?? "--",   // field này backend chưa trả, nên sẽ thành --
        }));
        //React sẽ chạy lại toàn bộ hàm component <InverterTable /> (quá trình re-render). 
        // Trong quá trình chạy lại này, biến rows lúc này đã mang dữ liệu mới (normalized).
        setRows(normalized);

      } catch (error) {
        console.error("Fetch error:", error);
      }
    };

    fetchInverter();
  }, [siteId]);

  //Khối useEffect thứ hai có vai trò là nguồn cập nhật dữ liệu liên tục và tức thời (real-time) cho bảng Inverter.
  // lệnh useEffect này trong React có nhiệm vụ chính là thiết lập kết nối WebSocket
  useEffect(() => { 
    const socket = new WebSocket(`ws://localhost:8000/ws/inverter/${siteId}/`);
    socket.onopen = () => {
        console.log(`WebSocket connected for siteId: ${siteId}`);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Chuẩn hóa field để khớp với table, field không có thì để "--"
      const normalized = data.map(item => ({
        name: item.inverter_name ?? "--",
        system_diagram: item.system_diagram ?? "--",
        state: item.state ?? "--",
        meter_read_total_energy: item.meter_read_total_energy ?? "--",
        active_power: item.active_power ?? "--",
        input_power: item.input_power ?? "--",
        efficiency: item.efficiency ?? "--",
        production_today: item.production_today ?? "--",
        internal_temp: item.internal_temp ?? "--",
        down_string_count: item.down_string_count ?? "--",   // field này backend chưa trả, nên sẽ thành --
        yield_today: item.yield_today ?? "--",   // field này backend chưa trả, nên sẽ thành --
      }));
      setRows(normalized);
    };

    socket.onerror = (error) => {
        console.error("WebSocket error is:", error);
    };

    return () => socket.close();
  }, [siteId]);

  return (
    <TableContainer
      component={Paper}
      sx={{
        maxHeight: 500,
        backgroundColor: "#1b1b1b",
        overflow: "auto",

        '&::-webkit-scrollbar': {
          width: '8px',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 'transparent',
          borderRadius: '4px',
        },

        '&:hover::-webkit-scrollbar-thumb': {
          backgroundColor: theme.palette.background.head_box,
        },
        '&:hover::-webkit-scrollbar-track': {
          backgroundColor: 'transparent',
        },
      }}
    >
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell
              sx={{
                position: "sticky",
                left: 0,
                zIndex: 2,
                backgroundColor: theme.palette.text.header_option,
                color: "white",
                minWidth: 180,
              }}
            >
              Inverter Name
            </TableCell>
            <TableCell
              sx={{
                position: "sticky",
                left: 180,
                zIndex: 2,
                backgroundColor: theme.palette.text.header_option,
                color: "white",
                minWidth: 150,
              }}
            >
              Syst. Diag.
            </TableCell>

            {[
              "State",
              "Meter-read",
              "Active Power",
              "Input Power",
              "Efficiency",
              "Production Today",
              "Internal Temp",
              "Down String",
              "Yield Today",
            ].map((col) => (
              <TableCell
                key={col}
                align="right"
                sx={{
                  minWidth: 120,
                  backgroundColor: theme.palette.text.header_option,
                  color: "white",
                  zIndex: 1,
                }}
              >
                {col}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        
        <TableBody>
          {rows.map((row, i) => (
            <TableRow
              key={i}
              sx={{
                backgroundColor: i % 2 === 0 ? "#1b1b1b" : "#2a2a2a",
              }}
            >
              <TableCell
                sx={{
                  position: "sticky",
                  left: 0,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                  color: theme.palette.table.text,
                  minWidth: 180,
                  zIndex: 1,
                }}
              >
                {row.name}
              </TableCell>
              <TableCell
                sx={{
                  position: "sticky",
                  left: 180,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                  color: theme.palette.table.text,
                  minWidth: 150,
                  zIndex: 1,
                }}
              >
                {row.system_diagram}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  color: theme.palette.table.text,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                  minWidth: 120,
                }}
              >
                {row.state}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  color: theme.palette.table.text,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                  minWidth: 120,
                }}
              >
                {row.meter_read_total_energy}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  color: theme.palette.table.text,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                  minWidth: 120,
                }}
              >
                {row.active_power}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  color: theme.palette.table.text,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                  minWidth: 120,
                }}
              >
                {row.input_power}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  color: theme.palette.table.text,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                  minWidth: 120,
                }}
              >
                {row.efficiency}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  color: theme.palette.table.text,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                  minWidth: 120,
                }}
              >
                {row.production_today}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  color: theme.palette.table.text,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                  minWidth: 120,
                }}
              >
                {row.internal_temp}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  color: theme.palette.table.text,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                  minWidth: 120,
                }}
              >
                {row.down_string_count}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  color: theme.palette.table.text,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                  minWidth: 120,
                }}
              >
                {row.yield_today}
              </TableCell>
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

  // Dữ liệu cho bảng TỔNG QUÁT (danh sách các meter)
  const [rows, setRows] = useState([]);

  // Meter đang được chọn để xem chi tiết
  // null = đang ở bảng tổng quát | { meter_id, meter_name } = đang xem chi tiết
  const [selectedMeter, setSelectedMeter] = useState(null);

  // Dữ liệu cho bảng CHI TIẾT (các dòng thanh ghi của meter đang chọn)
  const [detailRows, setDetailRows] = useState([]);

  // Trạng thái loading khi đang fetch chi tiết
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ─────────────────────────────────────────────────
  // EFFECT 1: Fetch dữ liệu tổng quát lần đầu khi mở trang
  // Chạy 1 lần khi component mount hoặc khi siteId thay đổi
  // ─────────────────────────────────────────────────
  useEffect(() => {
    const fetchMeter = async () => {
      try {
        // Gọi API lấy danh sách tất cả meter của site này
        const response = await fetch(
          `http://localhost:8000/solardb/get-latest-meter-records/?site_id=${siteId}`
        );
        if (!response.ok) throw new Error("Network error");
        const data = await response.json();

        // Chuẩn hóa field, field nào thiếu thì để "--"
        const normalized = data.map(item => ({
          meter_id:          item.meter_id          ?? "--",
          name:              item.meter_name         ?? "--",
          device_model:      item.device_model       ?? "--",
          attribute:         item.attribute          ?? "--",
          status:            item.status             ?? "--",
          voltage_l1:        item.voltage_l1         ?? "--",
          current_l1:        item.current_l1         ?? "--",
          current_l1_dmd:    item.current_l1_dmd     ?? "--",
          frequency_l1:      item.frequency_l1       ?? "--",
          apparent_power_l1: item.apparent_power_l1  ?? "--",
          real_power:        item.real_power          ?? "--",
          timestamp:         item.timestamp           ?? "--",
        }));
        setRows(normalized);
      } catch (error) {
        console.error("Fetch meter list error:", error);
      }
    };
    fetchMeter();
  }, [siteId]);

  // ─────────────────────────────────────────────────
  // EFFECT 2: WebSocket cập nhật real-time bảng TỔNG QUÁT
  // Khi ESP32 gửi data mới → signal → WS → bảng tự cập nhật
  // Đây là WS đã có sẵn, giữ nguyên logic
  // ─────────────────────────────────────────────────
  useEffect(() => {
    const socket = new WebSocket(`ws://localhost:8000/ws/meter/${siteId}/`);

    socket.onopen = () => {
      console.log(`WS bảng tổng quát connected, siteId: ${siteId}`);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Chuẩn hóa và cập nhật bảng tổng quát
      const normalized = data.map(item => ({
        meter_id:          item.meter_id          ?? "--",
        name:              item.meter_name         ?? "--",
        device_model:      item.device_model       ?? "--",
        attribute:         item.attribute          ?? "--",
        status:            item.status             ?? "--",
        voltage_l1:        item.voltage_l1         ?? "--",
        current_l1:        item.current_l1         ?? "--",
        current_l1_dmd:    item.current_l1_dmd     ?? "--",
        frequency_l1:      item.frequency_l1       ?? "--",
        apparent_power_l1: item.apparent_power_l1  ?? "--",
        real_power:        item.real_power          ?? "--",
        timestamp:         item.timestamp           ?? "--",
      }));
      setRows(normalized);
    };

    socket.onerror = (e) => console.error("WS tổng quát error:", e);

    // Cleanup: đóng WS khi component unmount hoặc siteId thay đổi
    return () => socket.close();
  }, [siteId]);

  // ─────────────────────────────────────────────────
// EFFECT 3: WS bảng chi tiết — cố định dòng, chỉ update value
// ─────────────────────────────────────────────────
useEffect(() => {
    if (!selectedMeter) return;

    const socket = new WebSocket(
        `ws://localhost:8000/ws/meter_register/${selectedMeter.meter_id}/`
    );

    socket.onopen = () => {
        console.log(`WS chi tiết connected: meter_id=${selectedMeter.meter_id}`);
    };

    socket.onmessage = (event) => {
        const newRows = JSON.parse(event.data);

        setDetailRows(prev => {
            // Nếu chưa có data (prev rỗng) → dùng thẳng newRows làm nền
            if (prev.length === 0) return newRows;

            // Tạo map từ danh sách hiện tại, key = parameter_name
            const currentMap = {};
            prev.forEach(row => {
                currentMap[row.parameter_name] = row;
            });

            newRows.forEach(newRow => {
                if (currentMap[newRow.parameter_name]) {
                    // Thanh ghi đã có → CHỈ cập nhật value + timestamp
                    // Giữ nguyên: register, unit, vị trí dòng
                    currentMap[newRow.parameter_name] = {
                        ...currentMap[newRow.parameter_name], // giữ các field cũ
                        value:     newRow.value,              // ← chỉ đổi value
                        timestamp: newRow.timestamp,          // ← và timestamp
                    };
                } else {
                    // Thanh ghi MỚI (thiết bị gửi thêm thanh ghi chưa từng có)
                    // → thêm vào cuối bảng
                    currentMap[newRow.parameter_name] = newRow;
                }
            });

            // Giữ nguyên thứ tự dòng cũ
            const existingNames = prev.map(r => r.parameter_name);
            // Tìm các tên thanh ghi mới chưa có trong bảng
            const newNames = Object.keys(currentMap).filter(
                name => !existingNames.includes(name)
            );

            return [
                // Dòng cũ — đã được update value mới
                ...prev.map(row => currentMap[row.parameter_name]),
                // Dòng mới — thanh ghi mới từ thiết bị, thêm vào cuối
                ...newNames.map(name => currentMap[name]),
            ];
        });
    };

    socket.onerror = e => console.error("WS chi tiết error:", e);

    // Cleanup: đóng WS khi quay lại hoặc đổi meter
    return () => socket.close();

}, [selectedMeter]);

  // ─────────────────────────────────────────────────
  // HÀM: Xử lý khi click vào 1 dòng trong bảng tổng quát
  // ─────────────────────────────────────────────────
  const handleRowClick = async (meter_id, meter_name) => {
    setLoadingDetail(true);
    setDetailRows([]); // xóa data cũ trước khi load mới

    try {
        // Bước 1: fetch lịch sử batch mới nhất từ API trước
        const res  = await fetch(
            `http://localhost:8000/solardb/get-meter-registers/${meter_id}/`
        );
        const data = await res.json();

        // Bước 2: lưu data vào state
        setDetailRows(data);

        // Bước 3: SAU KHI có data rồi mới set selectedMeter
        // → EFFECT 3 lúc này mới chạy → mở WS
        // → WS sẽ update tiếp trên nền data đã có sẵn
        setSelectedMeter({ meter_id, meter_name });

    } catch (err) {
        console.error("Fetch chi tiết error:", err);
    } finally {
        setLoadingDetail(false);
    }
};

  // ─────────────────────────────────────────────────
  // RENDER: Bảng CHI TIẾT (hiển thị khi đã chọn 1 meter)
  // ─────────────────────────────────────────────────
  if (selectedMeter) {
    // 5 cột cố định cho bảng chi tiết
    const detailColumns = [
      { key: "timestamp",      label: "Timestamp"       },
      { key: "parameter_name", label: "Parameter Name"  },
      { key: "register",       label: "Register"        },
      { key: "value",          label: "Value"           },
      { key: "unit",           label: "Unit"            },
    ];

    return (
      <Box>
        {/* Nút quay lại → xóa selectedMeter → EFFECT 3 cleanup → đóng WS */}
        <Button
          variant="outlined"
          onClick={() => {
            setSelectedMeter(null); // → WS tự đóng nhờ cleanup trong EFFECT 3
            setDetailRows([]);      // xóa dữ liệu chi tiết
          }}
          sx={{
            mb: 2,
            color: theme.palette.text.header_option,
            borderColor: theme.palette.text.header_option,
          }}
        >
          ← Quay lại danh sách
        </Button>

        {/* Tiêu đề bảng chi tiết */}
        <Typography sx={{ color: theme.palette.text.header_option, mb: 1 }}>
          Thanh ghi của:{" "}
          <strong>{selectedMeter.meter_name}</strong>{" "}
          (ID: {selectedMeter.meter_id})
        </Typography>

        {/* Hiển thị loading hoặc bảng */}
        {loadingDetail ? (
          <Typography sx={{ color: "gray" }}>Đang tải dữ liệu...</Typography>
        ) : (
          <TableContainer
            component={Paper}
            sx={{
              maxHeight: 500,
              overflow: "auto",
              backgroundColor: theme.palette.table.background_odd,
              '&:hover::-webkit-scrollbar-thumb': {
                backgroundColor: theme.palette.background.head_box,
              },
            }}
          >
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  {/* Render 5 cột header */}
                  {detailColumns.map(col => (
                    <TableCell
                      key={col.key}
                      align="center"
                      sx={{
                        backgroundColor: theme.palette.text.header_option,
                        color: "white",
                        minWidth: 150,
                      }}
                    >
                      {col.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Render từng dòng thanh ghi */}
                {detailRows.map((row, i) => (
                  <TableRow key={i}>
                    {/* Render từng cell theo đúng key của cột */}
                    {detailColumns.map(col => (
                      <TableCell
                        key={col.key}
                        align="center"
                        sx={{
                          color: theme.palette.table.text,
                          // Xen kẽ màu nền cho dễ đọc
                          backgroundColor: i % 2 === 0
                            ? theme.palette.table.background_odd
                            : theme.palette.table.background_even,
                        }}
                      >
                        {/* Nếu không có dữ liệu thì hiển thị "--" */}
                        {row[col.key] ?? "--"}
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

  // ─────────────────────────────────────────────────
  // RENDER: Bảng TỔNG QUÁT (mặc định khi chưa chọn meter nào)
  // ─────────────────────────────────────────────────

  // Định nghĩa cột cho bảng tổng quát
  const overviewCols = [
    { key: "name",              label: "Meter Name"        },
    { key: "device_model",      label: "Device Model"      },
    { key: "meter_id",          label: "Meter ID"          },
    { key: "attribute",         label: "Attribute"         },
    { key: "status",            label: "Status"            },
    { key: "voltage_l1",        label: "Voltage L1"        },
    { key: "frequency_l1",      label: "Frequency L1"      },
    { key: "current_l1",        label: "Current L1"        },
    { key: "current_l1_dmd",    label: "Current L1 Dmd"   },
    { key: "apparent_power_l1", label: "Apparent Power L1" },
    { key: "real_power",        label: "Real Power"        },
    { key: "timestamp",         label: "Timestamp"         },
  ];

  return (
    <TableContainer
      component={Paper}
      sx={{
        maxHeight: 500,
        overflow: "auto",
        '&:hover::-webkit-scrollbar-thumb': {
          backgroundColor: theme.palette.background.head_box,
        },
      }}
    >
      <Table stickyHeader sx={{ minWidth: "1300px" }}>
        <TableHead>
          <TableRow>
            {overviewCols.map(col => (
              <TableCell
                key={col.key}
                align="center"
                sx={{
                  backgroundColor: theme.palette.text.header_option,
                  color: "white",
                  minWidth: 120,
                  zIndex: 1,
                }}
              >
                {col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow
              key={i}
              // ← THÊM: click vào dòng → gọi handleRowClick
              onClick={() => handleRowClick(row.meter_id, row.name)}
              sx={{
                cursor: "pointer",          // con trỏ dạng bàn tay khi hover
                "&:hover": {
                  filter: "brightness(1.4)", // sáng lên khi hover để người dùng biết có thể click
                },
              }}
            >
              {overviewCols.map(col => (
                <TableCell
                  key={col.key}
                  align="center"
                  sx={{
                    color: theme.palette.table.text,
                    backgroundColor: i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                  }}
                >
                  {row[col.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
//===========================================================================================================================



const WeatherTable = ({ siteId }) => {
  const theme = useTheme();
  const [rows, setRows] = useState([]);
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const response = await fetch(
          `http://localhost:8000/solardb/get-latest-weather-station-records/?site_id=${siteId}`
        );
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        const data = await response.json();
        // Chuẩn hóa field để khớp với table, field không có thì để "--"
        const normalized = data.map(item => ({
          name: item.weather_station_name ?? "--",
          state: item.state ?? "--",
          poa: item.poa ?? "--",
          poa2: item.poa2 ?? "--",   // field này backend chưa trả, nên sẽ thành "--"
          ghi: item.ghi ?? "--",
          ambient_temp: item.ambient_temp ?? "--",
          module_temp_1: item.module_temp ?? "--", // backend chỉ có module_temp -> bạn có thể map về module_temp_1
          module_temp_2: item.module_temp_2 ?? "--",
          module_temp_3: item.module_temp_3 ?? "--",
          humidity: item.humidity ?? "--",
          wind_direction: item.wind_direction ?? "--",
          wind_speed: item.wind_speed ?? "--",
          rainfall: item.rainfall ?? "--",
        }));
        setRows(normalized);
      } catch (error) {
        console.error("Fetch error:", error);
      }
    };

    fetchWeather();
  }, [siteId]);

  useEffect(() => {
    const socket = new WebSocket(`ws://localhost:8000/ws/weather_station/${siteId}/`);

    socket.onopen = () => {
        console.log(`WebSocket connected for siteId: ${siteId}`);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Chuẩn hóa field để khớp với table, field không có thì để "--"
      const normalized = data.map(item => ({
        name: item.weather_station_name ?? "--",
        state: item.state ?? "--",
        poa: item.poa ?? "--",
        poa2: item.poa2 ?? "--",
        ghi: item.ghi ?? "--",
        ambient_temp: item.ambient_temp ?? "--",
        module_temp_1: item.module_temp ?? "--",
        module_temp_2: item.module_temp_2 ?? "--",
        module_temp_3: item.module_temp_2 ?? "--",
        humidity: item.humidity ?? "--",
        wind_direction: item.wind_direction ?? "--",
        wind_speed: item.wind_speed ?? "--",
        rainfall: item.rainfall ?? "--",
      }));
      setRows(normalized);
    };

    socket.onerror = (error) => {
        console.error("WebSocket error:", error);
    };

    return () => socket.close();
  }, [siteId]);

  return (
    <TableContainer
      component={Paper}
      sx={{
        maxHeight: 500,
        overflow: "auto",
        '&::-webkit-scrollbar': {
          width: '8px',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 'transparent',
          borderRadius: '4px',
        },

        '&:hover::-webkit-scrollbar-thumb': {
          backgroundColor: theme.palette.background.head_box,
        },
        '&:hover::-webkit-scrollbar-track': {
          backgroundColor: 'transparent',
        }
      }}
    >
      <Table stickyHeader sx={{ minWidth: "1300px" }}>
        <TableHead>
          <TableRow>
            <TableCell
              sx={{
                position: "sticky",
                left: 0,
                zIndex: 2,
                backgroundColor: theme.palette.text.header_option,
                color: "white",
                minWidth: "150px",
              }}
            >
              Weather Station Name
            </TableCell>

            {[
              "State",
              "POA(W/m",
              "POA2",
              "GHI",
              "Ambient Temp",
              "Module Temp. 1",
              "Module Temp. 2",
              "Module Temp. 3",
              "Humidity (%)",
              "Wind Direction ",
              "Wind Speed (m/s)",
              "Rainfall (mm)",
            ].map((col) => (
              <TableCell
                key={col}
                align="right"
                sx={{
                  minWidth: 120,
                  zIndex: 1,
                  backgroundColor: theme.palette.text.header_option,
                  color: "white",
                }}
              >
                {col}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody
          sx={{
            overflow: "scroll",
          }}
        >
          {rows.map((row, i) => (
            <TableRow key={i}>
              <TableCell
                sx={{
                  position: "sticky",
                  left: 0,
                  color: theme.palette.table.text,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                  zIndex: 1,
                }}
              >
                {row.name}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  width: "100px",
                  color: theme.palette.table.text,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                }}
              >
                {row.state}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  width: "100px",
                  color: theme.palette.table.text,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                }}
              >
                {row.poa}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  width: "100px",
                  color: theme.palette.table.text,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                }}
              >
                {row.poa2}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  width: "100px",
                  color: theme.palette.table.text,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                }}
              >
                {row.ghi}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  width: "100px",
                  color: theme.palette.table.text,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                }}
              >
                {row.ambient_temp}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  width: "100px",
                  color: theme.palette.table.text,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                }}
              >
                {row.module_temp_1}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  width: "100px",
                  color: theme.palette.table.text,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                }}
              >
                {row.module_temp_2}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  width: "100px",
                  color: theme.palette.table.text,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                }}
              >
                {row.module_temp_3}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  width: "100px",
                  color: theme.palette.table.text,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                }}
              >
                {row.humidity}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  width: "100px",
                  color: theme.palette.table.text,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                }}
              >
                {row.wind_direction}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  width: "100px",
                  color: theme.palette.table.text,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                }}
              >
                {row.wind_speed}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  width: "100px",
                  color: theme.palette.table.text,
                  backgroundColor:
                    i % 2 === 0
                      ? theme.palette.table.background_odd
                      : theme.palette.table.background_even,
                }}
              >
                {row.rainfall}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default function DeviceList() {
  const theme = useTheme();
  const buttons = ["INVERTER", "METER", "WEATHER STATION"];
  const [selected, setSelected] = useState("INVERTER");

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        padding: "20px",
        gap: "5",
        width: "100%",
        height: "100%",
      }}
    >
      <Box
        sx={{
          display: "flex",
          gap: 2,
          flex: 0.2,
          marginBottom: "10px",
        }}
      >
        {buttons.map((label) => (
          <Button
            key={label}
            variant="outlined"
            onClick={() => setSelected(label)}
            sx={{
              color: theme.palette.text.header_option,
              borderColor: theme.palette.text.header_option,
              backgroundColor:
                selected === label
                  ? theme.palette.background.option
                  : "transparent",
              "&:hover": {
                backgroundColor: "#d1cfcf",
              },
            }}
          >
            {label}
          </Button>
        ))}
      </Box>

      <Box
        sx={{
          flex: 3,
        }}
      >
        {selected === "INVERTER" ? (
          <InverterTable siteId={1} />
        ) : selected === "METER" ? (
          <MeterTable siteId={1} />
        ) : (
          <WeatherTable siteId={1} />
        )}
      </Box>
    </Box>
  );
}
// {selected === "INVERTER" ? <InverterTable siteId={1} /> : selected === "METER" ? <MeterTable siteId={1} /> : <WeatherTable siteId={1} />}
// khi dua cau lenh len 1 dong.