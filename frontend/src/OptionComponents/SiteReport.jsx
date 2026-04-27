import { useTheme } from "@mui/material/styles";
import { useEffect, useState } from "react";
import { Box, Typography, Divider, useStepContext, Button, Chip } from "@mui/material";
import DropDownButton from "../InteractComponent/DropDownButton";
import { MultiSelectDropdown, AllCategoriesDropDown } from "../InteractComponent/DropDownMulti";
import CelendarForSiteReport from "../InteractComponent/CelendarForSiteReport";
import DynamicTable from "../InteractComponent/TableForSiteReport";

const MoreOption = ({option, selectedMetrics, setSelectedMetrics}) => {
    const optionFilter = ["Site Type", "Province", "Capacity", "Voltage Degree", "Commissioning Date",
                        "Onboarding Date", "Has Weather Station", "Has Energy Meter", "Has Grid Meter"];
    const optionMetric = {
        "Basic Info": ["Date", "Onboarding Date", "Commissioning Date", "Site", "Display Order", "Site Type", "Province", "City",
                        "Capacity (MWp)", "Voltage Class (V)", "Revenue", "Currency", "CO₂ Reduction (t)"],
        "Solar Resource": ["Weather", "Rainfall (mm)", "Highest Temperature (℃)", "Lowest Temperature (℃)", "Average Temperature (℃)",
                        "Sunshine Duration (h)", "Irradiance Source", "POA Irradiation (Wh/m²)", "GHI Irradiation (Wh/m²)",
                        "POA Average Irradiation (Wh/m²)", "Max Irradiance (W/m²)", "AVG Irradiance (W/m²)"],
        "Production": ["Site Production Source", "Site Production (kWh)", "Theoretical Production (kWh)", "Inverter Production (kWh)",
                        "Energy Meter Production (kWh)", "Grid Meter Production (kWh)", "Grid-inject Production (kWh)",
                        "Peak Power(kW)", "Peak Power Moment", "Site Yield (h)", "Inverter Yield (h)", "Energy Meter Yield (h)",
                        "Grid Meter Yield (h)", "Site PR", "Site PRwc", "Inverter PR", "Energy Meter PR", "Grid Meter PR", "PV Array Efficiency"],
        "Consumption": ["Purchasing Electricity from Power Grid(kWh)", "Comprehensive Plant Power Consumption (kWh)",
                        "Comprehensive Plant Power Consumption rate", "Self-Consumed Production (kWh)",
                        "Energy Loss from Generation to Grid-injection (kWh)", "Power Limitation Loss (kWh)", "PV Array Absorbs Loss (kWh)",
                        "Inverter Performance Loss (kWh)", "Self-Consumed Percentage", "Energy Loss Rate from Generation to Grid-injection"],
        "Availability": ["Operational Availability", "Technical Availability", "Customized Availability"],
        "O&M": ["Total Communication Interruption Time (h)"]
    }

    const [filter, setFilter] = useState([]);

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
            <Box sx={{ width: "150px"}}>
                {option === "Site Report" ?
                <MultiSelectDropdown label="Add Filter(s)" options={optionFilter} value={filter} onChange={setFilter}/> : null}
            </Box>
        </Box>
    );
}

function SiteReport() {
    const theme = useTheme();
    const options = ["Site Report", "Production Report", "Budget Production"];
    const allFreq = ["Daily", "Weekly", "Monthly", "Quarterly", "Yearly", "Accumulated"];
    const budgetFreq = ["Monthly", "Quarterly", "Yearly", "Accumulated"];
    const optionAcccount = ["TotalEnergies","Solar"];

    const [option, setOption] = useState("Site Report");
    const [frequency, setFrequency] = useState("Daily");
    const [moreoption, setMoreoption] = useState(true);
    const [selectedMetrics, setSelectedMetrics] = useState([]);
    const [seletedAccount, setSelectedAccount] = useState(["TotalEnergies"]);

    const freqOptions = option === "Budget Production" ? budgetFreq : allFreq;

    const handleClickMoreOption = () => {
        setMoreoption(!moreoption);
    };

    const handleClickSearch = () => {

    }

    const handleClickExport = () => {

    }

    useEffect(() => {
        // if (!freqOptions.includes(frequency)) {
        setFrequency(freqOptions[0]);
        // }
    }, [option]);

    useEffect(() => {
        if (option === "Site Report") {
            setSelectedMetrics(["Date", "Site"]);
        } else if (option === "Production Report") {
            setSelectedMetrics(["Date", "Site", "Irradiation (Wh/m²)", "Site Production (kWh)", "Site Yield (h)",
                                "Site PR", "Site Production Source", "Inverter Production (kWh)", "Energy Meter Production (kWh)",
                                "Grid Meter Production (kWh)", "Capacity (MWp)"]);
        } else if (option === "Budget Production") {
            setSelectedMetrics(["Date", "Site", "Budget Production (kWh)", "Budget Production Completion Rate"]);
        }
    }, [option]);

    return (
        <Box sx={{ padding: "10px", display: "flex", flexDirection: "column" }}>
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid #ffff", padding: "10px", gap: "20px" }}>
                <Box sx={{ width: "150px" }}>
                    <DropDownButton options={options} onChange={setOption} pick={option}/>
                </Box>
                <Box sx={{}}>
                    <DropDownButton options={freqOptions} onChange={setFrequency} pick={frequency} />
                </Box>
                <Box sx={{}}>
                    <CelendarForSiteReport frequency={frequency}/>
                </Box>
                <Box sx={{}}>
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
                {moreoption === true ? <MoreOption option={option} selectedMetrics={selectedMetrics} setSelectedMetrics={setSelectedMetrics}/> : null}
            </Box>
            <Box sx={{ padding: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <Box sx={{ paddingLeft: "170px", display: "flex", gap: "20px" }}>
                    <Box
                        onClick={handleClickSearch}
                        sx={{ 
                            width: "100px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center",
                            borderRadius: "3px", backgroundColor: theme.palette.text.header_option,
                            cursor: "pointer", ":hover": {backgroundColor: "rgba(225, 205, 0, 0.9)"}
                        }}>
                        Search
                    </Box>
                    <Box
                        onClick={handleClickExport}
                        sx={{ 
                            width: "100px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center",
                            borderRadius: "3px", backgroundColor: theme.palette.text.header_option,
                            cursor: "pointer", ":hover": {backgroundColor: "rgba(225, 205, 0, 0.9)"}
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

export default SiteReport;