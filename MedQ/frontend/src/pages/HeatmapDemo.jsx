import { useEffect, useState } from "react";
import WaitTimeHeatmap from "../components/WaitTimeHeatmap";

function HeatmapDemo() {
  const [data, setData] = useState([]);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("http://localhost:5000/api/wait_heatmap");
        const json = await res.json();
        console.log("Heatmap data:", json);
        setData(json);
      } catch (err) {
        console.error("Failed to load heatmap:", err);
      }
    }
    loadData();
  }, []);

  return (
    <div style={{ padding: "24px", background: "#f5f5f7", minHeight: "100vh" }}>
      <h1 style={{ marginBottom: "16px" }}>Wait Time Heatmap Demo</h1>
      <WaitTimeHeatmap data={data} />
    </div>
  );
}

export default HeatmapDemo;