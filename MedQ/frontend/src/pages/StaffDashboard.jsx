import { useMemo, useState } from "react";

const MOCK_QUEUE = [
  { id: 1, status: "waiting", name: "Gustavo", dept: "ER", eta: "15min", color: "bg-yellow-400" },
  { id: 2, status: "in-progress", name: "Joel", dept: "ER", eta: "15min", color: "bg-cyan-400" },
  { id: 3, status: "completed", name: "Amy", dept: "ER", eta: "15min", color: "bg-green-400" },
  { id: 4, status: "completed", name: "Cheyenne", dept: "ER", eta: "15min", color: "bg-green-400" }
]

function QueueCard({ item, actions }) {
  return (
    <div className="bg-[#2D3047] rounded-2xl px-4 py-3 mt-3 shadow-md">
      <div className="flex items-start gap-3">
        <span className={`w-4 h-4 rounded-full mt-1 ${item.color}`} />
        <div className="flex-1 text-sm">
          <p><span className="font-semibold">Name:</span> {item.name}</p>
          <p><span className="font-semibold">Dept:</span> {item.dept}</p>
          <p><span className="font-semibold">ETA:</span> {item.eta}</p>
        </div>
      </div>

      {actions && (
        <div className="mt-3 flex justify-end gap-2 text-xs">
          {actions.map((label) => (
            <button 
              key={label} 
              className="rounded-full border border-slate-400/70 px-4 py-1 hover:bg-slate-600/80 transition"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StaffDashboard() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState("2025-10-17"); // placeholder

  const waiting = useMemo(
    () => MOCK_QUEUE.filter((q) => q.status === "waiting"),
    []
  );

  const inProgress = useMemo(
    () => MOCK_QUEUE.filter((q) => q.status === "in-progress"),
    []
  );

    const completed = useMemo(
    () => MOCK_QUEUE.filter((q) => q.status === "completed"),
    []
  );

  const showSection = (section) =>
    statusFilter === "all" || statusFilter === section;

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
              />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}