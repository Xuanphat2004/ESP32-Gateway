import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler,
  Ticks,
} from "chart.js";
import { Line } from "react-chartjs-2";
import React, { useState } from "react";
import { useTheme } from "@mui/material/styles";

// Đăng ký các thành phần của biểu đồ
ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler
);

const LineChart = ({ LineChartData }) => {
  const theme = useTheme();
  const data = {
    labels: LineChartData.map((d) =>
      new Date(d.timestamp).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    ),
    datasets: [
      {
        label: "Power (kw)",
        data: LineChartData.map((d) => d.active_power),
        borderColor: "#4f46e5",
        backgroundColor: "rgba(79,70,229,0.1)",
        tension: 0.2,
        // fill: true,
        yAxisID: "y1",
        pointRadius: 0,
      },
      {
        label: "Irradiance (W/m²)",
        data: LineChartData.map((d) => d.irradiance),
        borderColor: "#10b981",
        tension: 0.2,
        // fill: true,
        yAxisID: "y2",
        pointRadius: 0,
      },
    ],
  };

  const options = {
    // responsive: true,
    interaction: {
      //cach nguoi dung tuong tac voi chart thuong la hover
      mode: "index",
      intersect: false,
    },
    stacked: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        //tooltip la cai khung hien thong tin khi ta hover chuot vao
        backgroundColor: "rgba(30,30,30,0.9)", // màu nền tooltip
        bodyColor: "white", // màu chữ nội dung
        titleColor: "white", // màu chữ tiêu đề (ví dụ: thời gian)
        borderColor: "white", // viền tooltip
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: {
          color: theme.palette.text.body_chart,
        },
      },
      y1: {
        ticks: {
          color: "#4f46e5",
        },
        type: "linear",
        display: true,
        position: "left",
        title: {
          display: true,
          text: "Power (kw)",
          color: "#4f46e5",
        },
      },
      y2: {
        ticks: {
          color: "#10b981",
        },
        type: "linear",
        display: true,
        position: "right",
        grid: {
          drawOnChartArea: false,
        },
        title: {
          display: true,
          text: "Irradiance (W/m²)",
          color: "#10b981",
        },
      },
    },
  };

  return <Line data={data} options={options} />;
};
export default LineChart;
