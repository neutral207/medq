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
  const [statusError, setStatusError] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

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
    const fromStatusFilter = location.state?.fromStatusFilter;

    if (fromDate || fromDepartment || fromStatusFilter) {
      navigate("/staff-dashboard", {
        state: {
          fromDate,
          fromDepartment,
          fromStatusFilter,
        },
      });
    } else {
      navigate(-1);
    }
  };

  async function updateStatus(newStatus) {
    if (!visit || visit.status === newStatus) return;
    setStatusError("");
    setUpdatingStatus(true);

    const previousStatus = visit.status;
    setVisit((prev) => ({ ...prev, status: newStatus }));

    try {
      await apiRequest(`/visit/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      console.error(err);
      setStatusError(err.message || "Error updating status.");
      setVisit((prev) => ({ ...prev, status: previousStatus }));
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (loading) {
    return (
      <div className="page-gradient flex justify-center">
        <div className="w-full container-patient">
          <button
            onClick={handleBack}
            className="btn-primary mb-4"
          >
            ← Back to Dashboard
          </button>
          <p className="text-body text-white/80">Loading patient information...</p>
        </div>
      </div>
    );
  }

  if (error || !visit) {
    return (
      <div className="page-gradient flex justify-center">
        <div className="w-full container-patient">
          <button
            onClick={handleBack}
            className="btn-primary mb-4"
          >
            ← Back to Dashboard
          </button>
          <p className="text-body text-red-300">
            {error || "Unable to load patient information."}
          </p>
        </div>
      </div>
    );
  }

  const triage = getTriageLabel(visit.severity);
  const dob = formatDate(visit.dob);
  const checkin_time = formatDateTime(visit.checkin_time);
  const serviceStart = formatDateTime(visit.service_start);
  const serviceEnd = formatDateTime(visit.service_end);

  return (
    <div className="page-gradient flex justify-center">
      <div className="w-full container-patient">
        {/* Back + Title */}
        <button
          onClick={handleBack}
          className="btn-primary mb-4"
        >
          ← Back to Dashboard
        </button>

        <h1 className="heading-1 mb-6">Patient Information</h1>
        <p className="text-body text-slate-300 mb-6">
          Status: {" "}
          <span className="font-semibold">
            {visit.status?.replace("-", " ") || "N/A"}
          </span>
        </p>

        {/* Patient Info */}
        <section className="space-y-4 text-body leading-relaxed">
          <div>
            <h3 className="heading-3 mb-1">Patient Name</h3>
            <p>{visit.name}</p>
            <p>{triage}</p>
            <p>{dob}</p>
            <p>{visit.phone}</p>
          </div>

          <div>
            <h3 className="heading-3 mb-1">Department</h3>
            <p>{visit.department}</p>
          </div>

          <div>
            <h3 className="heading-3 mb-1">Patient Symptom Description</h3>
            <p>{visit.symptoms}</p>
          </div>

          <div>
            <h3 className="heading-3 mb-1">Assigned Staff</h3>
            {visit.assigned_staff_name ? (
              <p>
                {visit.assigned_staff_role === "physician" || visit.assigned_staff_role === "doctor" ? "Doctor" : visit.assigned_staff_role === "nurse" ? "Nurse" : "Staff"}: {visit.assigned_staff_name}
              </p>
            ) : (
              <p className="text-empty">Not yet assigned</p>
            )}
          </div>

          <div>
            <h3 className="heading-3 mb-1">Time Metrics</h3>
            <p>Check-In Time: {checkin_time}</p>
            <p>Service Start: {serviceStart}</p>
            <p>Service End: {serviceEnd}</p>
          </div>
        </section>
      </div>
    </div>
  );
}