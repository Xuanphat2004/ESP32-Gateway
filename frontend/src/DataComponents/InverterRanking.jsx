import React from "react";
import { useEffect, useState } from "react";
import { useTheme } from "@mui/material/styles";
import axios from "axios";

function InverterRanking() {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");
  const [inverterData, setInverterData] = useState([]);

  const path = `http://localhost:8000/solardb/avt-ranking/`;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const reponse = await axios.get(path);
        setInverterData(reponse.data);
      } catch (err) {
        console.error("LOI KHI GOI API: ", err);
      }
    };

    fetchData();

    const interval = setInterval(fetchData, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const filteredData = inverterData
    .filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (!sortKey) return 0;
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (sortOrder === "asc") return valA > valB ? 1 : -1;
      else return valA < valB ? 1 : -1;
    });

  return (
    <div
      style={{
        width: "100%",
        maxHeight: "300px",
        overflow: "hidden",
        backgroundColor: theme.palette.background.box,
        padding: "0",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
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
          Inverter Ranking
        </h3>
        <a
          href="/DeviceList"
          style={{
            color: "#20a1f7",
            textDecoration: "none",
            fontSize: "12px",
          }}
        >
          Details
        </a>
      </div>
      {/* Search */}
      <input
        type="text"
        placeholder="Search"
        style={{
          width: "100%",
          padding: "8px",
          boxSizing: "border-box",
          backgroundColor: theme.palette.background.box,
          color: "#e0f2f1",
          border: "1px solid #262829ff",
          outline: "none",
          marginBottom: "8px",
          borderRadius: "6px",
        }}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      {/* Table Container */}
      <div 
        style={{ 
          overflowY: "auto", 
          maxHeight: "220px", 
          display: "flex", 
          flexDirection: "column",
          // '&::-webkit-scrollbar': {
          //   width: '8px',
          // },
          // '&::-webkit-scrollbar-thumb': {
          //   backgroundColor: 'transparent',
          //   borderRadius: '4px',
          // },

          // '&:hover::-webkit-scrollbar-thumb': {
          //   backgroundColor: theme.palette.background.head_box,
          // },
          // '&:hover::-webkit-scrollbar-track': {
          //   backgroundColor: 'transparent',
          // },
        }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead
            style={{
              position: "sticky",
              top: 0,
              // backgroundColor: theme.palette.background.box,
              backgroundColor: "#1f1f20ff",
              color: "#b9c3c9",
              // borderBottom: "1px solid #1f2d3a",
              // zIndex: 1,
              height: "50px",
            }}
          >
            <tr>
              <th
                onClick={() => handleSort("name")}
                style={{
                  cursor: "pointer",
                  textAlign: "left",
                  padding: "10px",
                }}
              >
                Name ↑↓
              </th>
              <th
                onClick={() => handleSort("yield")}
                style={{
                  cursor: "pointer",
                  textAlign: "left",
                  padding: "10px",
                }}
              >
                Yield (h) ↑↓
              </th>
              <th
                onClick={() => handleSort("production")}
                style={{
                  cursor: "pointer",
                  textAlign: "left",
                  padding: "10px",
                }}
              >
                Production (kWh) ↑↓
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, idx) => (
              <tr
                key={idx}
                style={{
                  backgroundColor: idx % 2 === 0 ? theme.palette.background.head_box : theme.palette.background.box,
                  color: "#e0f2f1",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "grey")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    idx % 2 === 0 ? theme.palette.background.head_box : theme.palette.background.box)
                }
              >
                <td style={{ padding: "10px", color: "#20a1f7" }}>
                  {item.name}
                </td>
                <td style={{ padding: "10px" }}>
                  {item.yields.toLocaleString()}
                </td>
                <td style={{ padding: "10px" }}>
                  {item.production.toLocaleString()}
                </td>
              </tr>
            ))}
            {/* Empty rows to fill space if needed */}
              {filteredData.length === 0 && (
                <tr>
                  <td 
                    colSpan="4" 
                    style={{
                      padding: "20px",
                      textAlign: "center",
                      color: "#b9c3c9",
                      fontSize: "13px"
                    }}
                  >
                    No data available
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default InverterRanking;
