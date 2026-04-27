import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ColorLensIcon from '@mui/icons-material/ColorLens';

function AlarmConfig() {
    const theme = useTheme();
    return (
        <Box
            sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                padding: "20px",
            }}
        >
            <Box
                sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-evenly",
                }}
            >
                <h1
                    style={{
                        fontSize: "18px",
                        color: theme.palette.text.header_option,
                        borderBottom: "1px solid",
                        borderBottomColor: theme.palette.text.header_option,
                        paddingBottom: "10px",
                    }}
                > 
                    Info
                </h1>
                <Box sx={{ display: "flex",}}>
                    <Box sx={{ flex: 1, }}> Device Alarm</Box>
                    <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: "5px", }}> 
                        <ColorLensIcon style={{color: theme.palette.text.header_option}}/> 
                        <span>Color</span>
                        <Box
                            sx={{
                                width: 16,
                                height: 16,
                                backgroundColor: "#b0b0b0ff",
                                border: "1px solid #fff",
                                borderRadius: "2px",
                            }}
                        ></Box>
                    </Box>
                </Box>
                <Box sx={{ display: "flex",}}>
                    <Box sx={{ flex: 1, }}> Device Alarm</Box>
                    <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: "5px", }}> 
                        <ColorLensIcon style={{color: theme.palette.text.header_option}}/> 
                        <span>Color</span>
                        <Box
                            sx={{
                                width: 16,
                                height: 16,
                                backgroundColor: "#b0b0b0ff",
                                border: "1px solid #fff",
                                borderRadius: "2px",
                            }}
                        ></Box>
                    </Box>
                </Box>
                <Box sx={{ display: "flex",}}>
                    <Box sx={{ flex: 1, }}> Device Alarm</Box>
                    <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: "5px", }}> 
                        <ColorLensIcon style={{color: theme.palette.text.header_option}}/> 
                        <span>Color</span>
                        <Box
                            sx={{
                                width: 16,
                                height: 16,
                                backgroundColor: "#b0b0b0ff",
                                border: "1px solid #fff",
                                borderRadius: "2px",
                            }}
                        ></Box>
                    </Box>
                </Box>
            </Box>

            <Box
                sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-evenly",
                }}
            >
                <h1
                    style={{
                        fontSize: "18px",
                        color: theme.palette.text.header_option,
                        borderBottom: "1px solid",
                        borderBottomColor: theme.palette.text.header_option,
                        paddingBottom: "10px",
                    }}
                >
                    Warning
                </h1>
                <Box sx={{ display: "flex",}}>
                    <Box sx={{ flex: 1, }}> Device Alarm</Box>
                    <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: "5px", }}> 
                        <ColorLensIcon style={{color: theme.palette.text.header_option}}/> 
                        <span>Color</span>
                        <Box
                            sx={{
                                width: 16,
                                height: 16,
                                backgroundColor: "#f5b100",
                                border: "1px solid #fff",
                                borderRadius: "2px",
                            }}
                        ></Box>
                    </Box>
                </Box>
                <Box sx={{ display: "flex",}}>
                    <Box sx={{ flex: 1, }}> Device Alarm</Box>
                    <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: "5px", }}> 
                        <ColorLensIcon style={{color: theme.palette.text.header_option}}/> 
                        <span>Color</span>
                        <Box
                            sx={{
                                width: 16,
                                height: 16,
                                backgroundColor: "#f5b100",
                                border: "1px solid #fff",
                                borderRadius: "2px",
                            }}
                        ></Box>
                    </Box>
                </Box>
                <Box sx={{ display: "flex",}}>
                    <Box sx={{ flex: 1, }}> Device Alarm</Box>
                    <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: "5px", }}> 
                        <ColorLensIcon style={{color: theme.palette.text.header_option}}/> 
                        <span>Color</span>
                        <Box
                            sx={{
                                width: 16,
                                height: 16,
                                backgroundColor: "#f5b100",
                                border: "1px solid #fff",
                                borderRadius: "2px",
                            }}
                        ></Box>
                    </Box>
                </Box>
            </Box>

            <Box
                sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-evenly",
                }}
            >
                <h1
                    style={{
                        fontSize: "18px",
                        color: theme.palette.text.header_option,
                        borderBottom: "1px solid",
                        borderBottomColor: theme.palette.text.header_option,
                        paddingBottom: "10px",
                    }}
                >
                    Fault
                </h1>
                <Box sx={{ display: "flex",}}>
                    <Box sx={{ flex: 1, }}> Device Alarm</Box>
                    <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: "5px", }}> 
                        <ColorLensIcon style={{color: theme.palette.text.header_option}}/> 
                        <span>Color</span>
                        <Box
                            sx={{
                                width: 16,
                                height: 16,
                                backgroundColor: "#f13030ff",
                                border: "1px solid #fff",
                                borderRadius: "2px",
                            }}
                        ></Box>
                    </Box>
                </Box>
                <Box sx={{ display: "flex",}}>
                    <Box sx={{ flex: 1, }}> Performance Alarm</Box>
                    <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: "5px", }}>
                        <ColorLensIcon style={{color: theme.palette.text.header_option}}/>
                        <span>Color</span>
                        <Box
                            sx={{
                                width: 16,
                                height: 16,
                                backgroundColor: "#f13030ff",
                                border: "1px solid #fff",
                                borderRadius: "2px",
                            }}
                        ></Box>
                    </Box>
                </Box>
                <Box sx={{ display: "flex",}}>
                    <Box sx={{ flex: 1, }}> Facility Alarm</Box>
                    <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: "5px", }}>
                        <ColorLensIcon style={{color: theme.palette.text.header_option}}/>
                        <span>Color</span>
                        <Box
                            sx={{
                                width: 16,
                                height: 16,
                                backgroundColor: "#f13030ff",
                                border: "1px solid #fff",
                                borderRadius: "2px",
                            }}
                        ></Box>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}

export default AlarmConfig;