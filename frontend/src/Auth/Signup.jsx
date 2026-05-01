import { useState } from "react";
import { useNavigate } from "react-router-dom";
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

export default function Signup() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [repassword, setRepassword] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [statuspassword, setStatuspassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async () => {
    const res = await fetch("http://localhost:8000/api/signup/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, email }),
    });

    const data = await res.json();
    if (res.ok) {
      setMessage("Success! Moving to login page...");
      setTimeout(() => navigate("/login"), 2000);
    } else {
      setMessage(data.error || "Signup failed");
    }
  };

  const checkPasswordAndSignup = () => {
    if (password !== repassword) {
      setStatuspassword("Mismatch password !!!");
      setRepassword("");
      return;
    }

    setStatuspassword("Match password");
    handleSignup();
  };

  return (
    <div style={styles.container}>
      <div style={styles.form}>
        <h2 style={styles.heading}>Signup</h2>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Username</label>
          <input
            style={styles.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
          />
        </div>

        <div style={styles.inputGroup}>
          <div style={styles.labelWithIcon}>
            <label style={styles.label}>Password</label>
            <span
              style={styles.eyeIcon}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <VisibilityOffIcon sx={{color: "black", fontSize: "20px"}}/> : <VisibilityIcon sx={{color: "black", fontSize: "20px"}}/> }
            </span>
          </div>
          <input
            style={styles.input}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Repeat Password</label>
          <input
            style={styles.input}
            type={showPassword ? "text" : "password"}
            value={repassword}
            onChange={(e) => setRepassword(e.target.value)}
            placeholder="Password"
          />
        </div>

        <div style={{ color: password === repassword ? "green" : "red", textAlign: "center" }}>
          {statuspassword}
        </div>

        <button
          style={{ ...styles.button, backgroundColor: "#388e3c", }}
          onClick={checkPasswordAndSignup}
        >
          Register
        </button>

        <button
          style={{ ...styles.button, backgroundColor: "#757575" }}
          onClick={() => navigate("/login")}
        >
          Return
        </button>

        {message && (
          <p style={{ color: "#d32f2f", textAlign: "center" }}>{message}</p>
        )}
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
    textAlign: "center",
    color: "#333",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  label: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "#555",
  },
  labelWithIcon: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eyeIcon: {
    cursor: "pointer",
    fontSize: "18px",
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
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
  },
};
