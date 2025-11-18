import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import PatientCheckIn from "./pages/PatientCheckIn.jsx";
import StaffLogin from "./pages/StaffLogin.jsx";
import QueueStatus from "./pages/QueueStatus.jsx";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/patient-checkin" element={<PatientCheckIn />} />
        <Route path="/staff-login" element={<StaffLogin />} />
        <Route path="/queue-status" element={<QueueStatus />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;