import { useState, useEffect } from "react";
import { apiRequest } from "../apiClient";
import { getCurrentUser } from "../utils/authApi";

export default function ClockInOutButton({ onClockStatusChange }) {
  const [clockStatus, setClockStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const user = getCurrentUser();
  const staffId = user?.staff_id;

  // Check current clock status
  useEffect(() => {
    async function checkClockStatus() {
      if (!staffId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Get staff list to check if current user is clocked in
        const data = await apiRequest(`/staff/available`);
        const currentStaff = data.staff?.find(s => s.staff_id === staffId);

        if (currentStaff && currentStaff.on_duty) {
          setClockStatus({
            isClockedIn: true,
            shiftId: currentStaff.shift_id,
            clockInTime: currentStaff.clock_in
          });
        } else {
          setClockStatus({
            isClockedIn: false,
            shiftId: null,
            clockInTime: null
          });
        }
      } catch (err) {
        console.error("Error checking clock status:", err);
        setError("Unable to check clock status");
      } finally {
        setLoading(false);
      }
    }

    checkClockStatus();
  }, [staffId]);

  async function handleClockIn() {
    if (!staffId) return;

    try {
      setActionLoading(true);
      setError("");

      const response = await apiRequest(`/staff/${staffId}/clock-in`, {
        method: "POST",
      });

      setClockStatus({
        isClockedIn: true,
        shiftId: response.shift_id,
        clockInTime: response.clock_in
      });

      // Notify parent component to refresh available staff
      if (onClockStatusChange) {
        onClockStatusChange();
      }
    } catch (err) {
      setError(err.message || "Failed to clock in");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleClockOut() {
    if (!staffId) return;

    try {
      setActionLoading(true);
      setError("");

      await apiRequest(`/staff/${staffId}/clock-out`, {
        method: "POST",
      });

      setClockStatus({
        isClockedIn: false,
        shiftId: null,
        clockInTime: null
      });

      // Notify parent component to refresh available staff
      if (onClockStatusChange) {
        onClockStatusChange();
      }
    } catch (err) {
      setError(err.message || "Failed to clock out");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 rounded-lg">
        <div className="animate-pulse text-sm text-slate-300">Checking status...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${clockStatus?.isClockedIn ? 'bg-green-500' : 'bg-gray-500'}`} />
          <span className="text-sm font-medium">
            {clockStatus?.isClockedIn ? 'On Duty' : 'Off Duty'}
          </span>
        </div>

        {/* Clock In/Out Button */}
        {clockStatus?.isClockedIn ? (
          <button
            onClick={handleClockOut}
            disabled={actionLoading}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading ? 'Clocking Out...' : 'Clock Out'}
          </button>
        ) : (
          <button
            onClick={handleClockIn}
            disabled={actionLoading}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading ? 'Clocking In...' : 'Clock In'}
          </button>
        )}
      </div>

      {/* Clock in time display */}
      {clockStatus?.isClockedIn && clockStatus?.clockInTime && (
        <div className="text-xs text-slate-400">
          Clocked in at {new Date(clockStatus.clockInTime).toLocaleTimeString()}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="text-sm text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
