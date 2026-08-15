import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box, Typography, Button, IconButton, Chip, TextField, InputAdornment,
  Table, TableHead, TableBody, TableRow, TableCell, CircularProgress, Tooltip,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import SearchIcon        from "@mui/icons-material/Search";
import PersonAddIcon     from "@mui/icons-material/PersonAdd";
import EditIcon          from "@mui/icons-material/Edit";
import VpnKeyIcon        from "@mui/icons-material/VpnKey";
import BlockIcon         from "@mui/icons-material/Block";
import CheckCircleIcon   from "@mui/icons-material/CheckCircle";
import HistoryIcon       from "@mui/icons-material/History";
import LoginIcon         from "@mui/icons-material/Login";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import { getData } from "../ApiComponent/api";
import { useAuth } from "../Auth/AuthContext";
import AxiosInstance from "../Axios";
import {
  CreateUserDialog, EditUserDialog, ResetPasswordDialog, DeactivateConfirmDialog, DeleteUserDialog,
} from "./AdminUserDialogs";
import AdminUserDetail from "./AdminUserDetail";

// "2026-07-27T02:44:14.712Z" → "27/07/2026 09:44"
const formatTs = (ts) => {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function AdminUsers() {
  const theme  = useTheme();
  const accent = theme.palette.text.header_option      || "#08ffff";
  const panelBg = theme.palette.background.box          || "#0d1b2a";
  const headBg  = theme.palette.background.head_box     || "#0a1628";
  const divClr  = theme.palette.divider                 || "#1f2d3a";
  const rowOdd  = theme.palette.table?.background_odd   || "#0d1b2a";
  const rowEven = theme.palette.table?.background_even  || "#0f1f2e";

  const { me, enterImpersonation } = useAuth();
  const navigate = useNavigate();

  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");

  const [createOpen,  setCreateOpen]  = useState(false);
  const [editUser,    setEditUser]    = useState(null);
  const [resetUser,   setResetUser]   = useState(null);
  const [toggleUser,  setToggleUser]  = useState(null);
  const [detailUser,  setDetailUser]  = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [impersonating, setImpersonating] = useState(null); // user_id đang gọi impersonate (disable nút khi đang chờ)

  // "View as user" — dùng AxiosInstance trực tiếp để đọc được lỗi cụ thể từ backend, giống AdminUserDialogs.jsx
  const handleViewAs = async (u) => {
    setImpersonating(u.id);
    try {
      const res = await AxiosInstance.post(`/api/admin/users/${u.id}/impersonate/`);
      await enterImpersonation(res.data.token);
      navigate("/fleetview");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to view as this user.");
    } finally {
      setImpersonating(null);
    }
  };

  // silent=true dùng cho polling nền — không hiện spinner để khỏi giật màn hình mỗi 30s
  const fetchUsers = useCallback(async (opts = {}) => {
    if (!opts.silent) setLoading(true);
    const data = await getData("/api/admin/users/");
    setUsers(Array.isArray(data) ? data : []);
    if (!opts.silent) setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Poll nền mỗi 30s để cột Online tự cập nhật mà không cần bấm gì
  useEffect(() => {
    const t = setInterval(() => fetchUsers({ silent: true }), 30_000);
    return () => clearInterval(t);
  }, [fetchUsers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      u.username.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q));
  }, [users, search]);

  // Cập nhật 1 user trong list tại chỗ (sau edit/reset/toggle) — tránh phải fetch lại toàn bộ
  const patchUserInList = (updated) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
  };

  // Xoá hẳn 1 user khỏi list sau khi backend xác nhận đã delete
  const removeUserFromList = (deletedId) => {
    setUsers((prev) => prev.filter((u) => u.id !== deletedId));
  };

  const HeadCell = ({ children, align }) => (
    <TableCell align={align} sx={{ backgroundColor: headBg, color: accent, fontWeight: 700, fontSize: 11,
                     letterSpacing: 0.5, borderBottom: `1px solid ${divClr}`, whiteSpace: "nowrap" }}>
      {children}
    </TableCell>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", p: 2, gap: 1.5, overflow: "hidden" }}>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <AdminPanelSettingsIcon sx={{ color: accent, fontSize: 24 }} />
        <Typography sx={{ color: accent, fontWeight: 700, fontSize: 18 }}>User Management</Typography>
      </Box>

      {/* Toolbar */}
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
        <TextField
          size="small" placeholder="Search username or email..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start"><SearchIcon sx={{ color: "#546e7a", fontSize: 18 }} /></InputAdornment>
            ),
          }}
          sx={{ width: 300, backgroundColor: headBg, "& .MuiOutlinedInput-notchedOutline": { borderColor: divClr } }}
        />
        <Typography sx={{ color: theme.palette.text.secondary, fontSize: 12 }}>
          {filtered.length} user{filtered.length !== 1 ? "s" : ""}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="contained" startIcon={<PersonAddIcon />} onClick={() => setCreateOpen(true)}
          sx={{ backgroundColor: accent, color: "#000", fontWeight: 700,
                "&:hover": { backgroundColor: accent, opacity: 0.85 } }}>
          Create User
        </Button>
      </Box>

      {/* Table */}
      <Box sx={{
        flex: 1, overflow: "auto", backgroundColor: panelBg,
        border: `1px solid ${divClr}`, borderRadius: 1,
      }}>
        {loading ? (
          <Box sx={{ py: 6, textAlign: "center" }}><CircularProgress size={28} /></Box>
        ) : filtered.length === 0 ? (
          <Typography sx={{ color: theme.palette.text.secondary, fontSize: 13, py: 6, textAlign: "center" }}>
            No users found.
          </Typography>
        ) : (
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <HeadCell>Username</HeadCell>
                <HeadCell>Email</HeadCell>
                <HeadCell align="center">Role</HeadCell>
                <HeadCell align="center">Status</HeadCell>
                <HeadCell align="center">Online</HeadCell>
                <HeadCell align="center">Sites</HeadCell>
                <HeadCell>Last Login</HeadCell>
                <HeadCell>Joined</HeadCell>
                <HeadCell align="right">Actions</HeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((u, i) => {
                const isSelf = me?.id === u.id;
                return (
                  <TableRow key={u.id} sx={{ backgroundColor: i % 2 === 0 ? rowOdd : rowEven }}>
                    <TableCell sx={{ fontSize: 12, fontWeight: 600, borderBottom: `1px solid ${divClr}` }}>
                      {u.username}{isSelf && (
                        <Typography component="span" sx={{ color: "#546e7a", fontSize: 10, ml: 0.6 }}>(you)</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, borderBottom: `1px solid ${divClr}` }}>{u.email || "—"}</TableCell>
                    <TableCell align="center" sx={{ borderBottom: `1px solid ${divClr}` }}>
                      {u.is_staff ? (
                        <Chip label="Admin" size="small" sx={{
                          backgroundColor: "#1a237e", color: "#8c9eff", fontWeight: 700, fontSize: 10, height: 20,
                          border: "1px solid #3949ab",
                        }} />
                      ) : (
                        <Chip label="User" size="small" sx={{
                          backgroundColor: "transparent", color: "#546e7a", fontSize: 10, height: 20,
                          border: "1px solid #37474f",
                        }} />
                      )}
                    </TableCell>
                    <TableCell align="center" sx={{ borderBottom: `1px solid ${divClr}` }}>
                      <Chip label={u.is_active ? "Active" : "Inactive"} size="small" sx={{
                        backgroundColor: u.is_active ? "#1b5e20" : "#7f0000",
                        color: u.is_active ? "#69f0ae" : "#ef9a9a",
                        fontWeight: 700, fontSize: 10, height: 20,
                        border: `1px solid ${u.is_active ? "#2e7d32" : "#c62828"}`,
                      }} />
                    </TableCell>
                    <TableCell align="center" sx={{ borderBottom: `1px solid ${divClr}` }}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.6 }}>
                        <Box sx={{
                          width: 8, height: 8, borderRadius: "50%",
                          backgroundColor: u.is_online ? "#4caf50" : "#546e7a",
                          boxShadow: u.is_online ? "0 0 5px #4caf50" : "none",
                        }} />
                        <Typography sx={{ fontSize: 11, color: u.is_online ? "#69f0ae" : theme.palette.text.secondary }}>
                          {u.is_online ? "Online" : "Offline"}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center" sx={{ fontSize: 12, borderBottom: `1px solid ${divClr}` }}>
                      {u.site_count ?? 0}
                    </TableCell>
                    <TableCell sx={{ fontSize: 11, color: "#90a4ae", borderBottom: `1px solid ${divClr}`, whiteSpace: "nowrap" }}>
                      {formatTs(u.last_login)}
                    </TableCell>
                    <TableCell sx={{ fontSize: 11, color: "#90a4ae", borderBottom: `1px solid ${divClr}`, whiteSpace: "nowrap" }}>
                      {formatTs(u.date_joined)}
                    </TableCell>
                    <TableCell align="right" sx={{ borderBottom: `1px solid ${divClr}` }}>
                      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.3 }}>
                        <Tooltip title={!u.is_active ? "Cannot view as a deactivated user" : "View as this user"}>
                          <span>
                            <IconButton size="small" disabled={!u.is_active || impersonating === u.id}
                              onClick={() => handleViewAs(u)}
                              sx={{ color: "#546e7a", "&:hover": { color: "#ff9800" } }}>
                              <LoginIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Sites & login history">
                          <IconButton size="small" onClick={() => setDetailUser(u)}
                            sx={{ color: "#546e7a", "&:hover": { color: accent } }}>
                            <HistoryIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => setEditUser(u)}
                            sx={{ color: "#546e7a", "&:hover": { color: accent } }}>
                            <EditIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reset password">
                          <IconButton size="small" onClick={() => setResetUser(u)}
                            sx={{ color: "#546e7a", "&:hover": { color: "#42a5f5" } }}>
                            <VpnKeyIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={isSelf ? "You cannot deactivate your own account" : (u.is_active ? "Deactivate" : "Reactivate")}>
                          <span>
                            <IconButton size="small" disabled={isSelf} onClick={() => setToggleUser(u)}
                              sx={{ color: "#546e7a", "&:hover": { color: u.is_active ? "#f44336" : "#4caf50" } }}>
                              {u.is_active
                                ? <BlockIcon sx={{ fontSize: 16 }} />
                                : <CheckCircleIcon sx={{ fontSize: 16 }} />}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={isSelf ? "You cannot delete your own account" : "Delete permanently"}>
                          <span>
                            <IconButton size="small" disabled={isSelf} onClick={() => setDeleteTarget(u)}
                              sx={{ color: "#546e7a", "&:hover": { color: "#f44336" } }}>
                              <DeleteForeverIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Box>

      {/* Dialogs */}
      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onDone={() => fetchUsers()} />
      <EditUserDialog open={!!editUser} onClose={() => setEditUser(null)} user={editUser}
        isSelf={me?.id === editUser?.id} onDone={patchUserInList} />
      <ResetPasswordDialog open={!!resetUser} onClose={() => setResetUser(null)} user={resetUser} />
      <DeactivateConfirmDialog open={!!toggleUser} onClose={() => setToggleUser(null)} user={toggleUser}
        onDone={patchUserInList} />
      <DeleteUserDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} user={deleteTarget}
        onDone={removeUserFromList} />
      <AdminUserDetail open={!!detailUser} onClose={() => setDetailUser(null)} user={detailUser} />
    </Box>
  );
}
