import { useTheme } from "@mui/material/styles";
import { useEffect, useState } from "react";
import { Box, Typography, Divider, useStepContext, Button, Chip } from "@mui/material";
import dayjs from "dayjs"; 
import DropDownButton from "../InteractComponent/DropDownButton";
import { MultiSelectDropdown, AllCategoriesDropDown } from "../InteractComponent/DropDownMulti";
import MyCalendar from "../InteractComponent/myCalendar";
import DynamicTable from "../InteractComponent/TableForSiteReport";

const MoreOption = ({ selectedMetrics, setSelectedMetrics}) => {
    const optionMetric = {
        "All": ["Date", "Site", "Display Order", "Grid type", "Capacity (MWp)", "Weather", "Irradiation Today (Wh/m²)",
                "Irradiation Today (MJ/m²)", "Daily Production (kWh)", "Yesterday's Weather", "Yesterday's Irradiation (Wh/m²)",
                "Yesterday's Irradiation (MJ/m²)", "Yesterday's Production (kWh)", "Monthly Budget Production (kWh)",
                "Monthly Budget Production Completion Rate", "Yearly Budget Production (kWh)", "Yearly Budget Production Completion Rate"],
    }

    const handleMetricChange = (newSelected) => {
        setSelectedMetrics(newSelected);
    };

    const handleDeleteMetric = (metric) => {
        setSelectedMetrics(curr =>
            curr.filter(item => item !== metric)
        );
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", borderBottom: "1px solid #ffff", gap: "20px", padding: "10px" }}>
            <Box sx={{ display: "flex", gap: "20px" }}>
                <Box sx={{ width: "150px" }}>
                    <AllCategoriesDropDown label="Select Metric" options={optionMetric} value={selectedMetrics} onChange={setSelectedMetrics}/>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                    {selectedMetrics.map((metric) => (
                        <Chip
                            key={metric}
                            label={metric}
                            size="small"
                            onDelete={() => handleDeleteMetric(metric)}
                        />
                    ))}
                </Box>
            </Box>
        </Box>
    );
}

function ProductionReport() {
    const theme = useTheme();
    const options = ["Production Report"];
    const optionAcccount = ["TotalEnergies", "Solar"];

    const [option, setOption] = useState("Production Report");
    const [moreoption, setMoreoption] = useState(true);
    const [selectedMetrics, setSelectedMetrics] = useState([]);
    const [seletedAccount, setSelectedAccount] = useState(["TotalEnergies"]);
    const [selectedDate, setSelectedDate] = useState(dayjs());

    const handleClickMoreOption = () => {
        setMoreoption(!moreoption);
    };

    const handleClickSearch = () => {

    }

    const handleClickExport = () => {

    }

    useEffect(() => {
        setSelectedMetrics(["Date", "Site", "Grid type", "Capacity (MWp)", "Weather", "Irradiation Today (Wh/m²)",
                "Irradiation Today (MJ/m²)", "Daily Production (kWh)", "Yesterday's Weather", "Yesterday's Irradiation (Wh/m²)",
                "Yesterday's Irradiation (MJ/m²)", "Yesterday's Production (kWh)", "Monthly Budget Production (kWh)",
                "Monthly Budget Production Completion Rate", "Yearly Budget Production (kWh)", "Yearly Budget Production Completion Rate"]);
    }, [option]);

    return (
        <Box sx={{ padding: "10px", display: "flex", flexDirection: "column" }}>
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid #ffff", padding: "10px", gap: "20px" }}>
                <Box sx={{ width: "150px" }}>
                    <DropDownButton options={options} onChange={setOption} pick={option}/>
                </Box>
                <Box sx={{ }}>
                    <MyCalendar value={selectedDate} onChange={(newDate) => setSelectedDate(newDate)}/>
                </Box>
                <Box sx={{ }}>
                    <MultiSelectDropdown label="Select Account" options={optionAcccount} value={seletedAccount} onChange={setSelectedAccount}/>
                </Box>
                <Box
                    onClick={handleClickMoreOption}
                    sx={{
                        width: "100px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center",
                        borderRadius: "3px", fontSize: "14px", cursor: "pointer",
                        ":hover": {
                            backgroundColor: theme.palette.background.head_box,
                        }
                    }}>
                        More Option
                    </Box>
            </Box>
            <Box>
                {moreoption === true ? <MoreOption selectedMetrics={selectedMetrics} setSelectedMetrics={setSelectedMetrics}/> : null}
            </Box>
            <Box sx={{ padding: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <Box sx={{ paddingLeft: "170px", display: "flex", gap: "20px" }}>
                    <Box
                        onClick={handleClickSearch}
                        sx={{ 
                            width: "100px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center",
                            borderRadius: "3px", backgroundColor: theme.palette.text.header_option,
                            cursor: "pointer", ":hover": {backgroundColor: "rgba(207, 4, 4, 0.9)"}
                        }}>
                        Search
                    </Box>
                    <Box
                        onClick={handleClickExport}
                        sx={{ 
                            width: "100px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center",
                            borderRadius: "3px", backgroundColor: theme.palette.text.header_option,
                            cursor: "pointer", ":hover": {backgroundColor: "rgba(207, 4, 4, 0.9)"}
                        }}
                    >
                        Export
                    </Box>
                </Box>
                <Box>
                    <DynamicTable selectedMetrics={selectedMetrics} />
                </Box>
            </Box>
        </Box>
    );
}

export default ProductionReport;