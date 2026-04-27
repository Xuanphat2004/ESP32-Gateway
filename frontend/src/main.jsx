import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import 'bootstrap/dist/css/bootstrap.min.css';
import { BrowserRouter as Router } from "react-router-dom";
import { AppProvider } from "./DataComponents/AppContext.jsx";

createRoot(document.getElementById("root")).render(
  <Router>
    <StrictMode>
      <AppProvider>
        <App />
      </AppProvider>
    </StrictMode>
  </Router>
);
