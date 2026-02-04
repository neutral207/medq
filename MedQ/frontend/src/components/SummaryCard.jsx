import React from "react";
import { Line } from "react-chartjs-2";
import "../charts/chartConfig";

function SummaryCard({ title, value, suffix, chartData }) {
  return (
    <div className="rounded-xl p-4 summary-card flex flex-col gap-2 min-w-[220px]">
      <div className="text-sm text-muted">{title}</div>
      <div className="text-3xl font-semibold summary-value">
        {value}
        {suffix ? <span className="text-sm ml-1">{suffix}</span> : null}
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