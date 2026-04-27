import { useState } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    const res = await fetch("http://localhost:8000/api/login/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (res.ok && data.token) {
      sessionStorage.setItem("token", data.token);
      navigate("/fleetview");
    } else {
      alert("Login failed");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.form}>
        <h2 style={styles.heading}>Đăng nhập</h2>
        <input
          style={styles.input}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Tên đăng nhập"
        />
        <input
          style={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mật khẩu"
        />
        <button style={styles.button} onClick={handleLogin}>Đăng nhập</button>
        <p style={styles.text}>
          Chưa có tài khoản?{" "}
          <span style={styles.link} onClick={() => navigate("/signup")}>
            Đăng ký
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
