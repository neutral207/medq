import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const MOCK_QUEUE = [
  { id: 1, status: "waiting", name: "Gustavo", dept: "ER", eta: "15min" },
  { id: 2, status: "in-progress", name: "Joel", dept: "ER", eta: "15min" },
  { id: 3, status: "completed", name: "Amy", dept: "ER", eta: "15min" },
  { id: 4, status: "completed", name: "Cheyenne", dept: "ER", eta: "15min" }
]

const STATUS_COLORS = {
  "waiting": "bg-yellow-400",
  "in-progress": "bg-cyan-400",
  "completed": "bg-green-400",
};

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

export default function StaffDashboard() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState("2025-10-17"); // placeholder
  const [queue, setQueue] = useState(MOCK_QUEUE);

  const waiting = useMemo(
    () => queue.filter((q) => q.status === "waiting"),
    [queue]
  );

  const inProgress = useMemo(
    () => queue.filter((q) => q.status === "in-progress"),
    [queue]
  );

  const completed = useMemo(
    () => queue.filter((q) => q.status === "completed"),
    [queue]
  );

  const showSection = (section) =>
    statusFilter === "all" || statusFilter === section;

  function handleViewDetails(item) {
    navigate(`/patient-details/${item.id}`);
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