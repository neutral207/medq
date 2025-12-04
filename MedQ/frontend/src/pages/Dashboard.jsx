import React, { useEffect, useState } from "react";
import SummaryCardsRow from "../components/SummaryCardsRow";
import WaitTimeHeatmap from "../components/WaitTimeHeatmap";

function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [heatmapData, setHeatmapData] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchSummary() {
      try {
        const res = await fetch("http://localhost:5000/api/summary");
        if (!res.ok) throw new Error("Summary request failed");
        const data = await res.json();
        setMetrics({
          queueCount: data.queueCount ?? 0,
          averageWait: data.averageWait ?? 0,
          activeStaff: data.activeStaff ?? 0,
          queueHistory: data.queueHistory ?? [],
          averageWaitHistory: data.averageWaitHistory ?? [],
          staffLoadHistory: data.staffLoadHistory ?? [],
        });
      } catch (err) {
        console.error(err);
        setError(err.message);
      }
    }

    async function fetchHeatmap() {
      try {
        const res = await fetch("http://localhost:5000/api/wait_heatmap");
        if (!res.ok) throw new Error("Heatmap request failed");
        const data = await res.json();
        setHeatmapData(data);
      } catch (err) {
        console.error(err);
      }
    }

    fetchSummary();
    fetchHeatmap();
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
      <SummaryCardsRow metrics={metrics} />
      <div style={{ marginTop: "24px" }}>
        <WaitTimeHeatmap data={heatmapData} />
      </div>
    </div>
  );
}

export default Dashboard;