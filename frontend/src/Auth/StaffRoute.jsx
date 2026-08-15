// src/Auth/StaffRoute.jsx
import { Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "./AuthContext";

export default function StaffRoute({ children }) {
  const { me, loading } = useAuth();

  // Đang chờ /api/me/ trả về — hiện spinner, tránh flash-redirect khi refresh trang
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!me) return <Navigate to="/login" replace />;
  if (!me.is_staff) return <Navigate to="/fleetview" replace />;

  return children;
}
