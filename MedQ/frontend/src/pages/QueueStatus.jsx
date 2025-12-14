import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import medqLogo from "../assets/images/medq-logo.png";
import { apiRequest } from "../apiClient";

export default function QueueStatus() {
  const location = useLocation();
  const navigate = useNavigate();

  const { visitId, anonToken, department, initialWait, severity } = location.state || {};

  const [queuePosition, setQueuePosition] = useState(null);
  const [estWaitMinutes, setEstWaitMinutes] = useState(initialWait);
  const [lastUpdated, setLastUpdated] = useState("");
  const [statusError, setStatusError] = useState("");

  const startingSeconds = useMemo(() => {
    const mins = Number(estWaitMinutes);
    if (!Number.isFinite(mins) || mins <= 0) return 0;
    return Math.round(mins * 60);
  }, [estWaitMinutes]);

  const [secondsLeft, setSecondsLeft] = useState(startingSeconds);

  useEffect(() => {
    setSecondsLeft(startingSeconds);
  }, [startingSeconds]);

  useEffect(() => {
    if (secondsLeft <= 0) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft]);

  function formatTime(totalSeconds) {
    const s = Math.max(0, Number(totalSeconds) || 0);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  function severityLabel(s) {
    const n = Number(s);
    if (n >= 5) return "Critical";
    if (n === 4) return "High";
    if (n === 3) return "Moderate";
    if (n === 2) return "Low";
    if (n === 1) return "Very Low";
    return "Unknown";
  }

  useEffect(() => {
    if (!visitId) return;

    const fetchVisit = async () => {
      setStatusError("");

      try {
        // IMPORTANT: this route exists in your backend
        const data = await apiRequest(`/visit/${visitId}`);
        const visit = data?.visit;

        if (!visit) {
          setStatusError("Visit data not found in API response.");
          return;
        }

        const qp = visit.queue_position ?? visit.queuePosition ?? null;
        const pw = visit.predicted_wait_minutes ?? visit.predictedWait ?? null;

        if (qp != null) setQueuePosition(qp);
        if (pw != null) setEstWaitMinutes(pw);

        setLastUpdated(new Date().toLocaleString());

        if (qp == null) {
          setStatusError("Visit loaded, but queue position is missing.");
        }
      } catch (err) {
        console.error("Error fetching visit:", err);
        setStatusError(String(err?.message || err));
      }
    };

    fetchVisit();
    const interval = setInterval(fetchVisit, 30000);
    return () => clearInterval(interval);
  }, [visitId]);

  const handleBackToCheckIn = () => {
  window.location.href = "http://localhost:3000/patient-checkin";
  };

  if (!visitId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-medqDark to-medqDeep text-white flex justify-center">
        <main className="w-full max-w-3xl px-6 py-10">
          <h1 className="text-3xl font-bold mb-2">Queue Status</h1>
          <p className="text-slate-300">No visit information found. Please check in again.</p>

          <button
            onClick={handleBackToCheckIn}
            className="mt-6 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm"
          >
            Back to Check In
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-medqDark to-medqDeep text-white flex justify-center">
      <main className="w-full max-w-3xl px-6 py-10">
        <header className="mb-8 flex items-center gap-3">
          <img src={medqLogo} alt="MedQ" className="h-10 w-10" />
          <div>
            <h1 className="text-4xl font-bold">Queue Status</h1>
            <p className="text-slate-300 text-sm mt-1">Track your position and estimated wait time</p>
          </div>
        </header>

        <div className="bg-white/10 border border-white/10 rounded-2xl p-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <div className="text-slate-300 text-xs">Department</div>
              <div className="text-lg font-semibold mt-1">{department || "Unknown"}</div>
            </div>

            <div>
              <div className="text-slate-300 text-xs">Urgency</div>
              <div className="text-lg font-semibold mt-1">
                {severityLabel(severity)}
                {severity != null ? ` (Severity ${severity})` : ""}
              </div>
            </div>

            <div>
              <div className="text-slate-300 text-xs">Your Queue Number</div>
              <div className="text-3xl font-bold mt-1">
                {queuePosition != null ? queuePosition : "Loading..."}
              </div>
              {statusError ? <div className="text-sm text-red-300 mt-2">{statusError}</div> : null}
            </div>

            <div>
              <div className="text-slate-300 text-xs">Estimated Time Remaining</div>
              <div className="text-3xl font-bold mt-1">
                {estWaitMinutes != null ? formatTime(secondsLeft) : "Calculating..."}
              </div>
              <div className="text-slate-300 text-xs mt-2">
                {lastUpdated ? `Last updated: ${lastUpdated}` : ""}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="text-slate-300 text-xs">Tracking Token</div>
            <div className="font-mono text-sm mt-1 break-all">{anonToken || "N/A"}</div>
          </div>
        </div>

        <button
          onClick={handleBackToCheckIn}
          className="mt-8 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm"
        >
          Back to Check In
        </button>
      </main>
    </div>
  );
}
