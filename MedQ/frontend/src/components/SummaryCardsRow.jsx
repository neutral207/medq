import React from "react";
import SummaryCard from "./SummaryCard";

function formatWaitTime(minutes) {
  const totalSeconds = Math.round((minutes || 0) * 60);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function SummaryCardsRow({ metrics }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: "16px",
      marginBottom: "24px"
    }}>
      <SummaryCard
        title="Patients in Queue"
        value={metrics.queueCount}
        chartData={{
          labels: metrics.queueHistory.map((_, i) => i),
          datasets: [
            {
              data: metrics.queueHistory,
              borderColor: "rgba(75, 192, 192, 1)",
              backgroundColor: "rgba(75, 192, 192, 0.2)",
            },
          ],
        }}
      />

      <SummaryCard
        title="Average Wait Time"
        value={formatWaitTime(metrics.averageWait)}
        chartData={{
          labels: metrics.averageWaitHistory.map((_, i) => i),
          datasets: [
            {
              data: metrics.averageWaitHistory,
              borderColor: "rgba(255, 159, 64, 1)",
              backgroundColor: "rgba(255, 159, 64, 0.2)",
            },
          ],
        }}
      />

      <SummaryCard
        title="Active Staff"
        value={metrics.activeStaff}
        chartData={{
          labels: metrics.staffLoadHistory.map((_, i) => i),
          datasets: [
            {
              data: metrics.staffLoadHistory,
              borderColor: "rgba(54, 162, 235, 1)",
              backgroundColor: "rgba(54, 162, 235, 0.2)",
            },
          ],
        }}
      />
    </div>
  );
}

export default SummaryCardsRow;