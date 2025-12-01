import { useEffect, useState } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { apiRequest } from "../apiClient";

function formatDate(dateString) {
  if (!dateString) return "N/A";
  const [year, month, day] = dateString.split("-");
  return `${month}/${day}/${year}`;
}

function formatDateTime(dateString) {
  if (!dateString) return "N/A";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "N/A"
  return d.toLocaleString([], { dateStyle: "short", timeStyle: "short"});
}

function getTriageLabel(severity) {
  if (severity == null) return "N/A";
  const map = {
    1: "Level 1 - Non-urgent",
    2: "Level 2 - Less urgent",
    3: "Level 3 - Urgent",
    4: "Level 4 - Emergency",
    5: "Level 5 - Critical",
  };
  return map[severity] || `Severity ${severity}`;
}

export default function PatientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [visit, setVisit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadVisit() {
      try {
        setLoading(true)
        setError("")

        const data = await apiRequest(`/visit/${id}`);
        setVisit(data.visit);
      } catch (err) {
        console.error(err);
        setError(err.message || "Error loading patient details.");
      } finally {
        setLoading(false);
      }
    }

    loadVisit();
  }, [id]);

  const handleBack = () => {
    const fromDate = location.state?.fromDate;
    const fromDepartment = location.state?.fromDepartment;

    if (fromDate || fromDepartment) {
      navigate("/staff-dashboard", {
        state: {
          date: fromDate,
          department: fromDepartment,
        },
      });
    } else {
      navigate(-1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-medqDark to-medqDeep text-white flex justify-center">
        <div className="w-full max-w-2xl px-6 py-10">
          <button
            onClick={handleBack}
            className="text-sm mb-4 hover:underline"
          >
            ← Back to Queue
          </button>
          <p className="text-white/80">Loading patient information...</p>
        </div>
      </div>
    );
  }

  if (error || !visit) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-medqDark to-medqDeep text-white flex justify-center">
        <div className="w-full max-w-2xl px-6 py-10">
          <button
            onClick={handleBack}
            className="text-sm mb-4 hover:underline"
          >
            ← Back to Queue
          </button>
          <p className="text-red-300">
            {error || "Unable to load patient information."}
          </p>
        </div>
      </div>
    );
  }

  const triage = getTriageLabel(visit.severity);
  const dob = formatDate(visit.dob);
  const arrival = formatDateTime(visit.checkin_time);
  const serviceStart = formatDateTime(visit.service_start);
  const serviceEnd = formatDateTime(visit.service_end);

  return (
    <div className="min-h-screen bg-gradient-to-b from-medqDark to-medqDeep text-white flex justify-center">
      <div className="w-full max-w-2xl px-6 py-10">
        {/* Back + Title */}
        <button
          onClick={handleBack}
          className="text-sm mb-4 hover:underline"
        >
          ← Back to Queue
        </button>

        <h1 className="text-3xl font-bold mb-6">Patient Information</h1>

        {/* Patient Info */}
        <section className="space-y-4 text-sm leading-relaxed">
          <div>
            <p className="font-semibold">Patient Name</p>
            <p>{visit.name}</p>
            <p>{triage}</p>
            <p>{dob}</p>
            <p>{visit.phone}</p>
          </div>

          <div>
            <p className="font-semibold">Department</p>
            <p>{visit.department}</p>
          </div>

          <div>
            <p className="font-semibold">Patient Sympton Description</p>
            <p>{visit.symptoms}</p>
          </div>

          <div>
            <p className="font-semibold">Assigned Staff:</p>
            <p>Nurse Name: N/A</p> 
            <p>Nurse Name: N/A</p>
            <p>Doctor Name: N/A</p>
            <p>Patient Case Manager: N/A</p>
          </div>

          <div>
            <p className="font-semibold">Time Metrics</p>
            <p>Arrival Time: {arrival}</p>
            <p>Service Start: {serviceStart}</p>
            <p>Service End: {serviceEnd}</p>
          </div>
        </section>

        {/* Bottom Buttons */}
        <div className="mt-8 flex gap-3">
          <button className="px-6 py-2 rounded-xl bg-medqPink text-sm font-semibold shadow-md">
            Transfer
          </button>
          <button className="px-6 py-2 rounded-xl bg-medqPink text-sm font-semibold shadow-md">
            Discharge
          </button>
        </div>
      </div>
    </div>
  );
}