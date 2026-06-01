import React, { useEffect, useState } from "react";
import { Box } from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import ThermometerGaugeSVG from "../ChartComponents/ThermometerGaugeSVG";
import { getData } from "../ApiComponent/api";

// Cong suat dinh muc cua site (W) - dung de tinh RATIO. Chinh theo he thong thuc te.
const RATED_POWER_W = 1090;

// Marker hinh giot nuoc - doi mau theo trang thai chon
function makePinIcon(color = "#08ffff", selected = false) {
  const svg = `
    <svg width="${selected ? 38 : 30}" height="${selected ? 52 : 42}" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0 C6.7 0 0 6.7 0 15 C0 26 15 42 15 42 C15 42 30 26 30 15 C30 6.7 23.3 0 15 0 Z"
            fill="${color}" stroke="#ffffff" stroke-width="${selected ? 2.5 : 2}"/>
      <circle cx="15" cy="15" r="5.5" fill="#ffffff"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "site-pin-icon",
    iconSize:    selected ? [38, 52] : [30, 42],
    iconAnchor:  selected ? [19, 52] : [15, 42],
    popupAnchor: [0, selected ? -48 : -38],
  });
}

// Tu dong zoom/can ban do de thay het marker (chi chay lan dau khi co site)
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15);
    } else if (points.length > 1) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length]);
  return null;
}

export default function MyFleetView() {
  const navigate = useNavigate();
  const [sites, setSites]               = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [weather, setWeather]           = useState(null);   // {temp, humidity, irradiance}
  const [summary, setSummary]           = useState(null);   // {total_energy, total_power}

  const DEFAULT_CENTER = [10.7726, 106.6577]; // DH Bach Khoa TP.HCM

  // Lay danh sach site (1 lan khi mount)
  useEffect(() => {
    const fetchSites = async () => {
      const data = await getData("/solardb/get-my-sites/");
      if (data) {
        setSites(data);
        const first = data.find((s) => s.latitude != null && s.longitude != null);
        if (first) setSelectedSite(first);
      }
    };
    fetchSites();
  }, []);

  // Khi doi site duoc chon -> lay thoi tiet + tong nang luong
  useEffect(() => {
    if (!selectedSite) return;
    let cancelled = false;

    // 1) Thoi tiet tu Open-Meteo (mien phi, khong can key)
    const fetchWeather = async () => {
      if (selectedSite.latitude == null || selectedSite.longitude == null) {
        setWeather(null);
        return;
      }
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${selectedSite.latitude}&longitude=${selectedSite.longitude}&current=temperature_2m,relative_humidity_2m,shortwave_radiation`;
        const res  = await fetch(url);
        const json = await res.json();
        if (!cancelled && json && json.current) {
          setWeather({
            temp:       json.current.temperature_2m,
            humidity:   json.current.relative_humidity_2m,
            irradiance: json.current.shortwave_radiation,
          });
        }
      } catch (e) {
        if (!cancelled) setWeather(null);
        console.error("Weather fetch error:", e);
      }
    };

    // 2) Tong nang luong + cong suat cua site (backend)
    const fetchSummary = async () => {
      try {
        const data = await getData(`/solardb/get-site-summary/${selectedSite.site_id}/`);
        if (!cancelled && data && !data.error) setSummary(data);
      } catch (e) {
        console.error("Summary fetch error:", e);
      }
    };

    fetchWeather();
    fetchSummary();

    const wInterval = setInterval(fetchWeather, 5 * 60 * 1000); // 5 phut
    const sInterval = setInterval(fetchSummary, 10 * 1000);     // 10 giay

    return () => {
      cancelled = true;
      clearInterval(wInterval);
      clearInterval(sInterval);
    };
  }, [selectedSite]);

  // Cac site co toa do hop le de ve marker
  const sitePoints = sites
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ ...s, lat: Number(s.latitude), lng: Number(s.longitude) }))
    .filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lng));

  // Tinh gia tri 4 o
  const totalEnergy = summary && summary.total_energy != null ? Number(summary.total_energy).toFixed(1) : "--";
  const irradiance  = weather && weather.irradiance != null ? Number(weather.irradiance).toFixed(1) : "--";
  const temperature = weather && weather.temp != null ? Number(weather.temp).toFixed(1) : "--";
  const ratio       = summary && summary.total_power != null
    ? ((Number(summary.total_power) / RATED_POWER_W) * 100).toFixed(1)
    : "--";

  const locationLabel = selectedSite
    ? `${selectedSite.site_name} - ${selectedSite.location || ""}`
    : "Select a site on the map";

  return (
    <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: { xs: "column", md: "row" } }}>

      {/* MAP - Leaflet, thu phong tu do */}
      <Box sx={{ flex: 1.5, minHeight: "300px" }}>
        <MapContainer
          center={sitePoints.length > 0 ? [sitePoints[0].lat, sitePoints[0].lng] : DEFAULT_CENTER}
          zoom={13}
          scrollWheelZoom
          style={{ width: "100%", height: "100%" }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitBounds points={sitePoints} />

          {sitePoints.map((p) => {
            const isSelected = selectedSite && selectedSite.site_id === p.site_id;
            return (
              <Marker
                key={p.site_id}
                position={[p.lat, p.lng]}
                icon={makePinIcon(isSelected ? "#ffb300" : "#08ffff", isSelected)}
                eventHandlers={{ click: () => setSelectedSite(p) }}
              >
                <Popup>
                  <div style={{ minWidth: 160 }}>
                    <div style={{ fontWeight: "bold", fontSize: 14, marginBottom: 4 }}>{p.site_name}</div>
                    <div style={{ fontSize: 12, color: "#555" }}>{p.location}</div>
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Gateway: {p.gateway_id != null ? p.gateway_id : "--"}</div>
                    <button
                      onClick={() => navigate(`/devicelist?siteId=${p.site_id}`)}
                      style={{ cursor: "pointer", border: "none", borderRadius: 4, padding: "4px 10px",
                               background: "#08a0a0", color: "#fff", fontSize: 12 }}
                    >
                      View devices
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </Box>

      {/* Info Panel */}
      <Box
        sx={{
          flex: 1,
          backgroundImage: 'url("/image/solar_image.jpg")',
          backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat",
          position: "relative",
        }}
      >
        <Box sx={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                   backgroundColor: "rgba(36, 27, 13, 0.6)", zIndex: 1 }} />

        <Box sx={{ position: "relative", zIndex: 2, height: "100%", p: 2, display: "flex", flexDirection: "column" }}>

          <Box sx={{ display: "flex", justifyContent: "space-between",
                     backgroundColor: "rgba(128, 128, 128, 0.5)", p: 2, borderRadius: 1, width: "100%" }}>
            <Box sx={{ color: "#d4bfa3" }}>
              Total Site: <b style={{ color: "#08ffff", fontSize: "25px" }}>{sites.length}</b>
            </Box>
            <Box sx={{ color: "#d4bfa3" }}>Total Sites</Box>
            <Link to="/sitelist" style={{ textDecoration: "none" }}>
              <Box sx={{ color: "#d4bfa3", "&:hover": { color: "#08ffff" } }}>Site List</Box>
            </Link>
          </Box>

          {/* Location cua site DANG CHON */}
          <Box sx={{ backgroundColor: "rgba(128, 128, 128, 0.5)", p: 2, borderRadius: 1, mt: 2, color: "#d4bfa3" }}>
            Location: {locationLabel}
          </Box>

          <Box sx={{ backgroundColor: "rgba(128, 128, 128, 0.5)", p: 2, borderRadius: 1, mt: 2,
                     color: "#d4bfa3", height: "100%" }}>
            <Box sx={{ display: "flex", justifyContent: "space-around", mt: 4 }}>
              <ThermometerGaugeSVG value={totalEnergy} label="TOTAL_ENERGY" max={1000} unit="kWh" />
              <ThermometerGaugeSVG value={irradiance}  label="IRRADIANCE"   max={1200} unit="W/m²" />
            </Box>

            <Box sx={{ display: "flex", justifyContent: "space-around", mt: 4, marginTop: "120px" }}>
              <ThermometerGaugeSVG value={temperature} label="TEMPERATURE" max={50}  unit="°C" />
              <ThermometerGaugeSVG value={ratio}       label="RATIO"       max={100} unit="%" />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
