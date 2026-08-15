import { useState, useEffect } from "react";
import {
  Box, Typography, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControlLabel, Checkbox,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import PersonAddIcon    from "@mui/icons-material/PersonAdd";
import EditIcon         from "@mui/icons-material/Edit";
import VpnKeyIcon       from "@mui/icons-material/VpnKey";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import CloseIcon        from "@mui/icons-material/Close";
import AxiosInstance from "../Axios";

// Gọi trực tiếp AxiosInstance (thay vì postData) để đọc được message lỗi cụ thể
// từ backend (vd "Username already taken") — postData/getData nuốt hết lỗi và trả null.
async function submitAdmin(method, url, data) {
  try {
    const res = await AxiosInstance[method](url, data);
    return { ok: true, data: res.data };
  } catch (err) {
    const msg = err.response?.data?.error;
    return { ok: false, error: Array.isArray(msg) ? msg.join(" ") : (msg || "Request failed. Please try again.") };
  }
}

// ── Header dùng chung cho các dialog — icon + tiêu đề + nút đóng ──────────────
function DialogHeader({ icon, title, subtitle, onClose, color }) {
  const theme  = useTheme();
  const accent = color || theme.palette.text.header_option || "#08ffff";
  const headBg = theme.palette.background.head_box || "#0a1628";
  const divClr = theme.palette.divider || "#1f2d3a";
  return (
    <DialogTitle sx={{ p: 0 }}>
      <Box sx={{
        backgroundColor: headBg, px: 2.5, py: 1.5,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: `1px solid ${divClr}`,
      }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
          {icon}
          <Box>
            <Typography sx={{ color: accent, fontWeight: 700, fontSize: 15 }}>{title}</Typography>
            {subtitle && (
              <Typography sx={{ color: theme.palette.text.secondary, fontSize: 11 }}>{subtitle}</Typography>
            )}
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small"
          sx={{ color: theme.palette.text.secondary, "&:hover": { color: theme.palette.text.primary } }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </DialogTitle>
  );
}

const dialogPaperSx = (theme) => ({
  backgroundColor: theme.palette.background.box || "#0d1b2a",
  border: `1px solid ${theme.palette.divider || "#1f2d3a"}`,
  borderRadius: 2,
  backgroundImage: "none",
});

// ══════════════════════════════════════════════════════════════════════════════
// CREATE USER
// ══════════════════════════════════════════════════════════════════════════════
export function CreateUserDialog({ open, onClose, onDone }) {
  const theme  = useTheme();
  const accent = theme.palette.text.header_option || "#08ffff";
  const [username, setUsername] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [isStaff,  setIsStaff]  = useState(false);
  const [error,    setError]    = useState("");
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (open) {
      setUsername(""); setEmail(""); setPassword(""); setIsStaff(false); setError(""); setSaving(false);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!username || !password) { setError("Username and password are required."); return; }
    setSaving(true);
    const res = await submitAdmin("post", "/api/admin/users/create/", {
      username, email, password, is_staff: isStaff,
    });
    setSaving(false);
    if (!res.ok) { setError(res.error); return; }
    onDone(res.data);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: dialogPaperSx(theme) }}>
      <DialogHeader icon={<PersonAddIcon sx={{ color: accent, fontSize: 20 }} />}
        title="Create User" onClose={onClose} />
      <DialogContent sx={{ pt: 2.5, display: "flex", flexDirection: "column", gap: 1.8 }}>
        <TextField label="Username" size="small" fullWidth value={username}
          onChange={(e) => setUsername(e.target.value)} autoFocus />
        <TextField label="Email" size="small" fullWidth value={email}
          onChange={(e) => setEmail(e.target.value)} />
        <TextField label="Password" size="small" fullWidth type="password" value={password}
          onChange={(e) => setPassword(e.target.value)} />
        <FormControlLabel
          control={<Checkbox checked={isStaff} onChange={(e) => setIsStaff(e.target.checked)}
            sx={{ color: "#546e7a", "&.Mui-checked": { color: accent } }} />}
          label={<Typography fontSize={13}>Grant admin access (is_staff)</Typography>}
        />
        {error && <Typography sx={{ color: "#f44336", fontSize: 12 }}>{error}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button size="small" onClick={onClose} sx={{ color: theme.palette.text.secondary }}>Cancel</Button>
        <Button size="small" variant="contained" disabled={saving} onClick={handleCreate}
          sx={{ backgroundColor: accent, color: "#000", fontWeight: 700,
                "&:hover": { backgroundColor: accent, opacity: 0.85 } }}>
          {saving ? "Creating..." : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EDIT USER
// ══════════════════════════════════════════════════════════════════════════════
export function EditUserDialog({ open, onClose, onDone, user, isSelf }) {
  const theme  = useTheme();
  const accent = theme.palette.text.header_option || "#08ffff";
  const [username, setUsername] = useState("");
  const [email,    setEmail]    = useState("");
  const [isStaff,  setIsStaff]  = useState(false);
  const [error,    setError]    = useState("");
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (open && user) {
      setUsername(user.username || "");
      setEmail(user.email || "");
      setIsStaff(!!user.is_staff);
      setError(""); setSaving(false);
    }
  }, [open, user]);

  if (!user) return null;

  const handleSave = async () => {
    if (!username) { setError("Username is required."); return; }
    setSaving(true);
    const res = await submitAdmin("post", `/api/admin/users/${user.id}/update/`, {
      username, email, is_staff: isStaff,
    });
    setSaving(false);
    if (!res.ok) { setError(res.error); return; }
    onDone(res.data);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: dialogPaperSx(theme) }}>
      <DialogHeader icon={<EditIcon sx={{ color: accent, fontSize: 20 }} />}
        title="Edit User" subtitle={`#${user.id}`} onClose={onClose} />
      <DialogContent sx={{ pt: 2.5, display: "flex", flexDirection: "column", gap: 1.8 }}>
        <TextField label="Username" size="small" fullWidth value={username}
          onChange={(e) => setUsername(e.target.value)} autoFocus />
        <TextField label="Email" size="small" fullWidth value={email}
          onChange={(e) => setEmail(e.target.value)} />
        <FormControlLabel
          control={<Checkbox checked={isStaff} disabled={isSelf}
            onChange={(e) => setIsStaff(e.target.checked)}
            sx={{ color: "#546e7a", "&.Mui-checked": { color: accent } }} />}
          label={
            <Typography fontSize={13} color={isSelf ? theme.palette.text.secondary : undefined}>
              Admin access (is_staff){isSelf ? " — cannot change your own" : ""}
            </Typography>
          }
        />
        {error && <Typography sx={{ color: "#f44336", fontSize: 12 }}>{error}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button size="small" onClick={onClose} sx={{ color: theme.palette.text.secondary }}>Cancel</Button>
        <Button size="small" variant="contained" disabled={saving} onClick={handleSave}
          sx={{ backgroundColor: accent, color: "#000", fontWeight: 700,
                "&:hover": { backgroundColor: accent, opacity: 0.85 } }}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RESET PASSWORD
// ══════════════════════════════════════════════════════════════════════════════
export function ResetPasswordDialog({ open, onClose, user }) {
  const theme  = useTheme();
  const accent = "#42a5f5";
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState(false);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (open) { setPassword(""); setError(""); setSuccess(false); setSaving(false); }
  }, [open]);

  if (!user) return null;

  const handleReset = async () => {
    if (!password) { setError("New password is required."); return; }
    setSaving(true);
    const res = await submitAdmin("post", `/api/admin/users/${user.id}/reset-password/`, {
      new_password: password,
    });
    setSaving(false);
    if (!res.ok) { setError(res.error); return; }
    setSuccess(true);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: dialogPaperSx(theme) }}>
      <DialogHeader icon={<VpnKeyIcon sx={{ color: accent, fontSize: 20 }} />}
        title="Reset Password" subtitle={user.username} onClose={onClose} color={accent} />
      <DialogContent sx={{ pt: 2.5, display: "flex", flexDirection: "column", gap: 1.8 }}>
        {success ? (
          <Typography sx={{ color: "#4caf50", fontSize: 13 }}>
            Password reset successfully for {user.username}.
          </Typography>
        ) : (
          <>
            <TextField label="New password" size="small" fullWidth type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} autoFocus />
            {error && <Typography sx={{ color: "#f44336", fontSize: 12 }}>{error}</Typography>}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button size="small" onClick={onClose} sx={{ color: theme.palette.text.secondary }}>
          {success ? "Close" : "Cancel"}
        </Button>
        {!success && (
          <Button size="small" variant="contained" disabled={saving} onClick={handleReset}
            sx={{ backgroundColor: accent, color: "#000", fontWeight: 700,
                  "&:hover": { backgroundColor: accent, opacity: 0.85 } }}>
            {saving ? "Resetting..." : "Reset Password"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ACTIVATE / DEACTIVATE CONFIRM
// ══════════════════════════════════════════════════════════════════════════════
export function DeactivateConfirmDialog({ open, onClose, onDone, user }) {
  const theme = useTheme();
  const [error,  setError]  = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setError(""); setSaving(false); }
  }, [open]);

  if (!user) return null;
  const willActivate = !user.is_active;

  const handleConfirm = async () => {
    setSaving(true);
    const res = await submitAdmin("post", `/api/admin/users/${user.id}/set-active/`, {
      is_active: willActivate,
    });
    setSaving(false);
    if (!res.ok) { setError(res.error); return; }
    onDone(res.data);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: {
        backgroundColor: theme.palette.background.box || "#0d1b2a",
        border: `1px solid ${willActivate ? "#2e7d32" : "#c62828"}`,
        borderRadius: 2, backgroundImage: "none",
      } }}>
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{
          backgroundColor: willActivate ? "#0a1f0a" : "#1a0a0a",
          px: 2.5, py: 1.5, display: "flex", alignItems: "center", gap: 1.2,
          borderBottom: `1px solid ${willActivate ? "#2e7d32" : "#c62828"}`,
        }}>
          <WarningAmberIcon sx={{ color: willActivate ? "#4caf50" : "#f44336", fontSize: 22 }} />
          <Typography sx={{ color: willActivate ? "#4caf50" : "#f44336", fontWeight: 700, fontSize: 15 }}>
            {willActivate ? "Reactivate User" : "Deactivate User"}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 2.5 }}>
        <Typography fontSize={13} color={theme.palette.text.secondary}>
          {willActivate
            ? `"${user.username}" will be able to log in again.`
            : `"${user.username}" will no longer be able to log in. Their sites and data are kept — this is not a delete.`}
        </Typography>
        {error && <Typography sx={{ color: "#f44336", fontSize: 12, mt: 1.5 }}>{error}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button size="small" onClick={onClose} sx={{ color: theme.palette.text.secondary }}>Cancel</Button>
        <Button size="small" variant="contained" disabled={saving} onClick={handleConfirm}
          sx={{ backgroundColor: willActivate ? "#2e7d32" : "#c62828", color: "#fff", fontWeight: 700,
                "&:hover": { backgroundColor: willActivate ? "#2e7d32" : "#c62828", opacity: 0.85 } }}>
          {saving ? "Please wait..." : (willActivate ? "Reactivate" : "Deactivate")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DELETE USER PERMANENTLY — hỏi xác nhận đơn giản, không cần gõ lại username
// ══════════════════════════════════════════════════════════════════════════════
export function DeleteUserDialog({ open, onClose, onDone, user }) {
  const theme = useTheme();
  const [error,  setError]  = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setError(""); setSaving(false); }
  }, [open]);

  if (!user) return null;

  const handleDelete = async () => {
    setSaving(true);
    const res = await submitAdmin("delete", `/api/admin/users/${user.id}/delete/`);
    setSaving(false);
    if (!res.ok) { setError(res.error); return; }
    onDone(user.id);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: {
        backgroundColor: theme.palette.background.box || "#0d1b2a",
        border: "1px solid #c62828", borderRadius: 2, backgroundImage: "none",
      } }}>
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{
          backgroundColor: "#1a0a0a",
          px: 2.5, py: 1.5, display: "flex", alignItems: "center", gap: 1.2,
          borderBottom: "1px solid #c62828",
        }}>
          <DeleteForeverIcon sx={{ color: "#f44336", fontSize: 22 }} />
          <Typography sx={{ color: "#f44336", fontWeight: 700, fontSize: 15 }}>
            Delete User Permanently
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 2.5 }}>
        <Typography fontSize={13} color={theme.palette.text.secondary}>
          Delete <b>"{user.username}"</b> permanently? This cannot be undone — all of their sites,
          meters, card configs and login history will be deleted too. If you just want to block
          their access, use <b>Deactivate</b> instead.
        </Typography>
        {error && <Typography sx={{ color: "#f44336", fontSize: 12, mt: 1.5 }}>{error}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button size="small" onClick={onClose} sx={{ color: theme.palette.text.secondary }}>Cancel</Button>
        <Button size="small" variant="contained" disabled={saving} onClick={handleDelete}
          sx={{ backgroundColor: "#c62828", color: "#fff", fontWeight: 700,
                "&:hover": { backgroundColor: "#c62828", opacity: 0.85 } }}>
          {saving ? "Deleting..." : "Delete Permanently"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
