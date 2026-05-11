import React, { useState } from "react";
import {
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, TableSortLabel,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

export default function SortTable({ columns, rows, onRowClick }) {
  const theme = useTheme();
  const [orderBy, setOrderBy] = useState("");
  const [order,   setOrder]   = useState("asc");

  const handleSort = (field) => {
    const isAsc = orderBy === field && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(field);
  };

  const sortedRows = [...rows].sort((a, b) => {
    if (!orderBy) return 0;
    const valA = a[orderBy];
    const valB = b[orderBy];
    if (valA < valB) return order === "asc" ? -1 : 1;
    if (valA > valB) return order === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <TableContainer component={Paper} sx={{ background: "transparent" }}>
      <Table>
        <TableHead>
          <TableRow sx={{ backgroundColor: theme.palette.background.head_box }}>
            {columns.map((col) => (
              <TableCell key={col.field}>
                <TableSortLabel
                  active={orderBy === col.field}
                  direction={orderBy === col.field ? order : "asc"}
                  onClick={() => handleSort(col.field)}
                  sx={{ color: orderBy === col.field ? "cyan" : "inherit" }}
                >
                  {col.headerName}
                </TableSortLabel>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody>
          {sortedRows.length ? (
            sortedRows.map((row, idx) => (
              <TableRow
                key={idx}
                hover={!!onRowClick}
                onClick={() => onRowClick?.(row)}
                sx={{
                  cursor:     onRowClick ? "pointer" : "default",
                  transition: "background-color 0.15s",
                }}
              >
                {columns.map((col) => (
                  <TableCell key={col.field}>
                    {row[col.field]}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} align="center">
                No records available for the current search criteria
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
