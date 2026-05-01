import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import { Box, Button, Typography } from "@mui/material";
import { getData, postData, deleteData } from "../ApiComponent/api";

export default function SiteList() {
    const theme    = useTheme();
    const navigate = useNavigate();

    const [sites, setSites]         = useState([]);
    const [showForm, setShowForm]   = useState(false);
    const [siteName, setSiteName]   = useState("");
    const [location, setLocation]   = useState("");
    const [gatewayId, setGatewayId] = useState("");
    const [message, setMessage]     = useState("");

    // Lấy danh sách site khi mở trang
    useEffect(() => {
        const fetchSites = async () => {
            const data = await getData("/solardb/get-my-sites/");
            if (data) setSites(data);
        };
        fetchSites();
    }, []);

    // Thêm site mới
    const handleAddSite = async () => {
        if (!siteName || !location || !gatewayId) {
            setMessage("Please fill full data");
            return;
        }
        const result = await postData("/solardb/add-site/", {
            site_name:  siteName,
            location:   location,
            gateway_id: gatewayId,
        });
        if (result) {
            setMessage("Successful to add new Site");
            setSiteName(""); setLocation(""); setGatewayId("");
            setShowForm(false);
            const data = await getData("/solardb/get-my-sites/");
            if (data) setSites(data);
        } else {
            setMessage("Fail to add new site");
        }
    };

    // Xóa site
    const handleDeleteSite = async (site_id) => {
        const result = await deleteData(`/solardb/delete-site/${site_id}/`);
        if (result) {
            const data = await getData("/solardb/get-my-sites/");
            if (data) setSites(data);
        }
    };

    // Vào xem site
    const handleEnterSite = (site_id) => {
        navigate(`/devicelist?siteId=${site_id}`);
    };

    return (
        <Box sx={{ padding: "20px" }}>

            {/* Header */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                <Typography variant="h5" sx={{ color: theme.palette.text.header_option, fontWeight: "bold" }}>
                    SITE LIST
                </Typography>
            </Box>

            {/* Danh sách card — dạng lưới */}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>

                {/* Card của từng site */}
                {sites.map((site) => (
                    <Box
                        key={site.site_id}
                        sx={{
                            minWidth: "300px",
                            width: "300px",
                            border: "1px solid",
                            borderColor: theme.palette.text.header_option,
                            borderRadius: "10px",
                            padding: "20px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                            backgroundColor: "rgba(255,255,255,0.03)",
                        }}
                    >
                        {/* Tên site — header của card */}
                        <Typography sx={{
                            color: theme.palette.text.header_option,
                            fontWeight: "bold",
                            fontSize: "16px",
                            borderBottom: "1px solid",
                            borderColor: theme.palette.text.header_option,
                            paddingBottom: "8px",
                        }}>
                            {site.site_name}
                        </Typography>

                        {/* Thông tin định danh */}
                        <Typography sx={{ color: theme.palette.table.text, fontSize: "13px" }}>
                            {site.location}
                        </Typography>
                        <Typography sx={{ color: theme.palette.table.text, fontSize: "13px" }}>
                            Gateway ID: {site.gateway_id ?? "--"}
                        </Typography>
                        <Typography sx={{ color: theme.palette.table.text, fontSize: "13px" }}>
                            Site ID: {site.site_id}
                        </Typography>

                        {/* Nút hành động */}
                        <Box sx={{ display: "flex", gap: "10px", mt: 1 }}>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={() => handleEnterSite(site.site_id)}
                                sx={{ color: theme.palette.text.header_option, borderColor: theme.palette.text.header_option, flex: 1 }}
                            >
                                Detail
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={() => handleDeleteSite(site.site_id)}
                                sx={{ color: "red", borderColor: "red" }}
                            >
                                Delete
                            </Button>
                        </Box>
                    </Box>
                ))}

                {/* Card thêm site mới */}
                <Box
                    sx={{
                        minWidth: "300px",
                        width: "300px",
                        border: "1px dashed",
                        borderColor: theme.palette.text.header_option,
                        borderRadius: "10px",
                        padding: "20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                    }}
                >
                    {/* Nút mở/đóng form */}
                    <Button
                        variant="text"
                        onClick={() => { setShowForm(!showForm); setMessage(""); }}
                        sx={{ color: theme.palette.text.header_option, fontWeight: "bold" }}
                    >
                        {showForm ? "✕ Close" : "+ New Site"}
                    </Button>

                    {/* Form thêm — chỉ hiện khi bấm nút */}
                    {showForm && (
                        <>
                            <input
                                value={siteName}
                                onChange={(e) => setSiteName(e.target.value)}
                                placeholder="Name site"
                                style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc", backgroundColor: "transparent", color: "white" }}
                            />
                            <input
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="Positon"
                                style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc", backgroundColor: "transparent", color: "white" }}
                            />
                            <input
                                value={gatewayId}
                                onChange={(e) => setGatewayId(e.target.value)}
                                placeholder="Gateway ID"
                                style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc", backgroundColor: "transparent", color: "white" }}
                            />
                            <Button
                                variant="contained"
                                onClick={handleAddSite}
                                sx={{ backgroundColor: theme.palette.text.header_option, color: "black" }}
                            >
                                Add
                            </Button>
                            {message && (
                                <Typography sx={{ color: message.includes(" ") ? "green" : "red", fontSize: "13px" }}>
                                    {message}
                                </Typography>
                            )}
                        </>
                    )}
                </Box>

            </Box>
        </Box>
    );
}