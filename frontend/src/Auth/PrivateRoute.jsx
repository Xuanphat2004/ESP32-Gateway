// src/auth/PrivateRoute.jsx
import { Navigate } from "react-router-dom";

export default function PrivateRoute({ children }) {
  const token = sessionStorage.getItem("token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
