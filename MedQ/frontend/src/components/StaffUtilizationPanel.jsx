import React from "react";

function StaffUtilizationPanel({ data }) {
  if (!data || !data.byDept || data.byDept.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: "24px",
        background: "#ffffff",
        borderRadius: "12px",
        padding: "16px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <h2 style={{ marginBottom: "12px", fontSize: "18px" }}>
        Staff Utilization
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
        }}
      >
        {data.byDept.map((dept) => (
          <div
            key={dept.deptId}
            style={{
              padding: "12px",
              borderRadius: "10px",
              background: "#f9fafb",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: "4px" }}>
              {dept.deptName}
            </div>
            <div style={{ fontSize: "13px" }}>
              Active staff: {dept.activeStaff}
            </div>
            <div style={{ fontSize: "13px" }}>
              In service now: {dept.inService}
            </div>
            <div style={{ marginTop: "6px", fontSize: "14px" }}>
              Utilization:
              {" "}
              <strong>{Math.round(dept.utilization * 100)}%</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StaffUtilizationPanel;