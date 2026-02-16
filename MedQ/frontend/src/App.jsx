import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import PatientCheckIn from "./pages/PatientCheckIn.jsx";
import StaffLogin from "./pages/StaffLogin.jsx";
import QueueStatus from "./pages/QueueStatus.jsx";
import StaffDashboard from "./pages/StaffDashboard.jsx";
import PatientDetails from "./pages/PatientDetails.jsx";
import StaffAnalytics from "./pages/StaffAnalytics.jsx";
import StaffManagement from "./pages/StaffManagement.jsx";
import { WebSocketProvider } from "./contexts/WebSocketContext.jsx";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";


function App() {
  return (
    <ThemeProvider>
      <WebSocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/patient-checkin" element={<PatientCheckIn />} />
            <Route path="/staff-login" element={<StaffLogin />} />
            <Route path="/queue-status" element={<QueueStatus />} />
            <Route path="/staff-dashboard" element={<StaffDashboard />} />
            <Route path="/patient-details/:id" element={<PatientDetails />} />
            <Route path="/staff-analytics" element={<StaffAnalytics />} />
            <Route path="/staff-management" element={<StaffManagement />} />
          </Routes>
        </BrowserRouter>
      </WebSocketProvider>
    </ThemeProvider>
  );
}

export default App;