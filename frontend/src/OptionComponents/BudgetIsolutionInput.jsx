import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  useTheme,
  Pagination, // Thêm Pagination cho phần footer
  Select,
  MenuItem
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import FilterListIcon from '@mui/icons-material/FilterList'; // Icon cho filter

// --- 1. DỮ LIỆU GIẢ (Mô phỏng dữ liệu Budget Grid Inject) ---
// Cấu trúc dữ liệu tương tự như hình bạn gửi
const rows = [
  {
    id: 1,
    site: "Fu Luh",
    year: 2025,
    jan: 131339.60, feb: 153154.40, mar: 175302.40, apr: 153223.00, may: 147637.00, jun: 131045.60,
    jul: 137405.80, aug: 141257.20, sep: 126371.00, oct: 135861.40, nov: 128233.80, dec: 131163.20,
    updatedBy: "kaifong.lim",
    updatedOn: "2025-08-25",
  },
  {
    id: 2,
    site: "Fu Luh",
    year: 2024,
    jan: 132010.00, feb: 153936.00, mar: 176197.00, apr: 154005.00, may: 148390.00, jun: 131714.00,
    jul: 138107.00, aug: 141978.00, sep: 127016.00, oct: 136354.00, nov: 128878.00, dec: 131832.00,
    updatedBy: "kaifong.lim",
    updatedOn: "2025-08-25",
  },
   {
    id: 3,
    site: "Fu Luh",
    year: 2023,
    jan: 132679.80, feb: 154717.20, mar: 177091.20, apr: 143286.50, may: 149143.50, jun: 132382.80,
    jul: 138237.90, aug: 142698.60, sep: 127660.50, oct: 137045.70, nov: 127521.90, dec: 132501.60,
    updatedBy: "kaifong.lim",
    updatedOn: "2025-08-25",
  },
  
];

