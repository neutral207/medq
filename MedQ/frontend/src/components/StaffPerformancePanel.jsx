import React, { useEffect, useState, useCallback } from "react";
import { useWebSocket } from "../contexts/WebSocketContext";
import { apiRequest } from "../apiClient";

const ROLE_COLORS = {
  nurse: "bg-blue-500",
  physician: "bg-purple-500",
  doctor: "bg-orange-500",
};

function formatTime(minutes) {
  if (!minutes || minutes === 0) return "0m";
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function StaffPerformancePanel({ queryString = "" }) {
  const { socket } = useWebSocket();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPerformance = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiRequest(`/staff_performance${queryString}`);
      setData(response);
    } catch (err) {
      console.error("Error fetching staff performance:", err);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  // Initial load
  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  // WebSocket real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      console.log("Staff performance update received");
      fetchPerformance();
    };

    // Listen for queue updates (visits completed) and visit updates
    socket.on("queue_update", handleUpdate);
    socket.on("visit_updated", handleUpdate);

    return () => {
      socket.off("queue_update", handleUpdate);
      socket.off("visit_updated", handleUpdate);
    };
  }, [socket, fetchPerformance]);

  if (loading && !data) {
    return (
      <div className="mt-6 card-standard">
        <h2 className="heading-2 mb-4">Staff Performance</h2>
        <p className="text-slate-400">Loading performance data...</p>
      </div>
    );
  }

  if (!data || !data.staffMetrics) {
    return null;
  }

  const { staffMetrics } = data;

  return (
    <div className="mt-6">
      <h2 className="heading-2 mb-4">Staff Performance</h2>

      {/* Staff Performance Table */}
      {staffMetrics && staffMetrics.length > 0 ? (
        <div className="card-standard overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-2 font-semibold">Staff Member</th>
                <th className="text-left py-3 px-2 font-semibold">Role</th>
                <th className="text-left py-3 px-2 font-semibold">Department</th>
                <th className="text-right py-3 px-2 font-semibold">Visits</th>
                <th className="text-right py-3 px-2 font-semibold">Total Time</th>
                <th className="text-right py-3 px-2 font-semibold">Avg Time</th>
              </tr>
            </thead>
            <tbody>
              {staffMetrics.map((staff) => (
                <tr
                  key={staff.staffId}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="py-3 px-2 font-medium">{staff.name}</td>
                  <td className="py-3 px-2">
                    <span
                      className={`${
                        ROLE_COLORS[staff.role] || "bg-gray-500"
                      } text-xs px-2 py-1 rounded-full`}
                    >
                      {staff.role}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-slate-300">{staff.department}</td>
                  <td className="py-3 px-2 text-right">{staff.totalVisits}</td>
                  <td className="py-3 px-2 text-right font-mono text-emerald-400">
                    {formatTime(staff.totalServiceMinutes)}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-slate-300">
                    {formatTime(staff.avgServiceMinutes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card-standard">
          <p className="text-empty">
            No staff performance data available for the selected date range.
          </p>
        </div>
      )}
    </div>
  );
}

export default StaffPerformancePanel;
