import { useTheme } from "@mui/material/styles";
import React, { useState } from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TableSortLabel,
} from "@mui/material";

export default function ThreeBoxScrollableTable({ columns, rows }) {
  let theme = useTheme();

  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const [hoverRowIndex, setHoverRowIndex] = useState(null);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedRows = React.useMemo(() => {
    if (!sortField) return rows;
    return [...rows].sort((a, b) => {
      const valA = a[sortField] ?? "";
      const valB = b[sortField] ?? "";
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, sortField, sortDirection]);

  const leftColumns = columns.slice(0, 2);
  const middleColumns = columns.slice(2, columns.length - 1);
  const rightColumn = columns[columns.length - 1];

  return (
    <div style={{ width: "100%" }}>
      <Box sx={{ display: "flex", width: "100%" }}>
        {/* Left Box */}
        <Box sx={{ flex: "0 0 auto", maxWidth: "280px"}}>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {leftColumns.map((col) => (
                    <TableCell
                      key={col.field}
                      sx={{
                        width: "140px",
                        height: "60px",
                        cursor: "pointer",
                        backgroundColor: theme.palette.background.head_box,
                        color: theme.palette.text.header_option
                      }}
                      onClick={() => handleSort(col.field)}
                    >
                      <TableSortLabel
                        active={sortField === col.field}
                        direction={
                          sortField === col.field ? sortDirection : "asc"
                        }
                      >
                        {col.headerName}
                      </TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedRows.map((row, idx) => (
                  <TableRow
                    key={idx}
                    onMouseEnter={() => setHoverRowIndex(idx)}
                    onMouseLeave={() => setHoverRowIndex(null)}
                    sx={{
                      backgroundColor:
                        hoverRowIndex === idx ? "action.hover" : "inherit",
                    }}
                  >
                    {leftColumns.map((col) => (
                      <TableCell key={col.field} sx={{}}>
                        {row[col.field] ?? "---"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* Middle Box */}
        <Box sx={{ flex: "1 1 auto", }}>
          <TableContainer 
            component={Paper}
            sx={{
              overflowX: "auto",
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
            <Table
              sx={{ width: "100%", tableLayout: "fixed", }}
              size="small"
            >
              <TableHead>
                <TableRow>
                  {middleColumns.map((col) => (
                    <TableCell
                      key={col.field}
                      sx={{
                        cursor: "pointer",
                        height: "60px",
                        backgroundColor: theme.palette.background.head_box,
                        color: theme.palette.text.header_option
                      }}
                      onClick={() => handleSort(col.field)}
                    >
                      <TableSortLabel
                        active={sortField === col.field}
                        direction={
                          sortField === col.field ? sortDirection : "asc"
                        }
                      >
                        {col.headerName}
                      </TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedRows.map((row, idx) => (
                  <TableRow
                    key={idx}
                    onMouseEnter={() => setHoverRowIndex(idx)}
                    onMouseLeave={() => setHoverRowIndex(null)}
                    sx={{
                      backgroundColor:
                        hoverRowIndex === idx ? "action.hover" : "inherit",
                    }}
                  >
                    {middleColumns.map((col) => (
                      <TableCell key={col.field}>
                        {row[col.field] ?? "---"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* Right Box */}
        <Box sx={{ flex: "0 0 auto", maxWidth: "140px", }}>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      width: "140px",
                      height: "60px",
                      cursor: "pointer",
                      backgroundColor: theme.palette.background.head_box,
                      color: theme.palette.text.header_option
                      
                    }}
                    onClick={() => handleSort(rightColumn.field)}
                  >
                    <TableSortLabel
                      active={sortField === rightColumn.field}
                      direction={
                        sortField === rightColumn.field ? sortDirection : "asc"
                      }
                    >
                      {rightColumn.headerName}
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedRows.map((row, idx) => (
                  <TableRow
                    key={idx}
                    onMouseEnter={() => setHoverRowIndex(idx)}
                    onMouseLeave={() => setHoverRowIndex(null)}
                    sx={{
                      backgroundColor:
                        hoverRowIndex === idx ? "action.hover" : "inherit",
                    }}
                  >
                    <TableCell>{row[rightColumn.field] ?? "---"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>
    </div>
  );
}
