import { useTheme } from "@mui/material/styles";
import { useState } from "react";
import { Box, Typography, Divider } from "@mui/material";
import ContactUsPanel from "../InteractComponent/ContactUsPanel";
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import CircleIcon from '@mui/icons-material/Circle';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

const UserManual = () => {
    const theme = useTheme();
    const link = 'https://app-portal-eu2.envisioniot.com/docs/enlight-solar/en/v3.0.1/index.html';

    const handleClick = () => {
        window.open(link, '_blank'); // Mở tab mới
    };
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "20px", padding: "20px" }}>
            <Typography sx={{ fontSize: "14px" }}>
                EnOS Solar M&C provides an integrated monitoring and operation solution for different scales of solar sites, from C&I sites to utility-scale sites. It enables users to monitor and manage the operations of solar assets at different levels (device, group, and site). EnOS Solar M&C is built on a big data architecture to offer real-time collection and analysis of data, and storage and retrieval of massive historical data. It also provides data analysis models and KPIs that are specific to the solar domain. Thus, achieving a closed-loop online troubleshooting process, from defect identification, defect correction, to final verification.
            </Typography>
            <Typography sx={{ fontSize: "14px" }}>
                The user manual describes the product functions and explains in detail about typical work scenarios. It is designed to help you get started with using the product. Click the link below to view the user manual for EnOS Solar M&C.
            </Typography>
            <Box 
                onClick={handleClick}
                sx={{ 
                    display: "flex", 
                    color: theme.palette.text.header_option, 
                    cursor: "pointer",
                    '&:hover': {
                        textDecoration: 'underline',
                    }
                }}
            >
                <Typography>EnOS Solar M&C User Manual</Typography>
                <KeyboardArrowRightIcon/>
            </Box>
        </Box>
    );
}

const ReleasedNote = () => {
    const theme = useTheme();
    return (
        <Box sx={{ position: "relative", px: 4, py: 3 }}>
            {/* Cột timeline dọc */}
            <Box
                sx={{
                    position: "absolute",
                    left: 80,
                    top: "40px",
                    bottom: "24px",
                    width: "2px",
                    backgroundColor: "#ccc",
                }}
            />

            {/* Mốc thời gian và ngày */}
            <Box sx={{ position: "relative", pl: 10, mt: 3 }}>
                <Typography
                    variant="h6"
                    sx={{
                        color: "#ccc",
                        fontWeight: "bold",
                        position: "absolute",
                        left: "26px",
                        top: "-44px",
                    }}
                >
                    2025
                </Typography>

                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        position: "relative",
                        mb: 1,
                    }}
                >
                    <CircleIcon
                        sx={{
                            fontSize: "12px",
                            position: "absolute",
                            left: "-37px",
                            top: "-16px",
                            color: "#ccc",
                        }}
                    />
                    <RadioButtonCheckedIcon
                        fontSize="small"
                        sx={{
                            color: theme.palette.text.header_option,
                            position: "absolute",
                            left: "-41px",
                            top: "40px",
                            backgroundColor: "#0a0a0a",
                            borderRadius: "50%",
                            zIndex: 1,
                        }}
                    />
                    <Typography
                        variant="body1"
                        sx={{
                            color: "#ccc",
                            fontWeight: 500,
                            position: "absolute",
                            left: "-84px",
                            top: "38px",
                        }}
                    >
                        06/30
                    </Typography>
                </Box>

                <Box
                    sx={{
                        position: "absolute",
                        top: "50px",
                        left: "73px", // hoặc điều chỉnh cho sát hình tròn
                        transform: "translateY(-50%)",
                        width: 0,
                        height: 0,
                        borderTop: "6px solid transparent",
                        borderBottom: "6px solid transparent",
                        borderRight: "6px solid #0a0a0a",
                    }}
                />

                {/* Card nội dung */}
                <Box
                    sx={{
                        backgroundColor: theme.palette.background.head_box,
                        color: "#fff",
                        mt: "0px",
                        p: 3,
                        borderRadius: 1,
                        maxWidth: "90%",
                        fontSize: "14px",
                    }}
                >
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Version 3.0.1
                    </Typography>

                    <Typography variant="body1" sx={{ fontSize: "14px", fontWeight: "bold" }}>
                        • [What’s New]
                    </Typography>
                    <ul style={{ marginTop: 0 }}>
                        <li>
                            A new 'Reset' option has been added to inverter control.
                        </li>
                        <li>
                            For solar sites with zero-export strategy configured, users can Enable/Disable or Edit the strategies in the Site View menu.
                        </li>
                        <li>
                            Multiple calculation methods are supported for the AGC status of sites.
                        </li>
                    </ul>

                    <Typography variant="body1" sx={{ fontSize: "14px", fontWeight: "bold", mt: 2 }}>
                        • [What’s Changed]
                    </Typography>
                    <ul style={{ marginTop: 0 }}>
                        <li>
                            Optimization of the real-time curve function in the Site View. Users can set the curves to display.
                        </li>
                        <li>
                            Optimization of the curtailment algorithm. It supports judging inverter curtailment state.
                        </li>
                        <li>
                            The DC input alarm details support latest time of string info change.
                        </li>
                        <li>
                            Update of the English name of the company in alarm emails: changed to 'Univers'.
                        </li>
                    </ul>

                    <Typography variant="body1" sx={{ fontSize: "14px", fontWeight: "bold", mt: 2 }}>
                        • [Fixed Issues]
                    </Typography>
                    <ul style={{ marginTop: 0 }}>
                        <li>
                            The issue that some alarms could not be confirmed has been fixed.
                        </li>
                    </ul>
                </Box>
            </Box>
        </Box>
    );
}

function About() {
    const theme = useTheme();
    const tabs = [
        { label: "User Manual", value: "UM" },
        { label: "Release Note", value: "RN" },
    ];

    const [selected, setSelected] = useState("UM");

    return (
        <Box sx={{ display: "flex", flexDirection: "column", padding: "20px", gap: "20px" }}>
            <ContactUsPanel />
            <Box>
                <Typography sx={{ fontSize: "20px", marginBottom: "10px" }}>
                    EnOS Solar M&C
                </Typography>
                <Box sx={{ display: "flex", gap: "20px" }}>
                    <Typography x={{ fontSize: "14px" }}>Version v3.0.1.20250630</Typography>
                    <Typography sx={{ fontSize: "14px" }}>Released on 2025/06/30</Typography>
                </Box>
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", backgroundColor: theme.palette.background.head_box, }}>
                <Box sx={{ display: "flex" }}>
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
                <Box sx={{ minHeight: "490px" }}>
                    {selected === "UM" ? <UserManual /> : <ReleasedNote/ >}
                </Box>
            </Box>
        </Box>
    );
}

export default About;