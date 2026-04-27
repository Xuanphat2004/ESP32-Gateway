import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Label,
} from "recharts";

import IconButton from "@mui/material/IconButton";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import { useRef } from "react";
import * as htmlToImage from "html-to-image";
import download from "downloadjs";
import { useTheme } from "@mui/material/styles";
import { Box } from "@mui/material";

const MyLineChart = ({ linedata, linekey1, linekey2, label}) => {
  const chartRef = useRef(null);
  const theme = useTheme();

  const handleDownload = () => {
    if (!chartRef.current) return;

    htmlToImage
      .toPng(chartRef.current)
      .then((dataUrl) => {
        download(dataUrl, "linechart.png");
      })
      .catch((err) => {
        console.error("Download error:", err);
      });
  };

  return (
    <div ref={chartRef} style={{ background: "", height: "100%" }}>
      {/* Header: label bên trái, nút download bên phải */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
          backgroundColor: theme.palette.background.head_box,
        }}
      >
        <div style={{ fontWeight: "bold", fontSize: "16px", paddingLeft: "20px", color: theme.palette.text.header_option  }}>{label}</div>
        <IconButton onClick={handleDownload} sx={{ color: theme.palette.table.text  }}>
          <DownloadOutlinedIcon />
        </IconButton>
      </div>
      
      <ResponsiveContainer width="100%" height={280} >
        <LineChart 
          data={linedata}
          margin={{ top: 30, right: 20, bottom: 20, left: 10 }}
        >
          <CartesianGrid vertical={false} stroke="#555555" strokeWidth={0.2} />
          <XAxis dataKey="time" fontSize={12} >
            <Label value="Time (h)" fontSize={12} position="insideBottomRight" dx={40} dy={5}/>
          </XAxis>

          <YAxis yAxisId="left" orientation="left" fontSize={12}>
            <Label value="kWh" fontSize={12} angle={0} position="insideTopLeft" dx={40} dy={-30}/>
          </YAxis>
          
          <YAxis yAxisId="right" orientation="right" fontSize={12} >
             <Label value="Wh/m²" fontSize={12} angle={0} position="insideTopRight" dx={-30} dy={-30}/>
          </YAxis>

          <Tooltip
            cursor={false}
            contentStyle={{
              backgroundColor: "#000",
              border: "1px solid #444",
              borderRadius: "8px",
              color: "#fff",
              fontSize: "14px"
            }}
          />
          <Legend />
          <Line type="monotone" dataKey={linekey1} stroke="#00BFFF" yAxisId="left" />
          <Line type="monotone" dataKey={linekey2} stroke="#FFA500" yAxisId="right" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MyLineChart;

