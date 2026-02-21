import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import medqLogo from "../assets/images/medq-logo.png";
import { apiRequest } from "../apiClient";
import { QRCodeSVG as QRCode } from "qrcode.react";

export default function QueueStatus() {
  const location = useLocation();

  // Accept data from navigation state OR from query string (QR link use-case)
  const qs = new URLSearchParams(window.location.search);
  const state = location.state || {};

  const visitId = state.visitId || qs.get("visitId");
  const anonToken = state.anonToken || qs.get("token");
  const departmentFromState = state.department;
  const initialWaitFromState = state.initialWait;
  const severityFromState = state.severity;

  const [queuePosition, setQueuePosition] = useState(null);
  const [estWaitMinutes, setEstWaitMinutes] = useState(initialWaitFromState ?? null);
  const [department, setDepartment] = useState(departmentFromState ?? "");
  const [severity, setSeverity] = useState(severityFromState ?? null);

  const [lastUpdated, setLastUpdated] = useState("");
  const [statusError, setStatusError] = useState("");
  const [soundPlayed, setSoundPlayed] = useState(false);

  // Convert minutes -> seconds for countdown
  const startingSeconds = useMemo(() => {
    const mins = Number(estWaitMinutes);
    if (!Number.isFinite(mins) || mins <= 0) return 0;
    return Math.round(mins * 60);
  }, [estWaitMinutes]);

  const [secondsLeft, setSecondsLeft] = useState(startingSeconds);

  useEffect(() => {
    setSecondsLeft(startingSeconds);
  }, [startingSeconds]);

  // Countdown tick
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  // Sound alert when almost next
  useEffect(() => {
    if (queuePosition != null && estWaitMinutes != null && queuePosition <= 2 && estWaitMinutes <= 5 && !soundPlayed) {
      // Play a cheerful alert sound using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioContext.currentTime;
      
      // Create a short melody/chime
      const notes = [
        { freq: 523.25, duration: 0.2 },  // C5
        { freq: 659.25, duration: 0.2 },  // E5
        { freq: 783.99, duration: 0.4 }   // G5
      ];

      notes.forEach((note, index) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.value = note.freq;
        gain.gain.setValueAtTime(0.3, now + 0.05 * index);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05 * index + note.duration);
        
        osc.start(now + 0.05 * index);
        osc.stop(now + 0.05 * index + note.duration);
      });

      setSoundPlayed(true);
    }
  }, [queuePosition, estWaitMinutes, soundPlayed]);

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

  // QR/share URL to open this same page on a phone
  // NOTE: Uses VITE_APP_URL from .env file, or falls back to current window location
  const shareUrl = useMemo(() => {
    if (!visitId || !anonToken) {
      console.log("shareUrl is null because visitId:", visitId, "or anonToken:", anonToken);
      return null;
    }

    const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;

    const url = `${baseUrl}/queue-status?visitId=${encodeURIComponent(
      visitId
    )}&token=${encodeURIComponent(anonToken)}`;
    console.log("shareUrl created:", url);
    return url;
  }, [visitId, anonToken]);

  // Fetch visit data
  useEffect(() => {
    if (!visitId) return;

    let cancelled = false;

    const fetchVisit = async () => {
      setStatusError("");

      try {
        const data = await apiRequest(`/visit/${visitId}`);
        const visit = data?.visit;

        if (!visit) {
          if (!cancelled) setStatusError("Visit data not found in API response.");
          return;
        }

        const qp = visit.queue_position ?? visit.queuePosition ?? null;
        const pw = visit.predicted_wait_minutes ?? visit.predictedWait ?? null;

        if (!cancelled) {
          if (qp != null) setQueuePosition(qp);
          if (pw != null) setEstWaitMinutes(pw);

          if (visit.department && !departmentFromState) setDepartment(visit.department);
          if (visit.severity != null && severityFromState == null) setSeverity(visit.severity);

          setLastUpdated(new Date().toLocaleString());

          if (qp == null) setStatusError("Visit loaded, but queue position is missing.");
        }
      } catch (err) {
        if (!cancelled) setStatusError(String(err?.message || err));
      }
    };

    fetchVisit();
    const interval = setInterval(fetchVisit, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [visitId, departmentFromState, severityFromState]);

  const handleBackToCheckIn = () => {
    window.location.href = "/patient-checkin";
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
            <p className="text-slate-300 text-sm mt-1">
              Track your position and estimated wait time
            </p>
          </div>
        </header>

        {queuePosition != null && estWaitMinutes != null && queuePosition <= 2 && estWaitMinutes <= 5 && (
          <div className="mb-6 bg-green-500/20 border border-green-400 rounded-xl p-4 shadow-md">
            <div className="text-green-300 font-semibold text-lg text-center">
              🎉 You're Almost Next!
            </div>
            <p className="text-green-200 text-sm text-center mt-1">
              You'll be called soon. Please be ready!
            </p>
          </div>
        )}

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

        {shareUrl && (
          <div className="mt-8 flex flex-col items-center">
            <div className="text-slate-300 text-xs mb-3">
              Scan to open this queue status on your phone
            </div>
            <div className="mb-3">
              <QRCode value={shareUrl} size={170} />
            </div>
            <div className="text-slate-400 text-xs text-center break-all max-w-md">{shareUrl}</div>
          </div>
        )}

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