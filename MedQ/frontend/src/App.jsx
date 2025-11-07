import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import PatientCheckIn from "./pages/PatientCheckIn.jsx";

function StaffLogin() {
  return <div className="text-white p-6">Login coming soon....</div>;
}


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/patient-checkin" element={<PatientCheckIn />} />
        <Route path="/login" element={<StaffLogin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;