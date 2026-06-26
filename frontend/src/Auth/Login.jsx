import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";

export default function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");  // thêm state thông báo lỗi
    const navigate = useNavigate();

    const handleLogin = async () => {
        try { 
            // Login dùng fetch thẳng vì chưa có token để gắn — mục đích của login chính là để nhận token về 
            const res = await fetch(`${API_BASE}/api/login/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (res.ok && data.token) {
                sessionStorage.setItem("token", data.token);
                navigate("/fleetview");
            } else {
                setMessage(data.error || "Login failed"); // hiển thị lỗi cụ thể
            }

        } catch (error) {
            // Bắt lỗi khi không kết nối được server
            setMessage("Can't connect to server, Please try again !!!");
            console.error(error);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.form}>
                <h2 style={styles.heading}>Login to Dashboard</h2>
                <input
                    style={styles.input}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                />
                <input
                    style={styles.input}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                />
                <button style={styles.button} onClick={handleLogin}>
                    Login
                </button>

                {/* Hiển thị thông báo lỗi nếu có */}
                {message && (
                    <p style={{ color: "red", textAlign: "center" }}>
                        {message}
                    </p>
                )}

                <p style={styles.text}>
                    Don't have an account ?{" "}
                    <span style={styles.link} onClick={() => navigate("/signup")}>
                        Sign Up
                    </span>
                </p>
            </div>
        </div>
    );
}

const styles = {
  container: {
    height: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f5f5f5",
  },
  form: {
    height: "auto",
    padding: "30px",
    borderRadius: "10px",
    background: "white",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    display: "flex",
    flexDirection: "column",
    gap: "15px",
    width: "500px",
  },
  heading: {
    marginBottom: "10px",
    textAlign: "center",
    color: "#333",
  },
  input: {
    padding: "10px",
    fontSize: "14px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    outline: "none",
  },
  button: {
    padding: "10px",
    backgroundColor: "#1976d2",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  text: {
    textAlign: "center",
    fontSize: "14px",
    color: "#555",
  },
  link: {
    color: "#1976d2",
    cursor: "pointer",
    textDecoration: "underline",
  },
};
