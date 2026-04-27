import React, { useState, useEffect } from "react";
import LineChart from "../ChartComponents/LineChart";
import { Box, colors } from "@mui/material";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { styled, useTheme } from "@mui/material/styles";

const SiteCard = ({
  name,
  cardname,
  status = "LOCAL 1",
  temperature = 20, // Cần điều chỉnh vì power không phải nhiệt độ
  irradiance,
  power,
  powerRatio,
  cardlabel,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  const [chartData, setChartData] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        if (cardname) { // Chỉ gọi API nếu cardname tồn tại
          const path_daily = `http://localhost:8000/solardb/${cardname}/`;
          const path_hourly = `http://localhost:8000/solardb/hourly/`;
          const [resDaily, resHourly] = await Promise.all([
            axios.get(path_daily),
            axios.get(path_hourly),
          ]);

          if (Array.isArray(resDaily.data)) {
            setChartData(resDaily.data);
          } else {
            console.warn("API daily không trả về mảng:", resDaily.data);
            setChartData([]);
          }

          if (Array.isArray(resHourly.data)) {
            setHourlyData(resHourly.data);
          } else {
            console.warn("API hourly không trả về mảng:", resHourly.data);
            setHourlyData([]);
          }
        } else {
          // Không gọi API, giữ dữ liệu rỗng
          setChartData([]);
          setHourlyData([]);
        }
      } catch (err) {
        console.error("Lỗi khi gọi API:", err);
        setChartData([]);
        setHourlyData([]);
      }
    };

    fetchAllData();
    const interval = setInterval(fetchAllData, 3000);
    return () => clearInterval(interval);
  }, [cardname]);

  const latestdata =
    chartData.length > 0 ? chartData[chartData.length - 1] : null;

  const handleToSiteView = (siteName) => {
    navigate(`/siteview/${siteName}`);
  };

  // Xử lý hiệu ứng khi hover
  const handleMouseOver = () => {
    setIsHovered(true);
  };

  const handleMouseOut = () => {
    setIsHovered(false);
  };

  // Xử lý hiệu ứng khi click (có thể kết hợp với điều hướng)
  const handleClick = () => {
    setIsClicked(true);
    handleToSiteView(name);
    // Reset trạng thái click sau khi điều hướng (tùy chọn)
    setTimeout(() => setIsClicked(false), 200); // Reset sau 200ms
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        cursor: "pointer",
        transform: isHovered ? "scale(1.06)" : "scale(1)",
        backgroundColor: "rgba(255, 255, 255, 0.05)", // màu xám trắng trong suốt
        WebkitBackdropFilter: "blur(6px)", // hỗ trợ Safari
        // border: "1px solid rgba(255, 255, 255, 0.1)", // viền nhẹ
      }}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      onClick={handleClick}
    >
      <div
        style={{
          flex: 1,
          color: "white",
          backgroundColor: theme.palette.text.option,
          textAlign: "center",
        }}
      >
        <b>{cardlabel}</b>
      </div>
      <div
        style={{
          display: "flex",
          flex: 3,
        }}
      >
        <div
          style={{
            // backgroundColor: "grey",
            borderColor: "white",
            flex: 2,
              padding: "5px",
          }}
        >
          <LineChart LineChartData={hourlyData} />
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            // backgroundColor: "pink",
            flexDirection: "column",
            justifyContent: "space-evenly",
            alignItems: "left",
            paddingLeft: "5px",
            fontSize: "12px",
          }}
        >
          <div style={{ color: theme.palette.text.body_chart, }}>
            Temperature: {latestdata ? latestdata.temp.toFixed(1) : "--"}
            <b> °C</b>
          </div>
          <div style={{ color: theme.palette.text.body_chart, }}>
            Irradiance: {latestdata ? latestdata.irradiance.toFixed(1) : "--"}
            <b> W/m²</b>
          </div>
          <div style={{ color: theme.palette.text.body_chart, }}>
            Active Power:{" "}
            {latestdata ? latestdata.active_power.toFixed(1) : "--"} 
            <b> W</b>
          </div>
          <div style={{ color: theme.palette.text.body_chart, }}>
            Power Ratio:{" "}
            {latestdata?.active_power
              ? ((latestdata.active_power / 1090) * 100).toFixed(2)
              : "--"}
            <b> %</b>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiteCard;
