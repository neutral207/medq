import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import { useTheme } from "../contexts/ThemeContext";

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function WaitTimeHeatmap({ data }) {
  const svgRef = useRef(null);
  const { isDark } = useTheme();

  useEffect(() => {
    if (!data || data.length === 0) return;

    // Theme-aware colors
    const textColor = isDark ? "#cbd5e1" : "#374151";
    const titleColor = isDark ? "#e2e8f0" : "#1f2937";

    const margin = { top: 30, right: 20, bottom: 40, left: 50 };
    const width = 700;
    const height = 260;

    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    svg.selectAll("*").remove();

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const hours = d3.range(24);
    const days = d3.range(7);

    const xScale = d3
      .scaleBand()
      .domain(hours)
      .range([0, innerWidth])
      .padding(0.05);

    const yScale = d3
      .scaleBand()
      .domain(days)
      .range([0, innerHeight])
      .padding(0.05);

    const maxWait = d3.max(data, d => d.avg_wait) || 0;

    const colorScale = d3
      .scaleSequential(d3.interpolateYlOrRd)
      .domain([0, maxWait || 1]);

    const tooltip = d3
      .select("body")
      .append("div")
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("background", isDark ? "#374151" : "white")
      .style("border", isDark ? "1px solid #4b5563" : "1px solid #ccc")
      .style("border-radius", "4px")
      .style("padding", "4px 8px")
      .style("font-size", "12px")
      .style("color", isDark ? "#e2e8f0" : "#333")
      .style("opacity", 0);

    g.selectAll("rect")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", d => xScale(d.hour))
      .attr("y", d => yScale(d.day_of_week))
      .attr("width", xScale.bandwidth())
      .attr("height", yScale.bandwidth())
      .attr("rx", 2)
      .attr("ry", 2)
      .attr("fill", d => colorScale(d.avg_wait || 0))
      .on("mousemove", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(
            `${dayLabels[d.day_of_week]} ${d.hour}:00<br/>Avg wait: ${d.avg_wait.toFixed(
              1
            )} min`
          )
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY + 10 + "px");
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
      });

    const xAxis = d3
      .axisBottom(xScale)
      .tickValues([0, 4, 8, 12, 16, 20])
      .tickFormat(d => `${d}:00`);

    // Add x-axis
    const xAxisGroup = g.append("g")
      .attr("transform", `translate(0, ${innerHeight})`)
      .call(xAxis);

    xAxisGroup.selectAll("text")
      .style("font-size", "10px")
      .style("fill", textColor);

    xAxisGroup.selectAll(".domain, .tick line")
      .style("stroke", textColor);

    // Add y-axis
    const yAxis = d3.axisLeft(yScale).tickFormat(d => dayLabels[d]);
    const yAxisGroup = g.append("g").call(yAxis);

    yAxisGroup.selectAll("text")
      .style("font-size", "10px")
      .style("fill", textColor);

    yAxisGroup.selectAll(".domain, .tick line")
      .style("stroke", textColor);

    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "600")
      .style("fill", titleColor)
      .text("Average Wait Time by Day and Hour");

    return () => {
      tooltip.remove();
    };
  }, [data, isDark]);

  return (
    <div className="rounded-xl p-4 summary-card">
      <svg ref={svgRef} style={{ width: "100%", height: "320px" }} />
    </div>
  );
}

export default WaitTimeHeatmap;