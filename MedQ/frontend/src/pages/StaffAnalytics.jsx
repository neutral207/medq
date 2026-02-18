import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Line } from "react-chartjs-2";
import TabSwitcher from "../components/TabSwitcher";
import SummaryCardsRow from "../components/SummaryCardsRow";
import WaitTimeHeatmap from "../components/WaitTimeHeatmap";
import StaffUtilizationPanel from "../components/StaffUtilizationPanel";
import { exportToCsv } from "../utils/exportCsv";
import { apiRequest } from "../apiClient";
import { hasPermission } from "../utils/permissions";
import { getCurrentUser, logout } from "../utils/authApi";
import { chartOptions } from "../charts/chartConfig"; 

function toISODateInput(d) {
  // d: Date -> YYYY-MM-DD
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function downloadCSV(filename, rows) {
  const escape = (v) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function StaffAnalytics() {
  // Default range: last 14 days
  const today = useMemo(() => new Date(), []);
  const defaultEnd = useMemo(() => toISODateInput(today), [today]);
  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 13);
    return toISODateInput(d);
  }, []);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const [summary, setSummary] = useState(null);
  const [util, setUtil] = useState(null);

  const [queueSeries, setQueueSeries] = useState({ labels: [], values: [] });
  const [waitSeries, setWaitSeries] = useState({ labels: [], values: [] });
  const [staffSeries, setStaffSeries] = useState({ labels: [], values: [] });

  const [heatmap, setHeatmap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const qs = useMemo(() => {
    const params = new URLSearchParams();
    if (startDate) params.set("start", startDate);
    if (endDate) params.set("end", endDate);
    return params.toString();
  }, [startDate, endDate]);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      setErr("");

      try {
        const [s, q, w, a, h, u] = await Promise.all([
          apiRequest(`/summary?${qs}`),
          apiRequest(`/chart_timeseries?metric=queue&${qs}`),
          apiRequest(`/chart_timeseries?metric=avg_wait&${qs}`),
          apiRequest(`/chart_timeseries?metric=active_staff&${qs}`),
          apiRequest(`/wait_heatmap?${qs}`),
          apiRequest(`/staff_utilization`),
        ]);

        if (cancelled) return;

        setSummary(s);
        setQueueSeries(q);
        setWaitSeries(w);
        setStaffSeries(a);
        setHeatmap(h);
        setUtil(u);
      } catch (e) {
        if (cancelled) return;
        setErr(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [qs]);

  const queueChartData = useMemo(
    () => ({
      labels: queueSeries.labels,
      datasets: [{ label: "Patients in Queue", data: queueSeries.values }],
    }),
    [queueSeries]
  );

  const waitChartData = useMemo(
    () => ({
      labels: waitSeries.labels,
      datasets: [{ label: "Avg Wait (min)", data: waitSeries.values }],
    }),
    [waitSeries]
  );

  const staffChartData = useMemo(
    () => ({
      labels: staffSeries.labels,
      datasets: [{ label: "Active Staff", data: staffSeries.values }],
    }),
    [staffSeries]
  );

  const handleExportHeatmapCSV = () => {
    if (!heatmap?.cells?.length) return;

    const rows = [
      ["start", heatmap.start],
      ["end", heatmap.end],
      [],
      ["dow", "hour", "avg_wait", "count"],
      ...heatmap.cells.map((c) => [c.dow, c.hour, c.avg_wait, c.count]),
    ];

    downloadCSV(`medq-heatmap-${startDate}-to-${endDate}.csv`, rows);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-medqDark to-medqDeep text-white flex justify-center">
      <main className="w-full max-w-6xl px-6 py-10">
        <header className="mb-6">
          <h1 className="text-4xl font-bold">Analytics</h1>
          <p className="text-slate-300 text-sm mt-1">View analytics and reports</p>
        </header>

        <TabSwitcher
          className="mb-6"
          tabs={[
            { label: "Board", to: "/staff-dashboard" },
            { label: "Analytics", to: "/staff-analytics" },
          ]}
        />

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end mb-6">
          <div>
            <label className="text-slate-300 text-xs">Start date</label>
            <input
              className="block mt-1 rounded-lg px-3 py-2 text-black"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-slate-300 text-xs">End date</label>
            <input
              className="block mt-1 rounded-lg px-3 py-2 text-black"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="sm:ml-auto text-slate-300 text-sm">
            {loading ? "Loading…" : summary?.range?.start ? `Range: ${summary.range.start} → ${summary.range.end}` : ""}
          </div>
        </div>

        {err ? (
          <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 mb-6">
            <div className="font-semibold">Analytics error</div>
            <div className="text-sm text-red-100 mt-1 break-all">{err}</div>
          </div>
        ) : null}

        {/* Summary cards + charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 text-black shadow">
            <div className="text-lg font-semibold mb-2">Patients in Queue</div>
            <div className="text-3xl font-bold mb-3">{summary?.patientsInQueue ?? "—"}</div>
            <Line data={queueChartData} options={chartOptions} />
          </div>

          <div className="bg-white rounded-2xl p-6 text-black shadow">
            <div className="text-lg font-semibold mb-2">Average Wait Time</div>
            <div className="text-3xl font-bold mb-3">{summary?.avgWaitMinutes ?? "—"} min</div>
            <Line data={waitChartData} options={chartOptions} />
          </div>

          <div className="bg-white rounded-2xl p-6 text-black shadow">
            <div className="text-lg font-semibold mb-2">Active Staff</div>
            <div className="text-3xl font-bold mb-3">{summary?.activeStaff ?? "—"}</div>
            <Line data={staffChartData} options={chartOptions} />
          </div>
        </div>

        {/* Staff utilization */}
        <div className="bg-white rounded-2xl p-6 text-black shadow mb-8">
          <div className="text-lg font-semibold mb-3">Staff Utilization by Department</div>
          {!util?.departments?.length ? (
            <div className="text-sm text-slate-600">No staff utilization data yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {util.departments.map((d) => (
                <div key={d.department} className="bg-slate-50 rounded-xl p-4 border">
                  <div className="font-semibold">{d.department}</div>
                  <div className="text-sm text-slate-700 mt-1">
                    Staff total: {d.staff_total} <br />
                    Active staff: {d.active_staff} <br />
                    In service now: {d.in_service_now} <br />
                    Utilization: {d.utilization_pct}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Heatmap */}
        <div className="flex items-center mb-3">
          <h2 className="text-2xl font-bold">Average Wait Time by Day and Hour</h2>
          <button
            onClick={handleExportHeatmapCSV}
            className="ml-auto bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm"
            disabled={!heatmap?.cells?.length}
          >
            Export Heatmap CSV
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 text-black shadow">
          {!heatmap?.cells?.length ? (
            <div className="text-sm text-slate-600">
              No heatmap data in this range yet. Try expanding the date range or add visits seed data.
            </div>
          ) : (
            <HeatmapSimple cells={heatmap.cells} />
          )}
        </div>
      </main>
    </div>
  );
}

function HeatmapSimple({ cells }) {
  // normalize into map[dow-hour] => avg_wait
  const map = new Map();
  let max = 0;
  for (const c of cells) {
    const k = `${c.dow}-${c.hour}`;
    const v = Number(c.avg_wait) || 0;
    map.set(k, v);
    if (v > max) max = v;
  }
  if (max <= 0) max = 1;

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="overflow-auto">
      <div className="min-w-[980px]">
        <div className="grid" style={{ gridTemplateColumns: "80px repeat(24, 36px)" }}>
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-[10px] text-slate-600 text-center">
              {h}
            </div>
          ))}

          {Array.from({ length: 7 }, (_, dow) => (
            <React.Fragment key={dow}>
              <div className="text-xs font-semibold text-slate-700 flex items-center">{days[dow]}</div>
              {Array.from({ length: 24 }, (_, hour) => {
                const v = map.get(`${dow}-${hour}`) ?? 0;
                const intensity = v / max; // 0..1
                return (
                  <div
                    key={`${dow}-${hour}`}
                    title={`${days[dow]} ${hour}:00 — ${v} min`}
                    className="h-8 w-9 border border-slate-200"
                    style={{
                      backgroundColor: `rgba(220, 38, 38, ${0.08 + intensity * 0.85})`,
                    }}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}