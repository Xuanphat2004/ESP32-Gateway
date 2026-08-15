// import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';

// import FleetView from './OptionComponents/FleetView';
// import SiteList from './OptionComponents/SiteList';
// import LeaderBoard from './OptionComponents/LeaderBoard';
// import PersistentDrawerLeft from './OptionComponents/Navbar';
// import SiteView from './OptionComponents/SiteView';

// function App() {
//   return (

//       <Routes>
//           <Route path="/" element={<PersistentDrawerLeft />}>
//             <Route path="fleetview" element={<FleetView />} />
//             <Route path="sitelist" element={<SiteList />} />
//             <Route path="leaderboard" element={<LeaderBoard />} />
//             <Route path="/siteview/20" element={<SiteView />} />
//             <Route path="/siteview/" element={<SiteView />} />
//           </Route>
//       </Routes>
//   );
// }

// export default App;

// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import FleetView from "./OptionComponents/FleetView";
import SiteList from "./OptionComponents/SiteList";
import LeaderBoard from "./OptionComponents/LeaderBoard";
import PersistentDrawerLeft from "./OptionComponents/Navbar";
import SiteView from "./OptionComponents/SiteView";
import DeviceList from "./OptionComponents/DeviceList";
import Topology from "./OptionComponents/Topology";
import SiteKPI from "./OptionComponents/SiteKPI";
import ChartingTool from "./OptionComponents/ChartingTool";
import Availability from "./OptionComponents/Availability";
import OperationReport from "./OptionComponents/OperationReport";
import SiteReport from "./OptionComponents/SiteReport";
import DeviceReport from "./OptionComponents/DeviceReport";
import ProductionReport from "./OptionComponents/ProductionReport";
import DataExport from "./OptionComponents/DataExport";
import ActiveAlarm from "./OptionComponents/ActiveAlarm";
import AlarmSnooze from "./OptionComponents/AlarmSnooze";
import AlarmLog from "./OptionComponents/AlarmLog";
import AlarmSubscription from "./OptionComponents/AlarmSubscription";
import AlarmConfig from "./OptionComponents/AlarmConfig";
import About from "./OptionComponents/About";
import Login from "./Auth/Login";
import PrivateRoute from "./Auth/PrivateRoute";
import StaffRoute from "./Auth/StaffRoute";
import Signup from "./Auth/Signup";
import { useEffect } from "react"; // đảm bảo bạn đã import

import BudgetProductionInput from "./OptionComponents/BudgetProductionInput";
import BudgetGridInjectInput from "./OptionComponents/BudgetGridInjectInput";
import BudgetIsolutionInput   from "./OptionComponents/BudgetIsolutionInput";
import AdminUsers from "./OptionComponents/AdminUsers";

import { ThemeModeProvider } from "./themeContex";
import { AuthProvider } from "./Auth/AuthContext";
import AdminViewGate from "./Auth/AdminViewGate";

function App() {
    useEffect(() => {
    const handleUnload = () => {
      localStorage.removeItem("token");
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);
  return (
    <ThemeModeProvider>
      <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup/>}/>

        {/* Bọc layout và toàn bộ route con bên trong PrivateRoute */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <PersistentDrawerLeft />
            </PrivateRoute>
          }
        >
          {/*Khi người dùng nhập một URL có đường dẫn tương đối là /fleetview, React Router sẽ render (hiển thị) component có tên là FleetView vào giao diện người dùng (UI).*/}
          {/* Các trang có dữ liệu thật theo user → bọc AdminViewGate: admin sẽ thấy danh sách chọn user thay vì trang trống */}
          <Route path="fleetview"   element={<AdminViewGate><FleetView /></AdminViewGate>} />
          <Route path="sitelist"    element={<AdminViewGate><SiteList /></AdminViewGate>} />
          <Route path="leaderboard" element={<AdminViewGate><LeaderBoard /></AdminViewGate>} />

          <Route path="/siteview/20" element={<AdminViewGate><SiteView /></AdminViewGate>} />
          <Route path="/siteview/"   element={<AdminViewGate><SiteView /></AdminViewGate>} />
          <Route path="/devicelist/" element={<AdminViewGate><DeviceList /></AdminViewGate>} />
          <Route path="/sitekpi"     element={<AdminViewGate><SiteKPI /></AdminViewGate>} />

          <Route path="/activealarm" element={<ActiveAlarm />} />
          <Route path="/alarmsnooze" element={<AdminViewGate><AlarmSnooze /></AdminViewGate>} />
          <Route path="/alarmlog"    element={<AlarmLog />} />
          <Route path="/alarmconfig" element={<AlarmConfig />} />
          <Route path="/alarmsubscription" element={<AlarmSubscription />} />

          <Route path="/topologyanalysis" element={<Topology />} />
          <Route path="/availability"     element={<Availability />} />
          <Route path="/chartingtool"     element={<AdminViewGate><ChartingTool /></AdminViewGate>} />

          <Route path="/sitereport"       element={<SiteReport />} />
          <Route path="/devicereport"     element={<DeviceReport />} />
          <Route path="/productionreport" element={<ProductionReport />} />
          <Route path="/operationreport"  element={<OperationReport />} />

          <Route path="/dataexport" element={<DataExport />} />

          <Route path ="/budgetproductioninput" element = {<BudgetProductionInput />} />
          <Route path ="/budgetisolutioninput"  element = {<BudgetIsolutionInput />} />
          <Route path ="/budgetgridinjectinput" element = {<BudgetGridInjectInput />} />

          <Route path ="/about" element = {<About />} />

          <Route path="/admin/users" element={<StaffRoute><AdminUsers /></StaffRoute>} />

        </Route>
      </Routes>
      </AuthProvider>
    </ThemeModeProvider>
  );
}

export default App;
