import { Tooltip } from "@mui/material";

function StringToolTip({ children }) {
  return (
    <Tooltip
      title="Add title...."
      arrow
      followCursor
      PopperProps={{
        modifiers: [
          {
            name: "offset",
            options: {
              offset: [0, 20], // 👉 [x, y] - y là khoảng cách theo chiều dọc
            },
          },
        ],
      }}
      componentsProps={{
        tooltip: {
          sx: {
            backgroundColor: "#333",
            color: "white",
            fontSize: "14px",
            border: "1px solid #888",
            borderRadius: "8px",
            padding: "8px 12px",
          },
        },
        arrow: {
          sx: {
            color: "#333", // màu mũi tên = màu tooltip
          },
        },
      }}
    >
      {children}
    </Tooltip>
  );
}

export default StringToolTip;
