import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import PatientCheckIn from "./pages/PatientCheckIn.jsx";
import StaffLogin from "./pages/StaffLogin.jsx";
import QueueStatus from "./pages/QueueStatus.jsx";
import StaffDashboard from "./pages/StaffDashboard.jsx";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/patient-checkin" element={<PatientCheckIn />} />
        <Route path="/staff-login" element={<StaffLogin />} />
        <Route path="/queue-status" element={<QueueStatus />} />
        <Route path="/staff-dashboard" element={<StaffDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;