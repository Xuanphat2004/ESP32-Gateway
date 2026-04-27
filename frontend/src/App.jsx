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
import Signup from "./Auth/Signup";
import { useEffect } from "react"; // đảm bảo bạn đã import

import BudgetProductionInput from "./OptionComponents/BudgetProductionInput";
import BudgetGridInjectInput from "./OptionComponents/BudgetGridInjectInput";
import BudgetIsolutionInput   from "./OptionComponents/BudgetIsolutionInput";

import { ThemeModeProvider } from "./themeContex";

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
          <Route path="fleetview"   element={<FleetView />} /> 
          <Route path="sitelist"    element={<SiteList />} />
          <Route path="leaderboard" element={<LeaderBoard />} />

          <Route path="/siteview/20" element={<SiteView />} />
          <Route path="/siteview/"   element={<SiteView />} />
          <Route path="/devicelist/" element={<DeviceList />} />
          <Route path="/sitekpi"     element={<SiteKPI />} />

          <Route path="/activealarm" element={<ActiveAlarm />} />
          <Route path="/alarmsnooze" element={<AlarmSnooze />} />
          <Route path="/alarmlog"    element={<AlarmLog />} />
          <Route path="/alarmconfig" element={<AlarmConfig />} />
          <Route path="/alarmsubscription" element={<AlarmSubscription />} />

          <Route path="/topologyanalysis" element={<Topology />} />
          <Route path="/availability"     element={<Availability />} />
          <Route path="/chartingtool"     element={<ChartingTool />} />

          <Route path="/sitereport"       element={<SiteReport />} />
          <Route path="/devicereport"     element={<DeviceReport />} />
          <Route path="/productionreport" element={<ProductionReport />} />
          <Route path="/operationreport"  element={<OperationReport />} />

          <Route path="/dataexport" element={<DataExport />} />

          <Route path ="/budgetproductioninput" element = {<BudgetProductionInput />} />
          <Route path ="/budgetisolutioninput"  element = {<BudgetIsolutionInput />} />
          <Route path ="/budgetgridinjectinput" element = {<BudgetGridInjectInput />} />

          <Route path ="/about" element = {<About />} />

        </Route>
      </Routes>
    </ThemeModeProvider>
  );
}

export default App;
