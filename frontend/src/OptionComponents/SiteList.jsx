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
    const [latitude, setLatitude]   = useState("");
    const [longitude, setLongitude] = useState("");
    const [message, setMessage]     = useState("");
    const [geocoding, setGeocoding] = useState(false);

    // null = đang ở chế độ THÊM MỚI | có giá trị = đang SỬA site có id này
    const [editingId, setEditingId] = useState(null);

    // ── Lấy danh sách site khi mở trang ──────────────────────────────────
    const refreshSites = async () => {
        const data = await getData("/solardb/get-my-sites/");
        if (data) setSites(data);
    };
    useEffect(() => { refreshSites(); }, []);

    // ── Reset form về trạng thái rỗng ────────────────────────────────────
    const resetForm = () => {
        setSiteName(""); setLocation(""); setGatewayId("");
        setLatitude(""); setLongitude("");
        setEditingId(null); setMessage("");
    };

    // ── Geocode địa chỉ → tọa độ (OpenStreetMap Nominatim, miễn phí) ──────
    const handleGeocode = async () => {
        if (!location) {
            setMessage("Please enter an address first");
            return;
        }
        setGeocoding(true);
        setMessage("");
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(location)}`;
            const res  = await fetch(url, { headers: { "Accept-Language": "en" } });
            const json = await res.json();
            if (json && json.length > 0) {
                setLatitude(Number(json[0].lat).toFixed(6));
                setLongitude(Number(json[0].lon).toFixed(6));
                setMessage("Coordinates found from address");
            } else {
                setMessage("Address not found. Please enter coordinates manually.");
            }
        } catch (e) {
            setMessage("Geocoding failed. Please enter coordinates manually.");
        } finally {
            setGeocoding(false);
        }
    };

    // ── Mở form sửa với dữ liệu site có sẵn ──────────────────────────────
    const handleEditClick = (site) => {
        setEditingId(site.site_id);
        setSiteName(site.site_name || "");
        setLocation(site.location || "");
        setGatewayId(site.gateway_id || "");
        setLatitude(site.latitude != null ? String(site.latitude) : "");
        setLongitude(site.longitude != null ? String(site.longitude) : "");
        setShowForm(true);
        setMessage("");
    };

    // ── Thêm MỚI hoặc CẬP NHẬT site (dùng chung 1 form) ──────────────────
    const handleSubmit = async () => {
        if (!siteName || !location || !gatewayId) {
            setMessage("Please fill in name, address and gateway ID");
            return;
        }

        const payload = {
            site_name:  siteName,
            location:   location,
            gateway_id: gatewayId,
            latitude:   latitude  === "" ? null : Number(latitude),
            longitude:  longitude === "" ? null : Number(longitude),
        };

        let result;
        if (editingId === null) {
            // Thêm mới
            result = await postData("/solardb/add-site/", payload);
        } else {
            // Cập nhật (bao gồm thay gateway)
            result = await postData(`/solardb/update-site/${editingId}/`, payload);
        }

        if (result && !result.error) {
            setMessage(editingId === null ? "Site added successfully" : "Site updated successfully");
            resetForm();
            setShowForm(false);
            refreshSites();
        } else {
            // Hiển thị lỗi từ backend (ví dụ gateway đã được site khác dùng)
            setMessage(result?.error || "Operation failed");
        }
    };

    // ── Xóa site ─────────────────────────────────────────────────────────
    const handleDeleteSite = async (site_id) => {
        const result = await deleteData(`/solardb/delete-site/${site_id}/`);
        if (result) refreshSites();
    };

    const handleEnterSite = (site_id) => {
        navigate(`/devicelist?siteId=${site_id}`);
    };

    const inputStyle = {
        padding: "8px", borderRadius: "4px", border: "1px solid #ccc",
        backgroundColor: "transparent", color: theme.palette.text.primary, width: "100%", boxSizing: "border-box",
    };

    return (
        <Box sx={{ padding: "20px" }}>

            {/* Header */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                <Typography variant="h5" sx={{ color: theme.palette.text.header_option, fontWeight: "bold" }}>
                    SITE LIST
                </Typography>
            </Box>

            {/* Danh sách card */}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>

                {sites.map((site) => (
                    <Box
                        key={site.site_id}
                        sx={{
                            minWidth: "300px", width: "300px",
                            border: "1px solid", borderColor: theme.palette.text.header_option,
                            borderRadius: "10px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "10px",
                            backgroundColor: "rgba(255,255,255,0.03)",
                        }}
                    >
                        <Typography sx={{
                            color: theme.palette.text.header_option, fontWeight: "bold", fontSize: "16px",
                            borderBottom: "1px solid", borderColor: theme.palette.text.header_option,
                            paddingBottom: "8px",
                        }}>
                            {site.site_name}
                        </Typography>

                        <Typography sx={{ color: theme.palette.table.text, fontSize: "13px" }}>
                            {site.location}
                        </Typography>
                        <Typography sx={{ color: theme.palette.table.text, fontSize: "13px" }}>
                            Gateway ID: {site.gateway_id ?? "--"}
                        </Typography>
                        <Typography sx={{ color: theme.palette.table.text, fontSize: "13px" }}>
                            Site ID: {site.site_id}
                        </Typography>
                        <Typography sx={{ color: theme.palette.table.text, fontSize: "13px" }}>
                            Coords: {site.latitude != null && site.longitude != null
                                ? `${Number(site.latitude).toFixed(4)}, ${Number(site.longitude).toFixed(4)}`
                                : "Not set"}
                        </Typography>

                        {/* Nút hành động */}
                        <Box sx={{ display: "flex", gap: "8px", mt: 1 }}>
                            <Button
                                variant="outlined" size="small"
                                onClick={() => handleEnterSite(site.site_id)}
                                sx={{ color: theme.palette.text.header_option, borderColor: theme.palette.text.header_option, flex: 1 }}
                            >
                                Detail
                            </Button>
                            <Button
                                variant="outlined" size="small"
                                onClick={() => handleEditClick(site)}
                                sx={{ color: "#f5a623", borderColor: "#f5a623", flex: 1 }}
                            >
                                Edit
                            </Button>
                            <Button
                                variant="outlined" size="small"
                                onClick={() => handleDeleteSite(site.site_id)}
                                sx={{ color: "red", borderColor: "red" }}
                            >
                                Delete
                            </Button>
                        </Box>
                    </Box>
                ))}

                {/* Card thêm/sửa site */}
                <Box
                    sx={{
                        minWidth: "300px", width: "300px",
                        border: "1px dashed", borderColor: theme.palette.text.header_option,
                        borderRadius: "10px", padding: "20px",
                        display: "flex", flexDirection: "column", gap: "10px",
                    }}
                >
                    <Button
                        variant="text"
                        onClick={() => {
                            if (showForm) { resetForm(); setShowForm(false); }
                            else { resetForm(); setShowForm(true); }
                        }}
                        sx={{ color: theme.palette.text.header_option, fontWeight: "bold" }}
                    >
                        {showForm ? "✕ Close" : "+ New Site"}
                    </Button>

                    {showForm && (
                        <>
                            <Typography sx={{ color: theme.palette.text.header_option, fontSize: "13px", fontWeight: "bold" }}>
                                {editingId === null ? "Add New Site" : `Edit Site #${editingId}`}
                            </Typography>

                            <input value={siteName} onChange={(e) => setSiteName(e.target.value)}
                                   placeholder="Site name" style={inputStyle} />

                            <input value={location} onChange={(e) => setLocation(e.target.value)}
                                   placeholder="Address" style={inputStyle} />

                            {/* Nút geocode địa chỉ → tọa độ */}
                            <Button
                                variant="outlined" size="small" disabled={geocoding}
                                onClick={handleGeocode}
                                sx={{ color: theme.palette.text.header_option, borderColor: theme.palette.text.header_option }}
                            >
                                {geocoding ? "Finding..." : "📍 Find coordinates from address"}
                            </Button>

                            {/* Tọa độ — tự điền từ geocode hoặc nhập tay */}
                            <Box sx={{ display: "flex", gap: "8px" }}>
                                <input value={latitude} onChange={(e) => setLatitude(e.target.value)}
                                       placeholder="Latitude" style={{ ...inputStyle, width: "50%" }} />
                                <input value={longitude} onChange={(e) => setLongitude(e.target.value)}
                                       placeholder="Longitude" style={{ ...inputStyle, width: "50%" }} />
                            </Box>

                            <input value={gatewayId} onChange={(e) => setGatewayId(e.target.value)}
                                   placeholder="Gateway ID (MAC)" style={inputStyle} />
                            {editingId !== null && (
                                <Typography sx={{ color: theme.palette.table.text, fontSize: "11px", fontStyle: "italic" }}>
                                    Change this to replace the gateway hardware. Meter history is kept.
                                </Typography>
                            )}

                            <Button
                                variant="contained" onClick={handleSubmit}
                                sx={{ backgroundColor: theme.palette.text.header_option, color: "black" }}
                            >
                                {editingId === null ? "Add" : "Save Changes"}
                            </Button>

                            {message && (
                                <Typography sx={{
                                    color: /success|found/i.test(message) ? "#3dd68c" : "#ff5c5c",
                                    fontSize: "13px",
                                }}>
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
