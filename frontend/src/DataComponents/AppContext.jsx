import { createContext, useContext, useState } from "react";

// Tạo context
const AppContext = createContext();

// Provider bọc toàn app
export const AppProvider = ({ children }) => {
  const [siteList, setSiteList] = useState([]);

  return (
    <AppContext.Provider value={{ siteList, setSiteList }}>
      {children}
    </AppContext.Provider>
  );
};

// Hook để dùng context
export const useAppContext = () => useContext(AppContext);
