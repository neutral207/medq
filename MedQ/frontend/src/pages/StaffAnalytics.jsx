import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TabSwitcher from "../components/TabSwitcher";
import SummaryCardsRow from "../components/SummaryCardsRow";
import WaitTimeHeatmap from "../components/WaitTimeHeatmap";
import StaffPerformancePanel from "../components/StaffPerformancePanel";
import { exportToCsv } from "../utils/exportCsv";
import { apiRequest } from "../apiClient";
import { hasPermission } from "../utils/permissions";
import { getCurrentUser, logout } from "../utils/authApi";
import ThemeToggle from "../components/ThemeToggle";

export default function StaffAnalytics() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [metrics, setMetrics] = useState(null);
  const [heatmapData, setHeatmapData] = useState([]);
  const [error, setError] = useState(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Check permission on mount
  useEffect(() => {
    if (!hasPermission('canViewAnalytics')) {
      alert('You do not have permission to view Analytics. Redirecting to dashboard...');
      navigate('/staff-dashboard');
    }
  }, [navigate]);

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (startDate) params.append("start", startDate);
    if (endDate) params.append("end", endDate);
    params.append("tz", Intl.DateTimeFormat().resolvedOptions().timeZone);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  };

  const fetchAnalytics = async () => {
    try {
      const qs = buildQueryString();

      const [summaryData, heatmapJson] = await Promise.all([
        apiRequest(`/summary${qs}`),
        apiRequest(`/wait_heatmap${qs}`),
      ]);

      setMetrics({
        queueCount: summaryData.queueCount ?? 0,
        averageWait: summaryData.averageWait ?? 0,
        activeStaff: summaryData.activeStaff ?? 0,
        queueHistory: summaryData.queueHistory ?? [],
        averageWaitHistory: summaryData.averageWaitHistory ?? [],
        staffLoadHistory: summaryData.staffLoadHistory ?? [],
      });

      setHeatmapData(heatmapJson);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load analytics");
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleExportHeatmap = () => {
    if (!heatmapData || heatmapData.length === 0) return;
    exportToCsv("medq_wait_time_heatmap.csv", heatmapData);
  };

  return (
    <div className="page-gradient flex justify-center">
      <main className="w-full max-w-5xl px-6 py-10">
        <header className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h1 className="text-4xl font-bold">Analytics</h1>
              <p className="subtitle">
                View analytics and reports
              </p>
              {/* Logged in user display */}
              {currentUser && (
                <p className="text-sm text-muted mt-2">
                  Logged in as: <span className="font-semibold text-highlight">{currentUser.full_name}</span> ({currentUser.role})
                  {currentUser.department && (
                    <span> • Department: <span className="font-semibold text-highlight">{currentUser.department}</span></span>
                  )}
                </p>
              )}
            </div>

            <div className="flex items-start gap-3">
              {/* Theme Toggle */}
              <ThemeToggle />

              {/* Logout Button */}
              <button
                onClick={logout}
                className="px-4 py-2 btn-logout rounded-lg border transition-colors duration-200 text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <TabSwitcher
          classname="mb-6"
          tabs={[
            { label: "Board", to: "/staff-dashboard", permission: "canViewDashboard" },
            { label: "Analytics", to: "/staff-analytics", permission: "canViewAnalytics" },
            { label: "Staff", to: "/staff-management", permission: "canViewStaffManagement" },
          ]}
        />

        {/* Date Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div>
            <label className="block text-xs text-muted mb-1">Start date</label>
            <input
              type="date"
              className="input-date rounded px-2 py-1"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">End date</label>
            <input
              type="date"
              className="input-date rounded px-2 py-1"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>

          <button
            onClick={fetchAnalytics}
            className="self-end bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm"
          >
            Apply Filters
          </button>
        </div>

        {error && <div className="text-red-400 mb-4">{error}</div>}
        {!metrics && !error && <div className="text-slate-300">Loading analytics…</div>}

        {metrics && (
          <>
            <SummaryCardsRow metrics={metrics} />
            <StaffPerformancePanel queryString={buildQueryString()} />

            <div className="flex justify-end mt-6 mb-2">
              <button
                onClick={handleExportHeatmap}
                className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm"
              >
                Export Heatmap CSV
              </button>
            </div>

            <WaitTimeHeatmap data={heatmapData} />
          </>
        )}
      </main>
    </div>
  );
}