import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import medqLogo from "../assets/images/medq-logo.png";
import { useWebSocket } from "../contexts/WebSocketContext";
import ThemeToggle from "../components/ThemeToggle";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

export default function QueueStatus() {
  const location = useLocation();
  const navigate = useNavigate();
  const { socket } = useWebSocket();

  const { visitId, anonToken, department, initialWait, severity } = location.state || {};

  const [queuePosition, setQueuePosition] = useState(null);
  const [estWaitMinutes, setEstWaitMinutes] = useState(initialWait);
  const [checkinTime, setCheckinTime] = useState(null);
  const [lastUpdated, setLastUpdated] = useState("");
  const [statusError, setStatusError] = useState("");

  const startingSeconds = useMemo(() => {
    const mins = Number(estWaitMinutes);
    if (!Number.isFinite(mins) || mins <= 0) return 0;

    // If we have a checkin time, calculate elapsed time and subtract from predicted wait
    if (checkinTime) {
      const checkinDate = new Date(checkinTime);
      const now = new Date();
      const elapsedMinutes = (now - checkinDate) / 1000 / 60;
      const remainingMinutes = Math.max(0, mins - elapsedMinutes);
      return Math.round(remainingMinutes * 60);
    }

    return Math.round(mins * 60);
  }, [estWaitMinutes, checkinTime]);

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

  // Initial fetch of visit data using public endpoint
  useEffect(() => {
    if (!visitId || !anonToken) return;

    const fetchVisit = async () => {
      setStatusError("");

      try {
        const response = await fetch(
          `${API_BASE}/visit/${visitId}/public?token=${encodeURIComponent(anonToken)}`
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to fetch visit status");
        }

        const data = await response.json();
        const visit = data?.visit;

        if (!visit) {
          setStatusError("Visit data not found in API response.");
          return;
        }

        const qp = visit.queue_position ?? visit.queuePosition ?? null;
        const pw = visit.predicted_wait_minutes ?? visit.predictedWait ?? null;
        const ct = visit.checkin_time ?? visit.checkinTime ?? null;

        if (qp != null) setQueuePosition(qp);
        if (pw != null) setEstWaitMinutes(pw);
        if (ct != null) setCheckinTime(ct);

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
  }, [visitId, anonToken]);

  // WebSocket real-time updates
  useEffect(() => {
    if (!socket || !visitId || !anonToken) return;

    const handleQueueUpdate = async () => {
      // Reload visit data when queue updates using public endpoint
      try {
        const response = await fetch(
          `${API_BASE}/visit/${visitId}/public?token=${encodeURIComponent(anonToken)}`
        );

        if (!response.ok) return;

        const data = await response.json();
        const visit = data?.visit;

        if (visit) {
          const qp = visit.queue_position ?? visit.queuePosition ?? null;
          const pw = visit.predicted_wait_minutes ?? visit.predictedWait ?? null;
          const ct = visit.checkin_time ?? visit.checkinTime ?? null;

          if (qp != null) setQueuePosition(qp);
          if (pw != null) setEstWaitMinutes(pw);
          if (ct != null) setCheckinTime(ct);

          setLastUpdated(new Date().toLocaleString());
        }
      } catch (err) {
        console.error("Error reloading visit after queue update:", err);
      }
    };

    socket.on("queue_update", handleQueueUpdate);

    return () => {
      socket.off("queue_update", handleQueueUpdate);
    };
  }, [socket, visitId, anonToken]);

  const handleBackToCheckIn = () => {
  window.location.href = "http://localhost:3000/patient-checkin";
  };

  if (!visitId) {
    return (
      <div className="page-gradient flex justify-center relative">
        {/* Theme Toggle - Top Right */}
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>

        <main className="w-full max-w-3xl px-6 py-10">
          <h1 className="text-3xl font-bold mb-2">Queue Status</h1>
          <p className="subtitle">No visit information found. Please check in again.</p>

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
    <div className="page-gradient flex justify-center relative">
      {/* Theme Toggle - Top Right */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <main className="w-full max-w-3xl px-6 py-10">
        <header className="mb-8 flex items-center gap-3">
          <img src={medqLogo} alt="MedQ" className="h-10 w-10" />
          <div>
            <h1 className="text-4xl font-bold">Queue Status</h1>
            <p className="subtitle">Track your position and estimated wait time</p>
          </div>
        </header>

        <div className="card-info rounded-2xl p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <div className="subtitle text-xs !mt-0">Department</div>
              <div className="text-lg font-semibold mt-1">{department || "Unknown"}</div>
            </div>

            <div>
              <div className="subtitle text-xs !mt-0">Urgency</div>
              <div className="text-lg font-semibold mt-1">
                {severityLabel(severity)}
                {severity != null ? ` (Severity ${severity})` : ""}
              </div>
            </div>

            <div>
              <div className="subtitle text-xs !mt-0">Your Queue Number</div>
              <div className="text-3xl font-bold mt-1">
                {queuePosition != null ? queuePosition : "Loading..."}
              </div>
              {statusError ? <div className="text-sm text-red-500 mt-2">{statusError}</div> : null}
            </div>

            <div>
              <div className="subtitle text-xs !mt-0">Estimated Time Remaining</div>
              <div className="text-3xl font-bold mt-1">
                {estWaitMinutes != null ? formatTime(secondsLeft) : "Calculating..."}
              </div>
              <div className="subtitle text-xs mt-2">
                {lastUpdated ? `Last updated: ${lastUpdated}` : ""}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-current/10">
            <div className="subtitle text-xs !mt-0">Tracking Token</div>
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
