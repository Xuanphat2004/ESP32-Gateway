import React, { useState } from "react";
import { useTheme } from "@mui/material/styles";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const data = [
  { name: "Night State", value: 53.93 },
  { name: "Full Capability", value: 33.95 },
  { name: "Partial Capability", value: 10.1 },
  { name: "Startup", value: 0.0 },
  { name: "Equipment Failure", value: 0.05 },
  { name: "Power System Failure", value: 0.24 },
  { name: "No Data Refresh", value: 1.73 },
];

const randomColors = data.map(() => `hsl(${Math.random() * 360}, 70%, 50%)`);

const DonutChart = () => {
  const [activeIndex, setActiveIndex] = useState(null);
  let theme = useTheme();
  return (
    <div
      style={{
        minWidth: "500px",
        height: "300px",

        borderRadius: "12px",
        color: "white",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          backgroundColor: theme.palette.background.head_box,
          height: "40px",
          fontSize: "18px",
          fontWeight: "bold",
          paddingLeft: "10px",
          display: "flex",
          alignItems: "center",
          color: theme.palette.table.text,
        }}
      >
        State Statistics (For Period 2025/01/01 - 2025/07/01)
      </div>
      <ResponsiveContainer
        width="100%"
        height="100%"
        style={{ backgroundColor: theme.palette.background.box }}
      >
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="40%"
            cy="50%"
            innerRadius={40}
            outerRadius={100}
            activeIndex={activeIndex}
            activeShape={{
              innerRadius: 50,
              outerRadius: 120,
            }}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            isAnimationActive={true}
            animationDuration={1500} // 👈 chậm hơn
            animationEasing="ease-in-out"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={randomColors[index]} />
            ))}
          </Pie>

          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            formatter={(value) => (
              <span style={{ color: theme.palette.table.color }}>{value}</span>
            )}
          />
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DonutChart;
