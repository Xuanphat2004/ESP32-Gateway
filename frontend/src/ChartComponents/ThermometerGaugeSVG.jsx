import { useTheme } from "@mui/material/styles";
import React, { useEffect, useRef } from "react";

const ThermometerGaugeSVG = ({ value, max , unit = "", label = "", size = 120 }) => {
  const waveRef = useRef(null);
  // const size = 120; // width = height for a circle
let theme = useTheme();
  useEffect(() => {
    let frame = 0;
    const wave = waveRef.current;
    if (!wave) return;

    const animate = () => {
      const percentage = Math.min(Math.max(value / max, 0), 1);
      if (isNaN(percentage)) return;
      const path = generateWavePath(frame, percentage);
      wave.setAttribute("d", path);
      frame += 0.05;
      requestAnimationFrame(animate);
    };

    animate();
  }, [value, max]);

  const generateWavePath = (frame, percentage) => {
    const width = size;
    const height = size;
    const amplitude = 4;
    const frequency = 0.12;
    const points = 60;

    const yOffset = height * (1 - percentage);
    if (isNaN(yOffset)) return "";
    let path = `M 0 ${yOffset} `;

    for (let x = 0; x <= points; x++) {
      const px = (x / points) * width;
      const py = amplitude * Math.sin(frequency * x + frame) + yOffset;
      path += `L ${px} ${py} `;
    }

    path += `L ${width} ${height} L 0 ${height} Z`;
    return path;
  };

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      

      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        height="100%"
        style={{ borderRadius: "50%", overflow: "visible" }}
      >
        <defs>
          <clipPath id="wave-clip">
            <circle cx={size / 2} cy={size / 2} r={size / 2} />
          </clipPath>
        </defs>

        {/* Sóng nước bên trong */}
        <g clipPath="url(#wave-clip)">
          <path ref={waveRef} fill={theme.palette.text.option} stroke="none" d="M 0 0" />
        </g>

        {/* Viền nét đôi kiểu vintage */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 1.5}
          fill="none"
          stroke={theme.palette.text.header_option}
          strokeWidth="1.5"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 4}
          fill="none"
          stroke={theme.palette.background.option}
          strokeWidth="1"
        />

        {/* Giá trị trung tâm trong SVG để không che wave */}
        <text
          x={size / 2}
          y={size / 2 + 5}
          textAnchor="middle"
          fontFamily="serif"
          fontSize="20"
          fill="white"
          fontWeight="bold"
        >
          {value} {unit}
        </text>
      </svg>
      {/* Label */}
      {label && (
        <div
          style={{
            marginBottom: "5px",
            fontSize: "20px",
            fontFamily: "serif",
            color: "#d4bfa3",
            marginTop: "20px"
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};

export default ThermometerGaugeSVG;
