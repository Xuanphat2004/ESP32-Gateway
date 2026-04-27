import { useTheme } from "@mui/material/styles";
import { useEffect, useState } from "react";
import { Box, Typography, Divider, useStepContext, Button, Chip } from "@mui/material";
import DropDownButton from "../InteractComponent/DropDownButton";
import { MultiSelectDropdown, AllCategoriesDropDown } from "../InteractComponent/DropDownMulti";
import CelendarForSiteReport from "../InteractComponent/CelendarForSiteReport";
import DynamicTable from "../InteractComponent/TableForSiteReport";

const MoreOption = ({option, selectedMetrics, setSelectedMetrics}) => {
    const optionInverter = {
        "All": ["Date", "Site", "Inverter", "Display Order", "Inverter Model", "Belonged Transformer", "Production (kWh)",
                "Serial Number", "Inverter Yield (h)", "Operation Hours (h)", "Downtime (h)", "Theoretical Production (kWh)",
                "Power Limitation Loss (kWh)", "Operational Availability", "Technical Availability", "Customized Availability",
                "Inverter PRwc", "Inverter PR", "Capacity (kWp)", "Number of downtime"],
    }

    const optionWeatherStation = {
        "All": ["Date", "Weather Station", "Display Order", "Site", "Irradiation POA (Wh/m²)", "Irradiation GHI (Wh/m²)",
                "Irradiation POA (MJ/m²)", "Irradiation GHI (MJ/m²)", "Average Ambient Temperature (℃)",
                "Highest Ambient Temperature (℃)", "Lowest Ambient Temperature (℃)", "Rainfall (mm)"],
    }

    const optionEnergyMeter = {
        "All": ["Date", "Site", "Energy Meter", "Display Order", "Production (kWh)", "Consumption (kWh)", "Active Generated (kWh)",
                "Active Consumed (kWh)", "Reactive Generated (kVarh)", "Reactive Consumed (kVarh)"],
    }

    const optionGridMeter = {
        "All": ["Date", "Site", "Grid Meter", "Display Order", "Production (kWh)", "Consumption (kWh)", "Active Generated (kWh)",
                "Active Consumed (kWh)", "Reactive Generated (kVarh)", "Reactive Consumed (kVarh)"],
    }

    const getMetricOptions = () => {
        switch (option) {
            case "Inverter":
                return optionInverter;
            case "Weather Station":
                return optionWeatherStation;
            case "Energy Meter":
                return optionEnergyMeter;
            case "Grid Meter":
                return optionGridMeter;
            default:
                return optionInverter;
        }
    };

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
                    <AllCategoriesDropDown label="Select Metric" options={getMetricOptions()} value={selectedMetrics} onChange={setSelectedMetrics}/>
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

function DeviceReport() {
    const theme = useTheme();
    const options = ["Inverter", "Weather Station", "Energy Meter", "Grid Meter"];
    const optionFrequency = ["Daily", "Weekly", "Monthly", "Quarterly", "Yearly", "Accumulated"];
    const optionAcccount = ["TotalEnergies","Solar"];
    const optionDevice = ["Canteen1_EMT", "Canteen2_EMT", "Canteen4_EMT", "ParkingLot1_EMT"];

    const [option, setOption] = useState("Inverter");
    const [frequency, setFrequency] = useState("Daily");
    const [moreoption, setMoreoption] = useState(true);
    const [selectedMetrics, setSelectedMetrics] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState(["TotalEnergies"]);
    const [selectedDevice, setSelectedDevice] = useState([]);


    const handleClickMoreOption = () => {
        setMoreoption(!moreoption);
    };

    const handleClickSearch = () => {

    }

    const handleClickExport = () => {

    }

    useEffect(() => {
        // if (!freqOptions.includes(frequency)) {
        setFrequency(optionFrequency[0]);
        // }
    }, [option]);

    useEffect(() => {
        switch (option) {
            case "Inverter":
                setSelectedMetrics(["Date", "Site", "Inverter"]);
                break;
            case "Weather Station":
                setSelectedMetrics(["Date", "Weather Station"]);
                break;
            case "Energy Meter":
                setSelectedMetrics(["Date", "Site", "Energy Meter"]);
                break;
            case "Grid Meter":
                setSelectedMetrics(["Date", "Site", "Grid Meter"]);
                break;
            default:
                setSelectedMetrics(["Date", "Site", "Inverter"]);
        }
    }, [option]);

    return (
        <Box sx={{ padding: "10px", display: "flex", flexDirection: "column" }}>
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid #ffff", padding: "10px", gap: "20px" }}>
                <Box sx={{ width: "150px" }}>
                    <DropDownButton options={options} onChange={setOption} pick={option}/>
                </Box>
                <Box sx={{ }}>
                    <DropDownButton options={optionFrequency} onChange={setFrequency} pick={frequency} />
                </Box>
                <Box sx={{ }}>
                    <CelendarForSiteReport frequency={frequency}/>
                </Box>
                <Box sx={{ }}>
                    <MultiSelectDropdown label="Select Account" options={optionAcccount} value={selectedAccount} onChange={setSelectedAccount}/>
                </Box>
                <Box sx= {{ width: "150px" }}>
                    <MultiSelectDropdown label="Select Device" options={optionDevice} value={selectedDevice} onChange={setSelectedDevice}/>
                </Box>
                <Box
                    onClick={handleClickMoreOption}
                    sx={{
                        width: "100px", 
                        height: "30px", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center",
                        borderRadius: "3px", 
                        fontSize: "14px", 
                        cursor: "pointer",
                        ":hover": {backgroundColor: theme.palette.background.head_box,}
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
                            width: "100px", 
                            height: "30px", 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center",
                            borderRadius: "3px", 
                            backgroundColor: theme.palette.text.header_option,
                            cursor: "pointer", 
                            ":hover": {backgroundColor: "rgba(225, 205, 0, 0.9)"}
                        }}>
                        Search
                    </Box>

                    <Box
                        onClick={handleClickExport}
                        sx={{ 
                            width: "100px", 
                            height: "30px", 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center",
                            borderRadius: "3px", 
                            backgroundColor: theme.palette.text.header_option,
                            cursor: "pointer", 
                            ":hover": {backgroundColor: "rgba(225, 205, 0, 0.9)"}
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

export default DeviceReport;