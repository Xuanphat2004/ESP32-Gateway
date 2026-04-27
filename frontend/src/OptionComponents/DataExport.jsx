import React, { useState } from 'react';
import { useTheme } from "@mui/material/styles";
// import { Download, Trash2, Info, Calendar, Clock, CheckCircle, X } from 'lucide-react';
import { Box, Button, Checkbox, IconButton, Input, Menu, MenuItem, Typography } from "@mui/material";
import DataSources from '../InteractComponent/DataSources';
import DropDownButton from '../InteractComponent/DropDownButton';

const ExportModal = ({exportForm, setExportForm, setShowExportModal}) => {
    const theme = useTheme();
    const handleExportSubmit = () => {
        // Simulate export process
        setShowExportModal(false);
        // Add new record to the list (in real app, this would call an API)
    };
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "10px", padding: "10px" }}>
            {/* <Box>
                <h2>New Export Task</h2>
                <button 
                    onClick={() => setShowExportModal(false)}
                >
                <X className="w-5 h-5" />
                </button>
            </Box> */}
            <Box sx={{ display: "flex", gap: "20px" }}>
                {/* Device Type */}
                <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <label>Device Type:</label>
                    <Box
                        component="select"
                        value={exportForm.deviceType}
                        onChange={(e) => setExportForm({...exportForm, deviceType: e.target.value})}
                        sx={{
                            width: "150px", height: "30px", border: `1px solid ${theme.palette.text.header_option}`,
                            borderRadius: "3px", color: theme.palette.text.header_option, background: "transparent",
                            cursor: "pointer", paddingLeft: "10px",
                            ":hover": {
                                borderColor: theme.palette.grey[50],
                            }
                        }}
                    >
                        <option>Inverter</option>
                        <option>Weather Station</option>
                        <option>Energy Meter</option>
                    </Box>
                </Box>

                {/* Device */}
                <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <label>Device:</label>
                    <Box
                        component="select"
                        sx={{ 
                            width: "150px", height: "30px", border: `1px solid ${theme.palette.text.header_option}`,
                            borderRadius: "3px", color: theme.palette.text.header_option, background: "transparent",
                            cursor: "pointer", paddingLeft: "10px",
                            ":hover": {
                                borderColor: theme.palette.grey[50],
                            }
                        }}
                    >
                        <option>Select</option>
                    </Box>
                </Box>

                {/* Tags */}
                <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <label>Tags:</label>
                    <Box
                        component="select"
                        sx={{ 
                            width: "150px", height: "30px", border: `1px solid ${theme.palette.text.header_option}`,
                            borderRadius: "3px", color: theme.palette.text.header_option, background: "transparent",
                            cursor: "pointer", paddingLeft: "10px",
                            ":hover": {
                                borderColor: theme.palette.grey[50],
                            }
                        }}
                    >
                        <option>Selected</option>
                    </Box>
                </Box>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: "20px" }}>
                {/* Period */}
                <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <label>Period:</label>
                    <Box>
                        <Box
                            component="input"
                            type='date'
                            value={exportForm.periodStart.replace(/\//g, '-')}
                            sx={{ 
                                width: "150px", height: "30px", border: `1px solid ${theme.palette.text.header_option}`,
                                borderRadius: "3px", color: theme.palette.text.header_option, background: "transparent",
                                cursor: "pointer", padding: "10px",
                                ":hover": {
                                    borderColor: theme.palette.grey[50],
                                }
                            }}
                        />
                        <span> - </span>
                        <Box
                            component="input"
                            type='date'
                            value={exportForm.periodEnd.replace(/\//g, '-')}
                            sx={{ 
                                width: "150px", height: "30px", border: `1px solid ${theme.palette.text.header_option}`,
                                borderRadius: "3px", color: theme.palette.text.header_option, background: "transparent",
                                cursor: "pointer", padding: "10px",
                                ":hover": {
                                    borderColor: theme.palette.grey[50],
                                }
                            }}
                        />
                    </Box>
                </Box>

                {/* Interval */}
                <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <label>Interval:</label>
                    <Box
                        component="select"
                        sx={{ 
                            width: "150px", height: "30px", border: `1px solid ${theme.palette.text.header_option}`,
                            borderRadius: "3px", color: theme.palette.text.header_option, background: "transparent",
                            cursor: "pointer", paddingLeft: "10px",
                            ":hover": {
                                borderColor: theme.palette.grey[50],
                            }
                        }}
                    >
                        <option>5min</option>
                        <option>10min</option>
                        <option>15min</option>
                        <option>30min</option>
                        <option>1hour</option>
                    </Box>
                </Box>
            </Box>

            {/* Export Mode */}
            <Box sx={{ display: "flex", alignItems: "center", gap: "20px" }}>
                <label>Export Mode:</label>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Box
                        component={Checkbox}
                        checked={exportForm.mergeFiles}
                        onChange={(e) => setExportForm({...exportForm, mergeFiles: e.target.checked})}
                    />
                    <span>Merge files of the same site and device</span>
                </Box>
            </Box>

            {/* Notice */}
            <Box sx={{ display: "flex", alignItems: "center", gap: "20px" }}>
                <label>Notice:</label>
                <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Box
                        component={Checkbox}
                        checked={exportForm.emailNotice}
                        onChange={(e) => setExportForm({...exportForm, emailNotice: e.target.checked})}
                    />
                    <span>Email</span>
                    <Box
                        component={Input}
                        type='email'
                        value={exportForm.email}
                        onChange={(e) => setExportForm({...exportForm, email: e.target.value})}
                        sx={{ width: "250px", borderRadius: "3px", border: `1px solid ${theme.palette.text.header_option}`, paddingLeft: "10px",
                            ":hover": {borderColor: theme.palette.grey[50]}
                        }}
                    />
                </Box>
            </Box>

            {/* Modal Actions */}
            <Box 
                sx={{ display: "flex", gap: "20px", paddingLeft: "200px" }}
            >
                <Box
                    component={Button}
                    onClick={handleExportSubmit}
                    sx={{ height: "30px", width: "80px", color: theme.palette.text.header_option + " !important",
                        border: `1px solid ${theme.palette.text.header_option}`,
                        ":hover": {borderColor: theme.palette.grey[50]} }}
                >
                    Export
                </Box>
                <Box
                    component={Button}
                    onClick={() => setShowExportModal(false)}
                    sx={{ height: "30px", width: "80px", color: theme.palette.text.header_option + " !important",
                        border: `1px solid ${theme.palette.text.header_option}`,
                        ":hover": {borderColor: theme.palette.grey[50]} }}
                >
                    Cancel
                </Box>
            </Box>
        </Box>
    );
};

function DataExport() {
    const theme = useTheme();

    const [activeTab, setActiveTab] = useState('inverter');
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportForm, setExportForm] = useState({
        deviceType: 'Inverter',
        device: 'Select',
        tags: 'Selected',
        periodStart: '2025/01/30',
        periodEnd: '2025/08/01',
        interval: '5min',
        mergeFiles: true,
        emailNotice: true,
        email: 'vu.nguyen@palmavn.com.vn'
    });

    const tabs = [
        { id: 'total', label: 'Total', count: 158 },
        { id: 'site', label: 'Site', count: 20 },
        { id: 'inverter', label: 'Inverter', count: 4, active: true },
        { id: 'weather', label: 'Weather Station', count: 62 },
        { id: 'energy', label: 'Energy Meter', count: 72 }
    ];

    const exportRecords = [
        {
        id: 1,
        date: '2025-08-01 14:20:01',
        status: 'Success',
        site: 'Fu Luh',
        devices: 1,
        deviceName: 'FULUH_Canteen_1_Inverter_1',
        tags: 'DC Input Power',
        timeRange: '2025-01-30 ~ 2025-08-01',
        duration: '13 Minutes',
        downloads: 0,
        action: 'Merge files of the same site and device'
        },
        {
        id: 2,
        date: '2022-09-27 09:01:27',
        status: 'Success',
        site: 'Fu Luh',
        devices: 1,
        deviceName: 'FULUH_Canteen_1_Inverter_1',
        tags: 'DC Input Power',
        timeRange: '2022-01-01 ~ 2022-09-27',
        duration: '8 Minutes',
        downloads: 1,
        action: 'Merge files of the same site and device'
        }
    ];

    return (
        <Box
            sx={{
                display: "flex", flexDirection: "column", gap: "20px", padding: "20px",
            }}
        >
            <Box sx={{ backgroundColor: theme.palette.background.box}}>
                {showExportModal === true ? <ExportModal exportForm={exportForm} setExportForm={setExportForm} setShowExportModal={setShowExportModal}/> : 
                    <Box
                        sx={{ 
                            display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px",
                        }}
                    >
                        <Box
                            onClick={() => setShowExportModal(true)}
                            sx={{
                                width: "150px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center",
                                border: `1px solid ${theme.palette.text.header_option}`, borderRadius: "3px", 
                                color: theme.palette.text.header_option, cursor: "pointer", ":hover": { borderColor: "#ffff"}
                            }}
                        >
                            New Export Task
                        </Box>
                        <Box 
                            sx={{ 
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
                                color: theme.palette.text.header_option, cursor: "pointer", 
                            }}>
                            <DataSources/>
                        </Box>
                    </Box>
                }  
            </Box>
            <Box sx={{ display: "flex", backgroundColor: theme.palette.background.box }}>
                {tabs.map((tab) => (
                    <Box
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        sx={{
                            backgroundColor: activeTab === tab.id ? theme.palette.text.header_option : theme.palette.background.box,
                            padding: "8px 12px",
                            cursor: "pointer",
                            ":hover": {
                                backgroundColor: activeTab === tab.id ? theme.palette.text.header_optionHover : theme.palette.action.hover
                            }
                        }}
                    >
                        {tab.label} ({tab.count})
                    </Box>
                ))}
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", backgroundColor: theme.palette.background.box }}>
                {/* Export Records */}
                {exportRecords.map((record, i) => (
                    <Box key={i} sx={{ display: "flex", padding: "10px", 
                                backgroundColor: i % 2 === 0 ? theme.palette.background.paper : theme.palette.background.box }}>
                        {/* Status Icon */}
                        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Box>
                                {/* <CheckCircle/> */}
                            </Box>
                            <span>Success</span>
                        </Box>
                        <Box sx={{ flex: 10 }}>
                        {/* Record Header */}
                            <Box sx={{ display: "flex" }}>
                                <Box sx={{ borderRight: "1px solid #fff", paddingRight: "10px" }}>{record.date}</Box>
                                <Box sx={{ borderRight: "1px solid #fff", padding: "0px 10px" }}>{record.action}</Box>
                                <Box sx={{ borderRight: "1px solid #fff", padding: "0px 10px" }}>
                                    {/* <Download/> */}
                                    <span>{record.downloads} Download(s)</span>
                                </Box>
                                <Box sx={{ color: theme.palette.text.header_option, cursor: "pointer", paddingLeft: "10px" }}>
                                    Delete Record
                                </Box>
                            </Box>

                            {/* Record Content */}
                            <Box>
                                {/* Record Details */}
                                <Box>
                                    <h3>{record.site}</h3>
                                    <Box>
                                        <Box>
                                            <span>Number of Devices: </span>
                                            <span>{record.devices}</span>
                                        </Box>
                                        <Box>
                                            <span>Device Name: </span>
                                            <span>{record.deviceName}</span>
                                        </Box>
                                        <Box>
                                            <span>Tags: </span>
                                            <span>{record.tags}</span>
                                        </Box>
                                        <Box>
                                            <span>Time Range: </span>
                                            <span>{record.timeRange}</span>
                                        </Box>
                                        <Box>
                                            <span>Duration: </span>
                                            <span>{record.duration}</span>
                                        </Box>
                                    </Box>
                                    <Box
                                        
                                        sx={{ width: "100px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center",
                                            border: `1px solid ${theme.palette.text.header_option}`, cursor: "pointer",
                                            ":hover": {borderColor: theme.palette.action.hover} }}
                                    >
                                        Download
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}

export default DataExport;