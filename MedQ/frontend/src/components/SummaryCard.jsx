import React from "react";
import { Line } from "react-chartjs-2";
import "../charts/chartConfig";

function SummaryCard({ title, value, suffix, chartData }) {
  return (
    <div style={{
      borderRadius: "12px",
      padding: "16px",
      backgroundColor: "#ffffff",
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      minWidth: "220px"
    }}>
      <div style={{ fontSize: "14px", color: "#555" }}>{title}</div>
      <div style={{ fontSize: "28px", fontWeight: "600" }}>
        {value}
        {suffix ? <span style={{ fontSize: "14px", marginLeft: "4px" }}>{suffix}</span> : null}
      </div>
      <div style={{ height: "80px" }}>
        <Line
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { display: false },
              y: { display: false },
            },
            elements: {
              point: { radius: 0 },
              line: { tension: 0.3 },
            },
          }}
        />
      </div>
    </div>
  );
}

export default SummaryCard;