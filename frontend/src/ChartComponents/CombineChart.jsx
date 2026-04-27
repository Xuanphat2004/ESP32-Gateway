// import React from 'react';
// import {
//   BarChart,
//   Bar,
//   LineChart,
//   Line,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
//   Legend,
//   ResponsiveContainer,
// } from 'recharts';

// const data = [
//   { month: 'Jan', actual: 120, budget: 150 },
//   { month: 'Feb', actual: 130, budget: 160 },
//   { month: 'Mar', actual: 160, budget: 170 },
// ];

// const CombinedChart = () => {
//   return (
//     <ResponsiveContainer width="100%" height={300}>
//       <BarChart data={data}>
//         <CartesianGrid strokeDasharray="3 3" />
//         <XAxis dataKey="month" />
//         <YAxis />
//         <Tooltip />
//         <Legend />

//         {/* Biểu đồ cột (Bar) cho actual */}
//         <Bar dataKey="actual" fill="#00bcd4" name="Actual Production" />

//         {/* Biểu đồ đường (Line) cho budget */}
//         <Line
//           type="monotone"
//           dataKey="budget"
//           stroke="#ffeb3b"
//           strokeWidth={2}
//           name="Budget Production"
//         />
//       </BarChart>
//     </ResponsiveContainer>
//   );
// };

// export default CombinedChart;

// import React from 'react';
// import {
//   ComposedChart,
//   Bar,
//   Line,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
//   Legend,
//   ResponsiveContainer,
// } from 'recharts';

// const data = [
//   { month: 'Jan', actual: 120, budget: 150 },
//   { month: 'Feb', actual: 130, budget: 160 },
//   { month: 'Mar', actual: 100, budget: 120 },
//   { month: 'Apr', actual: 190, budget: 180 },
//   { month: 'May', actual: 170, budget: 100 },
// ];

// const CombinedChart = () => {
//   return (
//     <ResponsiveContainer width="100%" height={300}>
//       <ComposedChart data={data} barSize={30}>
//         <CartesianGrid strokeDasharray="3 3" />
//         <XAxis dataKey="month" />
//         <YAxis />
//         <Tooltip />
//         <Legend />

//         {/* Bar cột */}
//         <Bar dataKey="actual" fill="#0968b5" name="Actual Production" />

//         {/* Line đường */}
//         <Line
//           type="monotone"
//           dataKey="budget"
//           stroke="#fbc02d"
//           strokeWidth={2}
//           dot={{ r: 3 }}
//           name="Budget Production"
//           fill='#b58709'
//         />
//       </ComposedChart>
//     </ResponsiveContainer>
//   );
// };

// export default CombinedChart;
import IconButton from "@mui/material/IconButton";
import GetAppIcon from "@mui/icons-material/GetApp";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import { useTheme } from "@mui/material/styles";
import React, { useRef } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import * as htmlToImage from "html-to-image";
import download from "downloadjs";

const data = [
  { month: "Jan", actual: 120, budget: 150 },
  { month: "Feb", actual: 130, budget: 160 },
  { month: "Mar", actual: 100, budget: 120 },
  { month: "Apr", actual: 190, budget: 180 },
  { month: "May", actual: 170, budget: 100 },
];

const CombinedChart = ({ label = "Chart Title" }) => {
  const chartRef = useRef(null);
  const theme = useTheme();
  const handleDownload = () => {
    if (chartRef.current === null) return;

    htmlToImage
      .toPng(chartRef.current)
      .then((dataUrl) => {
        download(dataUrl, "chart.png");
      })
      .catch((err) => {
        console.error("Error generating image:", err);
      });
  };

  return (
    <div ref={chartRef} style={{ background: "", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header: Label bên trái, nút tải về bên phải */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between", // label trái, nút phải
          alignItems: "center",
          marginBottom: 8,
          backgroundColor: theme.palette.background.head_box,
        }}
      >
        <div
          style={{
            fontWeight: "bold",
            fontSize: "16px",
            paddingLeft: "20px",
            color: theme.palette.text.header_option,
          }}
        >
          {label}
        </div>

        <IconButton
          onClick={handleDownload}
          sx={{ color: theme.palette.table.text }}
        >
          <DownloadOutlinedIcon />
        </IconButton>
      </div>
      <div style={{height: "100%"}}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} barSize={30}>
            <CartesianGrid vertical={false} stroke="#999" strokeOpacity={0.3} />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="actual" fill="#0968b5" name="Actual Production" />
            <Line
              type="monotone"
              dataKey="budget"
              stroke="#fbc02d"
              strokeWidth={2}
              dot={{ r: 2 }}
              name="Budget Production"
              fill="#FFA500"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CombinedChart;
