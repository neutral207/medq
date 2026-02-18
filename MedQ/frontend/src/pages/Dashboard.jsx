import React, { useEffect, useState } from "react";
import SummaryCardsRow from "../components/SummaryCardsRow";
import WaitTimeHeatmap from "../components/WaitTimeHeatmap";
import { exportToCsv } from "../utils/exportCsv";
import StaffUtilizationPanel from "../components/StaffUtilizationPanel";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [heatmapData, setHeatmapData] = useState([]);
  const [error, setError] = useState(null);
  const [staffUtilization, setStaffUtilization] = useState(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleExportHeatmap = () => {
    if (!heatmapData || heatmapData.length === 0) {
      alert("No heatmap data to export");
      return;
    }
    exportToCsv("medq_wait_time_heatmap.csv", heatmapData);
  };

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (startDate) params.append("start", startDate);
    if (endDate) params.append("end", endDate);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  };

  const fetchAllAnalytics = async () => {
    try {
      const qs = buildQueryString();

      const [summaryRes, heatmapRes, staffRes] = await Promise.all([
        fetch(`${API_BASE}/summary${qs}`),
        fetch(`${API_BASE}/wait_heatmap${qs}`),
        fetch(`${API_BASE}/staff_utilization${qs}`),
      ]);

      if (!summaryRes.ok) throw new Error("Summary request failed");
      if (!heatmapRes.ok) throw new Error("Heatmap request failed");

      const summaryData = await summaryRes.json();
      const heatmapJson = await heatmapRes.json();
      const staffJson = await staffRes.json();

      setMetrics({
        queueCount: summaryData.queueCount ?? 0,
        averageWait: summaryData.averageWait ?? 0,
        activeStaff: summaryData.activeStaff ?? 0,
        queueHistory: summaryData.queueHistory ?? [],
        averageWaitHistory: summaryData.averageWaitHistory ?? [],
        staffLoadHistory: summaryData.staffLoadHistory ?? [],
      });

      setHeatmapData(heatmapJson);
      setStaffUtilization(staffJson);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchAllAnalytics();
  }, []);

  if (error) {
    return <div style={{ padding: "24px" }}>Error loading dashboard: {error}</div>;
  }

  if (!metrics) {
    return <div style={{ padding: "24px" }}>Loading dashboard…</div>;
  }

  return (
    <div style={{ padding: "24px", backgroundColor: "#f5f5f7", minHeight: "100vh" }}>
      <h1 style={{ fontSize: "24px", marginBottom: "16px" }}>MedQ Dashboard</h1>

      {/* Date filter controls */}
      <div
        style={{
          marginBottom: "16px",
          display: "flex",
          gap: "12px",
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <div>
          <label style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>
            Start date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>

        <div>
          <label style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>
            End date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>

        <button
          onClick={fetchAllAnalytics}
          style={{
            padding: "8px 14px",
            borderRadius: "8px",
            border: "none",
            background: "#2563eb",
            color: "white",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Apply Filters
        </button>
      </div>

      <SummaryCardsRow metrics={metrics} />
      <StaffUtilizationPanel data={staffUtilization} />

      <div
        style={{
          marginTop: "24px",
          marginBottom: "12px",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          onClick={handleExportHeatmap}
          style={{
            padding: "8px 14px",
            borderRadius: "8px",
            border: "none",
            background: "#2563eb",
            color: "white",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Export Heatmap CSV
        </button>
      </div>

      <WaitTimeHeatmap data={heatmapData} />
    </div>
  );
}

export default Dashboard;