const months = ["Jan(kWh)", "Feb(kWh)", "Mar(kWh)", "Apr(kWh)", "May(kWh)", "Jun(kWh)", "Jul(kWh)", "Aug(kWh)", "Sep(kWh)", "Oct(kWh)", "Nov(kWh)", "Dec(kWh)"];
// Mapping để lấy dữ liệu từ object row (ví dụ 'Jan(kWh)' -> 'jan')
const monthKeys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const BudgetIsolutionInput = () => {
  const theme = useTheme(); // Lấy theme hiện tại (Sáng/Tối)
  
  // State cho phân trang (Pagination)
  const [page, setPage] = useState(1);
  const rowsPerPage = 50;

  return (
    <Box sx={{ 
        p: 3, 
        backgroundColor: theme.palette.background.default, // Nền thay đổi theo theme
        minHeight: "100vh", 
        color: theme.palette.text.primary 
    }}>
      
      {/* --- PHẦN 2: HEADER (Tiêu đề & Các nút chức năng) --- */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: "bold", color: theme.palette.mode === 'dark' ? '#80cbc4' : '#00695c' }}>
          Isolution Budget Input  {/* Đổi tên tiêu đề cho đúng trang */}
        </Typography>

        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            <Typography variant="caption" sx={{ color: "gray", display: 'flex', alignItems: 'center' }}>
                <span style={{marginRight: 5, border: '1px solid gray', borderRadius: '50%', width: 14, height: 14, display:'inline-block', textAlign:'center', lineHeight: '12px'}}>!</span>
                Please download the template first for batch import
            </Typography>
            
            <Button //Đây là Component chính được nhập từ thư viện MU <Button ... > ... </Button>
                variant="text" 
                startIcon={<CloudDownloadIcon />} //Chèn một icon vào vị trí bắt đầu (bên trái) của dòng chữ
                sx={{ 
                  color: "#03a9f4", 
                  textTransform: "none", 
                  fontSize: '0.875rem' 
                }} // Thuộc tính đặc biệt của MUI để viết CSS tùy chỉnh (ghi đè lên kiểu mặc định).
            >
                Download Template
            </Button>
            
            <Button 
                variant="contained" //Quy định kiểu hiển thị của nút là "đổ màu nền đặc" (Solid background).
                // startIcon={<FileUploadIcon />}
                sx={{ 
                    backgroundColor: "#03a9f4", 
                    textTransform: "none", 
                    fontWeight: 'bold',
                    '&:hover': { backgroundColor: "#0288d1" }
                }}
            >
                Batch Import
            </Button>
            
             <Button 
                variant="contained" 
                startIcon={<div style={{fontSize: '1.2rem'}}>+</div>}
                sx={{ 
                    backgroundColor: "#03a9f4", 
                    textTransform: "none", 
                    fontWeight: 'bold',
                    minWidth: '80px',
                    '&:hover': { backgroundColor: "#0288d1" }
                }}
            >
                Add
            </Button>
        </Box>
      </Box>

      {/* --- PHẦN 3: BẢNG DỮ LIỆU (TABLE) --- */}
      <TableContainer component={Paper} sx={{ 
          backgroundColor: theme.palette.mode === 'dark' ? "#1e2a30" : "#fff", // Màu nền bảng
          borderRadius: 1,
          boxShadow: 'none', // Bỏ bóng cho giống thiết kế phẳng
          border: `1px solid ${theme.palette.divider}`
      }}>
        <Table sx={{ minWidth: 1200 }} aria-label="budget grid table" size="small">
          
          {/* Table Head */}
          <TableHead>
            <TableRow sx={{ backgroundColor: theme.palette.mode === 'dark' ? "#ddb224ff" : "#283593" }}>
              <TableCell sx={{ color: theme.palette.text.primary, fontWeight: "bold", borderBottom: 'none' }}>Site</TableCell>
               <TableCell sx={{ color: theme.palette.text.primary, fontWeight: "bold", borderBottom: 'none', display:'flex', alignItems:'center' }}>
                   Year <FilterListIcon sx={{fontSize: 16, ml: 0.5, color: '#03a9f4'}}/>
               </TableCell>
              {months.map((month) => (
                <TableCell key={month} align="right" sx={{ color: theme.palette.text.primary, fontSize: "0.8rem", borderBottom: 'none' }}>
                  {month}
                </TableCell>
              ))}
              <TableCell sx={{ color: theme.palette.text.primary, borderBottom: 'none' }}>Updated by</TableCell>
              <TableCell sx={{ color: theme.palette.text.primary, borderBottom: 'none' }}>Updated on</TableCell>
              <TableCell sx={{ color: theme.palette.text.primary, borderBottom: 'none' }} align="center">Operations</TableCell>
            </TableRow>
          </TableHead>

          {/* Table Body */}
          <TableBody>
            {rows.map((row, index) => (
              <TableRow
                key={row.id}
                sx={{ 
                    '&:last-child td, &:last-child th': { border: 0 },
                    // Màu nền xen kẽ (Zebra striping)
                    backgroundColor: index % 2 === 0 ? (theme.palette.mode === 'dark' ? "#1e2a30" : "#fff") : (theme.palette.mode === 'dark' ? "#232f34" : "#f5f5f5"),
                    '&:hover': { backgroundColor: theme.palette.action.hover } 
                }}
              >
                <TableCell component="th" scope="row" sx={{ color: "#03a9f4", borderBottom: `1px solid ${theme.palette.divider}` }}>{row.site}</TableCell>
                <TableCell sx={{ color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>{row.year}</TableCell>
                
                {/* Render dữ liệu các tháng */}
                {monthKeys.map((key) => (
                     <TableCell key={key} align="right" sx={{ color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>
                         {row[key].toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                     </TableCell>
                ))}

                <TableCell sx={{ color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>{row.updatedBy}</TableCell>
                <TableCell sx={{ color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>{row.updatedOn}</TableCell>
                
                {/* Cột thao tác */}
                <TableCell align="center" sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                  <IconButton size="small" sx={{ color: "#03a9f4" }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" sx={{ color: "#03a9f4" }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {/* --- PHẦN 4: FOOTER (Phân trang) --- */}
        <Box sx={{ 
            p: 1.5, 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            color: theme.palette.text.secondary, 
            backgroundColor: theme.palette.mode === 'dark' ? "#263238" : "#eeeeee",
            borderTop: `1px solid ${theme.palette.divider}`
        }}>
            <Typography variant="caption">Total Records: {rows.length}</Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                 <Box sx={{display:'flex', alignItems:'center', backgroundColor: '#03a9f4', padding: '2px 8px', borderRadius: '2px'}}>
                    <Typography variant="caption" sx={{color:'white'}}>1</Typography>
                 </Box>
                 <Typography variant="caption">To page</Typography>
                 <Box sx={{border: '1px solid #555', padding: '0px 5px', borderRadius: '2px', backgroundColor: '#1e2a30'}}>
                     <Typography variant="caption">1</Typography>
                 </Box>
            </Box>

            <Box sx={{display:'flex', alignItems:'center', border: '1px solid #555', borderRadius: '4px', padding: '2px 5px'}}>
                 <Typography variant="caption" sx={{mr: 1}}>50/Page</Typography>
                 <div style={{width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '5px solid #03a9f4'}}></div>
            </Box>
        </Box>

      </TableContainer>
    </Box>
  );
};

export default BudgetIsolutionInput;