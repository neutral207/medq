import { useLocation, useNavigate } from "react-router-dom";
import medqLogo from "../assets/images/medq-logo.png";
import { useEffect, useState } from "react";
import { apiRequest } from "../apiClient";

export default function QueueStatus() {
  const location = useLocation();
  console.log("QueueStatus location.state:", location.state);
  const navigate = useNavigate();

  const {
    visitId,
    anonToken,
    department,
    initialWait,
  } = location.state || {};

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [position, setPosition] = useState(null);
  const [estWaitMinutes, setEstWaitMinutes] = useState(initialWait ?? null);
  const [checkinTime, setCheckinTime] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    if (!visitId && !anonToken && !department) {
      setError("Missing visit information. Please complete check-in again.");
      setLoading(false);
      return;
    }

    async function loadQueue() {
      try {
        setLoading(true);
        setError("");

        const data = await apiRequest(
          `/queue?department=${encodeURIComponent(department)}`
        );

        const queue = data.queue || [];

        const index = queue.findIndex((item) => {
          const itemVisitId = item.visit_id ?? item.visitId;
          const itemAnonToken = item.anon_token ?? item.anonToken;
          return itemVisitId === visitId || itemAnonToken === anonToken;
        });

        if (index == -1) {
          setPosition(null);
          setEstWaitMinutes(null);
          setCheckinTime("");
        } else {
          const entry = queue[index];
          setPosition(index + 1);
          setEstWaitMinutes(entry.predicted_wait_minutes ?? entry.predictedWaitMinutes);

          if (entry.checkin_time) {
            const checkinDate = new Date(entry.checkin_time);
            setCheckinTime(
              checkinDate.toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })
            );
          }
        }

        const now = new Date();
        setLastUpdated(
          now.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })
        );
      } catch (err) {
        console.error(err);
        setError(err.message || "Error loading queue status.");
      } finally {
        setLoading(false);
      }
    }

    loadQueue();

    const id = setInterval(loadQueue, 30000);
    return () => clearInterval(id);
  }, [department, visitId, anonToken]);

  if (loading) {
    return (
      <div className="min-h-screen grid grid-rows-[auto,1fr] bg-gradient-to-b from-medqDark to-medqDeep text-white overflow-y-auto">
        <header className="pt-6 pb-0 flex flex-col items-center pointer-events-none sm:gap-1 mb-4 md:mb-6">
          <img
            src={medqLogo}
            alt="Med-Q logo"
            className="block h-32 object-contain drop-shadow-lg"
          />
          <h1 className="text-2xl md:text-[42px] tracking-wide text-white leading-tight">
            Queue Status
          </h1>
        </header>
        <main className="px-6 flex justify-center py-8 md:py-12">
          <p className="text-center text-white/80">Loading your queue status...</p>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen grid grid-rows-[auto,1fr] bg-gradient-to-b from-medqDark to-medqDeep text-white overflow-y-auto">
        <header className="pt-6 pb-0 flex flex-col items-center pointer-events-none sm:gap-1 mb-4 md:mb-6">
          <img
            src={medqLogo}
            alt="Med-Q logo"
            className="block h-32 object-contain drop-shadow-lg"
          />
          <h1 className="text-2xl md:text-[42px] tracking-wide text-white leading-tight">
            Queue Status
          </h1>
        </header>
        <main className="px-6 flex flex-col items-center justify-center gap-4 px-6 py-8 md:py-12">
          <p className="text-center text-red-300">{error}</p>
          <button
            onClick={() => navigate("/patient-checkin")}
            className="mt-2 px-4 py-2 rounded-md bg-medqPink hover:bg-pink-400 font-semibold"
          >
            Back to Check-In
          </button>
        </main>
      </div>
    );
  }

  const urgency = "Moderate";
  
  return (
    <div className="min-h-screen grid grid-rows-[auto,1fr] bg-gradient-to-b from-medqDark to-medqDeep text-white overflow-y-auto">
      {/* Header */}
      <header className="pt-6 pb-0 flex flex-col items-center pointer-events-none sm:gap-1 mb-4 md:mb-6">
        <img
          src={medqLogo}
          alt="Med-Q logo"
          className="block h-32 object-contain drop-shadow-lg"
        />
        <h1 className="text-2xl md:text-[42px] tracking-wide text-white leading-tight">
          Queue Status
        </h1>
      </header>

      <main className="px-6 flex justify-center py-8 md:py-12">
        <section className="w-[360px] text-center space-y-6 text-[15px] font-medium">
          {/* Top Message */}
          <div className="space-y-2">
            <p className="leading-snug">
              Thank you. Your department will be
            </p>
            <p className="text-lg font-semibold">{department || "-"}</p>
            <p className="leading-snug">
              and your urgency level is
            </p>
            <p className="text-lg font-semibold">{urgency}</p>
          </div>

          {/* Queue Info */}
          <div className="space-y-3">
            <p className="text-lg font-semibold">Your place in queue:</p>
            <p className="text-5xl font-bold tracking-tight">{position != null ? `#${position}` : "-"}</p>

            <div className="mt-2 space-y-1">
              <p className="text-lg font-semibold">Estimated Wait Time:</p>
              <p className="text-2xl font-semibold">
                {estWaitMinutes != null ? `${estWaitMinutes} minutes` : "Calculating..."}
              </p>
              <p className="text-xs font-normal text-white/70">
                (This page will update automatically)
              </p>
            </div>
          </div>

          <div className="text-xs font-normal text-white/80 space-y-1 leading-relaxed">
            {checkinTime && (
              <p>
                You completed your check-in at:{" "}
                <span className="font-semibold">{checkinTime}</span>
              </p>
            )}
            {lastUpdated && (
              <p>
                Last updated:{" "}
                <span className="font-semibold">{lastUpdated}</span>
              </p>
            )}
            <p className="mt-2">
              Please stay up to date with any announcements from the hospital about your care.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}