import React, { useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import * as htmlToImage from "html-to-image";
import download from "downloadjs";
import GetAppIcon from "@mui/icons-material/GetApp";
import IconButton from "@mui/material/IconButton";
import { useTheme } from "@mui/material/styles";

const data = [
  {
    name: "Bach khoa",
    value: 87.3,
  },
];

const SingleBarChart = () => {
  let theme = useTheme();
  const chartRef = useRef(null);

  const handleDownload = () => {
    if (!chartRef.current) return;
    htmlToImage.toPng(chartRef.current).then((dataUrl) => {
      download(dataUrl, "single-bar-chart.png");
    });
  };

  return (
    <div style={{ padding: "1rem" }}>
      {/* Nút download */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <IconButton onClick={handleDownload} sx={{ color: "#fff" }}>
          <GetAppIcon />
        </IconButton>
      </div>

      {/* Biểu đồ */}
      <div ref={chartRef} style={{ width: "100%", height: 250,}}>
        <ResponsiveContainer width="100%" height="100%" >
          <BarChart
            data={data}
            margin={{ top: 30, right: 20, left: 20, bottom: 20 }}
            // barCategoryGap="50%"
          >
            <XAxis dataKey="name" stroke="#ccc" />
            <Bar dataKey="value" fill="#0968b5" barSize={40}>
              <LabelList
                dataKey="value"
                position="top"
                formatter={(v) => `${v}h`}
                fill="#fff"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SingleBarChart;
