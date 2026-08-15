// src/Auth/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getData } from "../ApiComponent/api";

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  // Khởi tạo từ sessionStorage để refresh trang giữa lúc đang impersonate không mất banner
  const [isImpersonating, setIsImpersonating] = useState(() => !!sessionStorage.getItem("adminToken"));

  // refreshMe được export ra ngoài vì SPA navigation không remount lại Provider —
  // Login.jsx / Navbar.jsx (logout) phải tự gọi lại để cập nhật "me" ngay lập tức
  const refreshMe = useCallback(async () => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      setMe(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await getData("/api/me/");
    setMe(data); // getData trả về null nếu lỗi (401/network) — coi như chưa đăng nhập
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  // Admin bấm "View as user" — cất token thật của admin lại, dùng token của user đích thay thế
  const enterImpersonation = useCallback(async (targetToken) => {
    sessionStorage.setItem("adminToken", sessionStorage.getItem("token"));
    sessionStorage.setItem("token", targetToken);
    setIsImpersonating(true);
    await refreshMe();
  }, [refreshMe]);

  // Thoát impersonation — khôi phục lại token thật của admin
  const exitImpersonation = useCallback(async () => {
    const adminToken = sessionStorage.getItem("adminToken");
    if (adminToken) sessionStorage.setItem("token", adminToken);
    sessionStorage.removeItem("adminToken");
    setIsImpersonating(false);
    await refreshMe();
  }, [refreshMe]);

  return (
    <AuthContext.Provider value={{ me, loading, refreshMe, isImpersonating, enterImpersonation, exitImpersonation }}>
      {children}
    </AuthContext.Provider>
  );
}
