import React, { useState, useMemo } from 'react';
import { useTheme } from "@mui/material/styles";
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Box,
    Typography,
    Pagination,
    Select,
    MenuItem,
    FormControl
} from '@mui/material';

// Component bảng động
const DynamicTable = ({ selectedMetrics }) => {
    const theme = useTheme();
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);

    // Dữ liệu mẫu - trong thực tế sẽ được truyền từ props hoặc fetch từ API
    const generateSampleData = (metrics, count = 100) => {
        const data = [];
        for (let i = 0; i < count; i++) {
        const row = {};
        metrics.forEach(metric => {
            switch (metric) {
            case 'Date':
                row[metric] = `2024-01-${String(i + 1).padStart(2, '0')}`;
                break;
            case 'Site':
                row[metric] = `Site ${i + 1}`;
                break;
            case 'Site Production (kWh)':
                row[metric] = (Math.random() * 10000).toFixed(2);
                break;
            case 'Capacity (MWp)':
                row[metric] = (Math.random() * 100).toFixed(2);
                break;
            case 'Site Yield (h)':
                row[metric] = (Math.random() * 24).toFixed(2);
                break;
            case 'Site PR':
                row[metric] = (Math.random() * 100).toFixed(2) + '%';
                break;
            case 'Irradiation (Wh/m²)':
                row[metric] = (Math.random() * 5000).toFixed(2);
                break;
            case 'Province':
                row[metric] = ['Hanoi', 'HCMC', 'Da Nang', 'Can Tho'][Math.floor(Math.random() * 4)];
                break;
            case 'Site Type':
                row[metric] = ['Rooftop', 'Ground Mount', 'Floating'][Math.floor(Math.random() * 3)];
                break;
            default:
                row[metric] = (Math.random() * 1000).toFixed(2);
            }
        });
        data.push(row);
        }
        return data;
    };

    const sampleData = useMemo(() => 
        generateSampleData(selectedMetrics, 150), [selectedMetrics]
    );

    // Tính toán dữ liệu cho trang hiện tại
    const paginatedData = useMemo(() => {
        const startIndex = (page - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        return sampleData.slice(startIndex, endIndex);
    }, [sampleData, page, rowsPerPage]);

    const totalPages = Math.ceil(sampleData.length / rowsPerPage);

    const handlePageChange = (event, newPage) => {
        setPage(newPage);
    };

    const handleRowsPerPageChange = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(1);
    };

    if (!selectedMetrics || selectedMetrics.length === 0) {
        return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography>No metrics selected</Typography>
        </Box>
        );
    }

    return (
        <Box sx={{ width: '100%' }}>
        <TableContainer 
            component={Paper} 
            sx={{ 
                maxHeight: 400, 
                overflow: 'auto',
                backgroundColor: 'transparent',
                boxShadow: 'none',
                border: '1px solid rgba(255, 255, 255, 0.2)',
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
            <Table stickyHeader size="small">
            <TableHead>
                <TableRow>
                {selectedMetrics.map((metric) => (
                    <TableCell
                    key={metric}
                    sx={{
                        // backgroundColor: '#1e4d5b',
                        backgroundColor: theme.palette.text.header_option,
                        color: 'white',
                        fontWeight: 'bold',
                        minWidth: 120,
                        whiteSpace: 'nowrap',
                        borderRight: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                    >
                    {metric}
                    </TableCell>
                ))}
                </TableRow>
            </TableHead>
            <TableBody>
                {paginatedData.map((row, index) => (
                <TableRow
                    key={index}
                    sx={{
                    '&:nth-of-type(odd)': {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    },
                    '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    },
                    }}
                >
                    {selectedMetrics.map((metric) => (
                    <TableCell
                        key={metric}
                        sx={{
                        color: 'white',
                        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                        whiteSpace: 'nowrap'
                        }}
                    >
                        {row[metric] || '-'}
                    </TableCell>
                    ))}
                </TableRow>
                ))}
            </TableBody>
            </Table>
        </TableContainer>

        {/* Pagination Controls */}
        <Box
            sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mt: 2,
            p: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 1
            }}
        >
            {/* Total Records */}
            <Typography variant="body2" sx={{ color: 'white' }}>
            Total Records: {sampleData.length}
            </Typography>

            {/* Pagination */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'white' }}>
                To page
            </Typography>
            <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
                size="small"
                sx={{
                '& .MuiPaginationItem-root': {
                    color: 'white',
                    borderColor: 'rgba(255, 255, 255, 0.3)'
                },
                '& .MuiPaginationItem-root:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)'
                },
                '& .Mui-selected': {
                    backgroundColor: '#1976d2 !important',
                    color: 'white'
                }
                }}
            />
            </Box>

            {/* Rows Per Page */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControl size="small">
                <Select
                value={rowsPerPage}
                onChange={handleRowsPerPageChange}
                sx={{
                    color: 'white',
                    minWidth: 80,
                    '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.3)'
                    },
                    '& .MuiSvgIcon-root': {
                    color: 'white'
                    }
                }}
                >
                <MenuItem value={50}>50</MenuItem>
                <MenuItem value={100}>100</MenuItem>
                <MenuItem value={200}>200</MenuItem>
                <MenuItem value={300}>300</MenuItem>
                </Select>
            </FormControl>
            <Typography variant="body2" sx={{ color: 'white' }}>
                /Page
            </Typography>
            </Box>
        </Box>
        </Box>
    );
};

export default DynamicTable;