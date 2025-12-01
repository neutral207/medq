import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../apiClient";

const STORAGE_KEY_DATE = "medq.staffDashboard.selectedDate";

const STATUS_COLORS = {
  "waiting": "bg-yellow-400",
  "in-progress": "bg-cyan-400",
  "completed": "bg-green-400",
};

const DEPARTMENTS = [
  "Emergency", "Radiology", "Pediatrics", "Cardiology"
];

function QueueCard({ item, actions, onViewDetails, onAction }) {
  const dotColor = STATUS_COLORS[item.status] || "bg-slate-400";

  return (
    <div className="bg-[#2D3047] rounded-2xl px-4 py-3 mt-3 shadow-md">
      <div className="flex items-start gap-3">
        <span className={`w-3 h-3 rounded-full mt-1 ${dotColor}`} />
        <div className="flex-1 text-sm">
          <p><span className="font-semibold">Name:</span> {item.name}</p>
          <p><span className="font-semibold">Dept:</span> {item.dept}</p>
          <p><span className="font-semibold">ETA:</span> {item.eta}</p>
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-2 text-xs">
        {/* Details Button */}
        {onViewDetails && (
          <button
            onClick={() => onViewDetails(item)}
            className="rounded-full border border-slate-400/70 px-4 py-1 hover:bg-slate-600/80 transition"
          >
            Details
          </button>
        )}

        {actions &&
          actions.map((label) => (
            <button
              key={label}
              onClick={() => onAction && onAction(item, label)}
              className="rounded-full border border-slate-400/70 px-4 py-1 hover:bg-slate-600/80 transition"
            >
              {label}
            </button>
          ))}
      </div>
    </div>
  );
}

function getTodayLocalISO() {
  return new Date().toLocaleDateString("en-CA");
}

export default function StaffDashboard() {
  const navigate = useNavigate();
  const today = getTodayLocalISO();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY_DATE);
    if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) {
      return stored;
    }
    return today;
  });
  const [department, setDepartment] = useState("Emergency");
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filteredQueue = useMemo(() => {
    if (!selectedDate) return queue;

    return queue.filter((item) => {
      if (!item.checkinTime) return true;

      const itemDate = item.checkinTime.slice(0, 10);
      return itemDate === selectedDate;
    });
  }, [queue, selectedDate]);

  const waiting = useMemo(
    () => filteredQueue.filter((q) => q.status === "waiting"),
    [filteredQueue]
  );

  const inProgress = useMemo(
    () => filteredQueue.filter((q) => q.status === "in-progress"),
    [filteredQueue]
  );

  const completed = useMemo(
    () => filteredQueue.filter((q) => q.status === "completed"),
    [filteredQueue]
  );

  const showSection = (section) =>
    statusFilter === "all" || statusFilter === section;

  function handleViewDetails(item) {
    navigate(`/patient-details/${item.visitId}`, {
      state: { patient: item, fromDate: selectedDate, fromDepartment: department },
    });
  }

  function handleAction(item, label) {
    setQueue((prev) =>
      prev.map((q) => {
        if (q.id !== item.id) return q;

        let nextStatus = q.status;

        if (q.status === "waiting") {
          if (label === "Assign") nextStatus = "in-progress";
          if (label === "Conclude") nextStatus = "completed";
        } else if (q.status === "in-progress") {
          if (label === "Wait") nextStatus = "waiting";
          if (label === "Conclude") nextStatus = "completed";
        } else if (q.status === "completed") {
          if (label === "Wait") nextStatus = "waiting";
          if (label === "Assign") nextStatus = "in-progress";
        }

        return {...q, status: nextStatus };
      })
    );
  }

  useEffect(() => {
    async function loadQueue() {
      try {
        setLoading(true);
        setError("");
        localStorage.setItem(STORAGE_KEY_DATE, selectedDate);

        const data = await apiRequest(`/queue?department=${encodeURIComponent(department)}`);

        const items = (data.queue || []).map((entry, index) => ({
          id: entry.visit_id || index,
          status: entry.status || "waiting",
          name: entry.name && entry.name.trim().length > 0 ? entry.name : entry.anon_token ? `Patient ${entry.anon_token.slice(-4)}` : "Patient",
          dept: data.department || department,
          eta: entry.predicted_wait_minutes != null ? `${entry.predicted_wait_minutes} minutes` : "-",
          visitId: entry.visit_id,
          anonToken: entry.anon_token,
          checkinTime: entry.checkin_time,
          severity: entry.severity,
          dob: entry.dob,
          phone: entry.phone,
          symptoms: entry.symptoms,
        }));

        setQueue(items);
      } catch (err) {
        console.error(err);
        setError(err.message || "Error loading queue.");
      } finally {
        setLoading(false);
      }
    }

    loadQueue();
    const id = setInterval(loadQueue, 30000);
    return () => clearInterval(id);
  }, [department, selectedDate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-medqDark to-medqDeep text-white flex justify-center">
      <main className="w-full max-w-3xl px-6 py-10">
        {/* Title */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold">Staff Dashboard</h1>
          <p className="text-slate-300 text-sm mt-1">
            Monitor and manage in real-time patient queue
          </p>
        </header>

        {/* Row 1: Board / Analytics */}
        <div className="mb-4">
          <button className="px-5 py-2 rounded-xl bg-medqPink text-sm font-semibold shadow-md">
            Board
          </button>
        </div>

        {/* Row 1: Date + Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#2D3047] text-xs border border-slate-600/60"
          />

          <div className="flex items-center gap-3 ml-auto">
            <button className="ml-auto px-4 py-2 rounded-xl bg-medqPink/80 text-[12px] font-semibold shadow" >
              Filter
            </button>

            {/* Department select */}
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="ml-auto rounded-full bg-[#2D3047] border-slate-600/70 px-4 py-2 text-xs"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="ml-auto rounded-full bg-[#2D3047] border-slate-600/70 px-4 py-2 text-xs"
            >
              <option value="all">Status / Dept</option>
              <option value="waiting">Waiting</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Waiting */}
        {showSection("waiting") && (
          <section className="mb-7">
            <h3 className="text-sm font-semibold mb-1">
              Waiting ({waiting.length})
            </h3>
            {waiting.map((item) => (
              <QueueCard
                key={item.id}
                item={item}
                actions={["Assign", "Conclude"]}
                onViewDetails={handleViewDetails}
                onAction={handleAction}
              />
            ))}
          </section>
        )}

        {/* In Progress */}
        {showSection("in-progress") && (
          <section className="mb-7">
            <h3 className="text-sm font-semibold mb-1">
              In Progress ({inProgress.length})
            </h3>
            {inProgress.map((item) => (
              <QueueCard
                key={item.id}
                item={item}
                actions={["Wait", "Conclude"]}
                onViewDetails={handleViewDetails}
                onAction={handleAction}
              />
            ))}
          </section>
        )}

        {/* Completed */}
        {showSection("completed") && (
          <section className="mb-7">
            <h3 className="text-sm font-semibold mb-1">
              Completed ({completed.length})
            </h3>
            {completed.map((item) => (
              <QueueCard
                key={item.id}
                item={item}
                actions={["Wait", "Assign"]}
                onViewDetails={handleViewDetails}
                onAction={handleAction}
              />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}