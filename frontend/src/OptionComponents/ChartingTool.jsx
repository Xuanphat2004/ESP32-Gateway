import { Box, Button, IconButton, Typography, ToggleButton, ToggleButtonGroup, } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import React, { useState, useEffect } from "react";
import MySmartRangePicker from "../InteractComponent/DataRangePicker";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DropDownButton from "../InteractComponent/DropDownButton";
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AddIcon from '@mui/icons-material/Add';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import SaveIcon from '@mui/icons-material/Save';

const OUTemplate = () => {
    const theme = useTheme();

    const categories = ["All Categories", "Default Category", "123"];
    const contents = ["All Contents", "Device Analysis", "Site Analysis"];
    const types = ["All Types", "Scatter", "Trend"];

    const [category, setCategory] = useState("All Categories");
    const [content, setContent] = useState("All Contents");
    const [type, setType] = useState("All Types");

    return (
        <Box>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    flexWrap: "wrap",
                    gap: "10px",
                    padding: "16px",
                }}
            >
                <span>Filter</span>
                <DropDownButton options={categories} onChange={setCategory} pick={category}/>
                <DropDownButton options={contents} onChange={setContent} pick={content}/>
                <DropDownButton options={types} onChange={setType} pick={type}/>
            </Box>
            <Box></Box>
        </Box>
    );
}

const MyTemplate = () => {
    const theme = useTheme();

    const contents = ["All Contents", "Device Analysis", "Site Analysis"];
    const types = ["All Types", "Scatter", "Trend"];
    const templates = [
        { name: "Analysis" },
        { name: "FULUH_PR Test Template" }
    ];
    const optionDay = [
        { label: "Last 1 Day", value: "1day" },
        { label: "Last 3 Days", value: "3day" },
        { label: "Last 7 Days", value: "7day" },
        { label: "Last 30 Days", value: "30day" },
    ];
    const optionTime = ["1 Minute","5 Minutes","15 Minutes","60 Minutes"];

    const [content, setContent] = useState("All Contents");
    const [type, setType] = useState("All Types");
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [timeRange, setTimeRange] = useState([
        {
            startDate: new Date(),
            endDate: new Date(),
            key: "selection",
        },
    ]);
    const [quickTime, setQuickTime] = useState("1day");
    const [time, setTime] = useState("1 Minute");

    useEffect(() => {
        const endDate = new Date(); // Ngày hiện tại hoặc endDate từ state
        let startDate = new Date(endDate);

        switch (quickTime) {
        case "1day":
            startDate.setDate(endDate.getDate() - 1);
            break;
        case "3day":
            startDate.setDate(endDate.getDate() - 3);
            break;
        case "7day":
            startDate.setDate(endDate.getDate() - 7);
            break;
        case "30day":
            startDate.setMonth(endDate.getDate() - 30);
            break;
        default:
            break;
        }

        setTimeRange([
        {
            startDate: startDate,
            endDate: endDate,
            key: "selection",
        },
        ]);
    }, [quickTime]);

    const handleSaveAs = () => {}
    const handleSave = () => {}

    if (!selectedTemplate) {
        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        flexWrap: "wrap",
                        gap: "10px",
                        padding: "16px",
                    }}
                >
                    <span>Filter</span>
                    <DropDownButton options={contents} onChange={setContent} pick={content}/>
                    <DropDownButton options={types} onChange={setType} pick={type}/>
                </Box>
                <Box
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        padding: "16px",
                        gap: "10px",
                    }}
                >
                    {templates.map((tpl) => (
                    <Box 
                        key={tpl.name} 
                        sx={{ 
                            width: 240, 
                            p: 2, 
                            backgroundColor: theme.palette.background.head_box, 
                            cursor: 'pointer',
                        }} 
                        onClick={() => setSelectedTemplate(tpl.name)}
                    >
                        <Typography variant="h6" color={theme.palette.text.option}>{tpl.name}</Typography>
                        <Typography variant="body2" color={theme.palette.text.secondary}>Device Analysis-Tag: Meter Read Active Energy Imported-Total.</Typography>
                        <Typography variant="caption" color={theme.palette.text.disabled}>2021/01/28 00:08:18</Typography>
                    </Box>
                    ))}
                </Box>
            </Box>
        );
    }
    return (
        <Box sx={{ display: "flex", flexDirection: "column", }}>
            {/* Top bar with back */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: "space-between", gap: 1, padding: "10px", backgroundColor: theme.palette.background.head_box }}>
                <Box sx={{ display: "flex", alignItems: "center", }}>
                    <IconButton onClick={() => setSelectedTemplate(null)}>
                        <ArrowBackIcon sx={{ color: theme.palette.text.header_option, }} />
                    </IconButton>
                    <Typography variant="h6" fontSize={16} color={theme.palette.text.option}>{selectedTemplate}</Typography>
                </Box>
                <Box sx={{ display: "flex" }}> 
                    <Box
                        onClick={() => handleSaveAs}
                        sx={{
                            width: "100px", height: "30px", display: "flex",
                            alignItems: "center", justifyContent: "center",
                            border: "1px solid #fff", borderRadius: "3px",
                            gap: "10px", cursor: "pointer",
                        }}
                        
                    >
                        <SaveAsIcon sx={{ fontSize: "16px", color: theme.palette.text.header_option, }}/>
                        <span style={{ fontSize: "14px", }}>Save As</span>
                    </Box>
                    <Box
                        onClick={() => handleSave}
                        sx={{
                            width: "100px", height: "30px", display: "flex",
                            alignItems: "center", justifyContent: "center",
                            border: "1px solid #fff", borderRadius: "3px",
                            gap: "10px", cursor: "pointer",
                        }}
                        
                    >
                        <SaveIcon sx={{ fontSize: "16px", color: theme.palette.text.header_option, }}/>
                        <span style={{ fontSize: "14px", }}>Save</span>
                    </Box>
                </Box> 
            </Box>
            {/* Settings banner */}
            {/* <Box sx={{ p: 2, backgroundColor: theme.palette.background.box }}>
                <Typography>You have selected 1 object and 1 signal. Interval is 5min.</Typography>
            </Box> */}
            {/* Date range and interval controls */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: "space-between", padding: "10px"}}>
                <Box sx={{display: "flex"}}>
                    {optionDay.map((day) => (
                        <Box
                            key={day.value}
                            onClick={() => setQuickTime(day.value)}
                            sx={{
                                px: 2,
                                py: 1,
                                fontSize: "14px",
                                cursor: "pointer",
                                color: quickTime === day.value ? theme.palette.text.header_option : "#fff",
                                position: "relative",
                                zIndex: quickTime === day.value ? 2 : 1,
                            }}
                        >
                            {day.label}
                        </Box>
                    ))}
                    <Box
                        sx={{
                            marginLeft: "20px",
                            alignContent: "center",
                        }}
                    >
                        <MySmartRangePicker
                            value={timeRange}
                            onChange={(newValue) => setTimeRange(newValue)}
                        />
                    </Box>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: "5px"}}>
                    <span style={{ fontSize: "14px" }}>Interval</span>
                    <ErrorOutlineIcon sx={{ fontSize: "18px", color: theme.palette.text.header_option, }}/>
                    <DropDownButton options={optionTime} onChange={setTime} pick={time}/>
                </Box>
            </Box>
            {/* Graph area placeholder */}
            {/* <Box sx={{ height: 300, p: 2, backgroundColor: theme.palette.background.box }}>
                <Typography color={theme.palette.text.disabled}>[Graph Here]</Typography>
            </Box> */}
            {/* Timeline selector placeholder */}
            {/* <Box sx={{ height: 80, p: 2, backgroundColor: theme.palette.background.box }}>
                <Typography color={theme.palette.text.disabled}>[Timeline Slider Here]</Typography>
            </Box> */}
        </Box>
    );
}

