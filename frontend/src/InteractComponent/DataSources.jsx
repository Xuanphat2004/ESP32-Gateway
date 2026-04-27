import React, { useState } from "react";
import { useTheme } from "@mui/material/styles";
import { Box, Popper, Paper } from "@mui/material";
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

const DataSources = () => {
    const theme = useTheme();
    const [anchorEl, setAnchorEl] = useState(null);

    const handleMouseEnter = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMouseLeave = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);

    return (
        <Box
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        >
        {/* Button Contact Us */}
        <Box
            sx={{
            color: theme.palette.text.header_option,
            display: "flex",
            alignItems: "center",
            gap: "5px",
            p: "8px 12px",
            cursor: "pointer",
            fontSize: "14px",
            }}
        >
            <ErrorOutlineIcon sx={{ fontSize: "18px" }} />
            <span>Data Sources</span>
        </Box>

        {/* Panel hiển thị khi hover */}
        <Popper open={open} anchorEl={anchorEl} placement="left-start" disablePortal>
            <Paper
            sx={{
                backgroundColor: "#000",
                color: "#fff",
                p: 1,
                width: 300,
            }}
            >
            <Box display="flex" alignItems="center" fontSize={"14px"}>
                The data from data export comes from Hive, which is cold data, and the minimum time granulariy is 5 minutes. It is mainly used for long-term historical data analysis.
            </Box>
            </Paper>
        </Popper>
        </Box>
    );
};

export default DataSources;