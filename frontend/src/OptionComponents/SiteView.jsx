import { Button, Grid } from "@mui/material";
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
import { Box, sizeHeight } from "@mui/system";
import { ThemeContext } from "@emotion/react";
import { useTheme } from "@mui/material/styles";
import PowerIcon from "@mui/icons-material/Power";
import { DiBackbone } from "react-icons/di";
import { PiPlugChargingBold } from "react-icons/pi";
import { GiCharging } from "react-icons/gi";
import LocationPinIcon from "@mui/icons-material/LocationPin";
import Typography from "@mui/material/Typography";
import { Link } from "react-router-dom";
import HomeIcon from "@mui/icons-material/Home";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";

function Dashboard() {
  let date = Date();
  const [BarData, setBarData] = useState([]);
  const [dateCalendar, setDateCalendar] = useState(dayjs(date));

  const theme = useTheme();

  const path_bar = `http://localhost:8000/solardb/avr-data/`;
  const path_line = `http://localhost:8000/solardb/`;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const reponse = await axios.get(path_bar);
        setBarData(reponse.data);
      } catch (err) {
        console.error("LOI KHI GOI API: ", err);
      }
    };

    fetchData();

    const interval = setInterval(fetchData, 3000);

    return () => clearInterval(interval);
  }, []);

  // Status card component
  const StatusCard = ({ icon, title, count, status, detailLink, statusItems = [] }) => (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: "1",
        justifyContent: "center",
        alignItems: "center",
        padding: 2,
        borderRight: "1px solid rgba(255,255,255,0.1)",
        "&:last-child": {
          borderRight: "none"
        }
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        {icon}
        <Typography variant="body1" sx={{ color: "#fff", fontWeight: 500 }}>
          {title} ({count})
        </Typography>
        <Link
          to={detailLink}
          style={{
            textDecoration: "none",
            color: "#00bcd4",
            fontSize: "12px",
            marginLeft: "auto"
          }}
        >
          Details
        </Link>
      </Box>
      
      {status && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ 
            width: 8, 
            height: 8, 
            borderRadius: "50%", 
            backgroundColor: "#4caf50" 
          }} />
          <Typography variant="body2" sx={{ color: "#4caf50" }}>
            {status}
          </Typography>
        </Box>
      )}
      
      {statusItems.length > 0 && (
        <Box sx={{ display: "flex", gap: 2, mt: 1 }}>
          {statusItems.map((item, index) => (
            <Typography 
              key={index} 
              variant="body2" 
              sx={{ 
                color: "#ccc", 
                fontSize: "12px"
              }}
            >
              {item}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );

  // Metric display component
  const MetricDisplay = ({ label, value, unit, icon }) => (
    <Box sx={{ 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      padding: 1 
    }}>
      <Typography variant="body2" sx={{ 
        color: "#ccc", 
        fontSize: "12px", 
        mb: 0.5 
      }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ 
        color: "#fff", 
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: 0.5
      }}>
        {value} <span style={{ fontSize: "12px", color: "#ccc" }}>{unit}</span>
      </Typography>
    </Box>
  );

  return (
    <Box
      sx={{
        padding: "20px",
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        gap: 2,
        flexDirection: "column",
        backgroundColor: "black",
      }}
    >
      <Box
        sx={{
          overflow: "auto",
          width: "100%",
          height: "120px",
          flex: "1",
          backgroundColor: theme.palette.background.box,
          display: "flex",
          flexDirection: "row",
          boxShadow: '5px 5px 10px rgba(0,0,0,0.3)',
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
        {/* <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            flex: "1",
            justifyContent: "center",
            paddingLeft: "10px"
          }}
        >
          <Box>C&I Self-consumption</Box>

          <Box>Normal</Box>
        </Box> */}
        <StatusCard
          icon={<HomeIcon sx={{ color: "#00bcd4" }} />}
          title="C&I Self-consumption"
          count=""
          status="Normal"
          detailLink="/consumption"
        />

        <StatusCard
          icon={<PiPlugChargingBold size={24} color="#00bcd4" />}
          title="Inverter"
          count="12"
          detailLink="/devicelist"
          statusItems={["Info Not Available 0", "Partial Capability 0", "Non-Operative 0"]}
        />

        <StatusCard
          icon={<TrendingUpIcon sx={{ color: "#00bcd4" }} />}
          title="String"
          count="161"
          detailLink="/topologyanalysis"
          statusItems={["Cut-Out 0"]}
        />

        <StatusCard
          icon={<PowerIcon sx={{ color: "#00bcd4" }} />}
          title="Alarm"
          count="0"
          detailLink="/activealarm"
          statusItems={["Fault 0", "Warning 0"]}
        />
      </Box>
      
      <Box
        sx={{
          width: "100%",
          minHeight: "60px",
          backgroundColor: theme.palette.background.box,
          padding: 2,
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: '5px 5px 10px rgba(0,0,0,0.3)',
        }}
      >
        <Box
          sx={{
            display: "flex",
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          <MyCalendar />
          <MyButton label={"DAILY"} />
          <MyButton label={"MONTHLY"} />
          <MyButton label={"YEARLY"} />
          <MyButton label={"TOTAL"} />
        </Box>
        <Box
          sx={{
            color: theme.palette.text.option,
            textAlign: "center",
            alignItems: "center",
            gap: 1,
            display: "flex",
          }}
        >
          <LocationPinIcon sx={{ fontSize: 16 }}/>
          <Typography sx={{ ml: 1 }}>Bach khoa University</Typography>
        </Box>
      </Box>

      <Box
        sx={{
          width: "100%",
          height: "100%",
          flex: "2",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          backgroundColor: theme.palette.background.box,
          boxShadow: '5px 5px 10px rgba(0,0,0,0.3)',
        }}
      >
        <Box
          sx={{
            width: "100%",
            height: "80px",
            flex: "1",
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-evenly",
            flexWrap: "wrap",
            backgroundColor: theme.palette.background.head_box
          }}
        >
          <MetricDisplay label="Capacity" value="1.19" unit="MWp" />
          <MetricDisplay label="Temp." value="33.9" unit="°C" />
          <MetricDisplay label="Irradiation" value="—" unit="Wh/m²" />
          <MetricDisplay label="Active Power" value="134.8" unit="kW" />
          <MetricDisplay label="Yield" value="4" unit="h" />
          <MetricDisplay label="Production" value="4.80" unit="MWh" />
          <MetricDisplay label="Power Ratio" value="12.37" unit="%" />
        </Box>
        <Box
          sx={{
            width: "100%",
            height: "100%",
            flex: "2",
            display: "flex",
            flexDirection: "row",
          }}
        >
          <Box
            sx={{
              width: "100%",
              height: "100%",
              flex: 1,
            }}
          >
            {BarData.length > 0 && (
              <MyBarChart
                bardata={BarData}
                barkey1={Object.keys(BarData[0])[1]}
                barkey2={Object.keys(BarData[0])[2]}
              />
            )}
          </Box>
          <Box
            sx={{
              width: "100%",
              height: "100%",
              flex: 1,
            }}
          >
            {BarData.length > 0 && (
              <MyLineChart
                linedata={BarData}
                linekey1={Object.keys(BarData[0])[1]}
                linekey2={Object.keys(BarData[0])[2]}
              />
            )}
          </Box>
        </Box>
      </Box>
      {/* Bottom Section */}
      <Box
        sx={{
          width: "100%",
          // height: "100%",
          flex: "2",
          display: "flex",
          gap: 2,
          // flexDirection: "row",
          // backgroundColor: theme.palette.background.box,
          // alignItems: "center",
          // boxShadow: '5px 5px 10px rgba(0,0,0,0.3)',
        }}
      >
        {/* Inverter Ranking */}
        <Box
          sx={{
            width: "100%",
            flex: 1,
          }}
        >
          <InverterRanking />
        </Box>
        {/* Production Summary */}
        <Box
          sx={{
            width: "100%",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            backgroundColor: theme.palette.background.box,
          }}
        >
          {/*Header*/}
          <Box
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 16px",
              borderBottom: "1px solid #1f2d3a",
            }}
          >
            <h3 style={{ 
              color: "#e0f2f1", 
              margin: "0", 
              fontSize: "16px",
              fontWeight: "500" 
            }}>
              Production
            </h3>
          </Box>
          {/*Body*/}
          <Box sx={{ 
            display: "flex", 
            justifyContent: "space-around", 
            alignItems: "center", 
            height: "100%"
          }}>
            <Box sx={{ 
              display: "flex", 
              flexDirection: "column", 
              alignItems: "center" 
            }}>
              <PiPlugChargingBold size={40} color="#00bcd4" />
              <Typography variant="body2" sx={{ 
                color: "#ccc", 
                mt: 1, 
                textAlign: "center" 
              }}>
                Inverter
              </Typography>
            </Box>
            <Box sx={{ 
              display: "flex", 
              flexDirection: "column", 
              alignItems: "center" 
            }}>
              <GiCharging size={40} color="#00bcd4" />
              <Typography variant="body2" sx={{ 
                color: "#ccc", 
                mt: 1, 
                textAlign: "center" 
              }}>
                Energy Meter
              </Typography>
            </Box>
            <Box sx={{ 
              display: "flex", 
              flexDirection: "column", 
              alignItems: "center" 
            }}>
              <DiBackbone size={40} color="#00bcd4" />
              <Typography variant="body2" sx={{ 
                color: "#ccc", 
                mt: 1, 
                textAlign: "center" 
              }}>
                Grid
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default Dashboard;