const SystemTemplate = () => {
    const theme = useTheme();

    const contents = ["All Contents", "Device Analysis", "Site Analysis"];
    const types = ["All Types", "Scatter", "Trend"];

    const [content, setContent] = useState("All Contents");
    const [type, setType] = useState("All Types");

    return (
        <Box>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    flexWrap: "wrap",
                    gap: "10px",
                    padding: "16px",
                }}
            >
                <span>Filter</span>
                <DropDownButton options={contents} onChange={setContent} pick={content}/>
                <DropDownButton options={types} onChange={setType} pick={type}/>
            </Box>
            <Box>

            </Box>
        </Box>
    );
}

function ChartingTool() {
    const theme = useTheme();

    const [selected, setSelected] = useState("OU");

    const tabs = [
        { label: "OU Template", value: "OU" },
        { label: "My Template", value: "MY" },
        { label: "System Template", value: "SYS" },
    ];

    const renderComponent = () => {
        switch (selected) {
            case "OU":
                return <OUTemplate />;
            case "MY":
                return <MyTemplate />;
            case "SYS":
                return <SystemTemplate />;
            default:
                return null;
        }
    };

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                padding: "20px",
                gap: "20px",
            }}
        >
            <Box
                sx={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    backgroundColor: theme.palette.background.head_box,
                    padding: "5px",
                    borderRadius: "2px",
                }}
            >
                <ErrorOutlineIcon sx={{ color: theme.palette.text.header_option, }}/>
                <span>You can choose a template or start your own analysis.</span>
            </Box>
            <Box
                sx={{
                    minHeight: "500px",
                    flex: 10,
                    display: "flex",
                    flexDirection: "column",
                    backgroundColor: theme.palette.background.head_box,
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        borderBottom: "1px solid #ffff"
                    }}
                >
                    <Box sx={{ display: "flex", }}>
                        {tabs.map((tab) => (
                            <Box
                                key={tab.value}
                                onClick={() => setSelected(tab.value)}
                                sx={{
                                    px: 2,
                                    py: 1,
                                    cursor: "pointer",
                                    color: selected === tab.value ? theme.palette.text.header_option : "#fff",
                                    borderBottom: selected === tab.value ? "3px solid #cc9900ff" : "3px solid transparent",
                                    position: "relative",
                                    zIndex: selected === tab.value ? 2 : 1,
                                }}
                            >
                                {tab.label}
                            </Box>
                        ))}
                    </Box>
                    <Box>
                        <Button
                            sx={{ 
                                color: "#fff", 
                                marginRight: "5px",
                                borderColor: theme.palette.text.header_option,
                                "&:hover": {
                                    backgroundColor: "#d1cfcf",
                                },
                            }}
                        >
                            <AddIcon></AddIcon> 
                            <span>New Analysis</span>
                        </Button>
                    </Box>
                </Box>
                <Box>
                    {renderComponent()}
                </Box>
            </Box>
        </Box>
    );
}

export default ChartingTool;