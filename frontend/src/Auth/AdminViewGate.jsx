// src/Auth/AdminViewGate.jsx
// Chặn các trang dữ liệu thật (FleetView, SiteView...) khi admin chưa chọn "xem hộ" user nào —
// hiện danh sách box chọn user thay vì trang trống (admin không sở hữu site/meter nào).
import { useState, useEffect } from "react";
import { Box, Typography, CircularProgress, Chip } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import PersonIcon          from "@mui/icons-material/Person";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import { getData } from "../ApiComponent/api";
import { useAuth } from "./AuthContext";
import AxiosInstance from "../Axios";

export default function AdminViewGate({ children }) {
  const { me, loading, isImpersonating, enterImpersonation } = useAuth();
  const theme  = useTheme();
  const accent = theme.palette.text.header_option  || "#08ffff";
  const panelBg = theme.palette.background.box      || "#0d1b2a";
  const headBg  = theme.palette.background.head_box || "#0a1628";
  const divClr  = theme.palette.divider             || "#1f2d3a";

  const [users,  setUsers]  = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error,  setError]  = useState("");

  // Chỉ chặn khi: đã load xong /api/me/, là admin, VÀ hiện không đang xem hộ ai
  const shouldGate = !loading && !!me?.is_staff && !isImpersonating;

  useEffect(() => {
    if (shouldGate) {
      getData("/api/admin/users/").then((d) => setUsers(Array.isArray(d) ? d : []));
    }
  }, [shouldGate]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!shouldGate) return children;

  const handlePick = async (u) => {
    setBusyId(u.id);
    setError("");
    try {
      const res = await AxiosInstance.post(`/api/admin/users/${u.id}/impersonate/`);
      await enterImpersonation(res.data.token);
    } catch (err) {
      setError(err.response?.data?.error || `Failed to view as ${u.username}.`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Box sx={{ p: 3, height: "100%", overflowY: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, mb: 0.5 }}>
        <AdminPanelSettingsIcon sx={{ color: accent, fontSize: 22 }} />
        <Typography sx={{ color: accent, fontWeight: 700, fontSize: 17 }}>
          Select a user to view
        </Typography>
      </Box>
      <Typography sx={{ color: theme.palette.text.secondary, fontSize: 13, mb: 2.5 }}>
        You're signed in as admin — pick a user below to view and manage their data exactly as they would.
      </Typography>

      {error && (
        <Typography sx={{ color: "#f44336", fontSize: 13, mb: 2 }}>{error}</Typography>
      )}

      {users === null ? (
        <Box sx={{ py: 6, textAlign: "center" }}><CircularProgress size={28} /></Box>
      ) : users.length === 0 ? (
        <Typography sx={{ color: theme.palette.text.secondary, fontSize: 13 }}>
          No users found.
        </Typography>
      ) : (
        <Box sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 1.5,
        }}>
          {users.map((u) => {
            const disabled = !u.is_active || busyId === u.id;
            return (
              <Box
                key={u.id}
                onClick={() => !disabled && handlePick(u)}
                sx={{
                  backgroundColor: panelBg,
                  border: `1px solid ${divClr}`,
                  borderRadius: 2,
                  overflow: "hidden",
                  cursor: disabled ? "default" : "pointer",
                  opacity: !u.is_active ? 0.5 : 1,
                  transition: "border-color 0.2s",
                  "&:hover": disabled ? {} : { borderColor: accent },
                }}
              >
                <Box sx={{
                  backgroundColor: headBg, px: 2, py: 1.2,
                  display: "flex", alignItems: "center", gap: 1,
                  borderBottom: `1px solid ${divClr}`,
                }}>
                  <PersonIcon sx={{ color: accent, fontSize: 18 }} />
                  <Typography sx={{ color: theme.palette.text.primary, fontWeight: 700, fontSize: 14, flex: 1, minWidth: 0,
                                     overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.username}
                  </Typography>
                  {busyId === u.id && <CircularProgress size={14} />}
                </Box>
                <Box sx={{ px: 2, py: 1.2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Chip label={u.is_staff ? "Admin" : "User"} size="small" sx={{
                    backgroundColor: u.is_staff ? "#1a237e" : "transparent",
                    color: u.is_staff ? "#8c9eff" : "#546e7a",
                    fontSize: 10, height: 20,
                    border: `1px solid ${u.is_staff ? "#3949ab" : "#37474f"}`,
                  }} />
                  <Typography sx={{ color: theme.palette.text.secondary, fontSize: 12 }}>
                    {!u.is_active ? "Inactive" : `${u.site_count ?? 0} site${u.site_count === 1 ? "" : "s"}`}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
