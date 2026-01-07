import { useMemo, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiRequest } from "../apiClient";
import TabSwitcher from "../components/TabSwitcher";
import { useWebSocket } from "../contexts/WebSocketContext";
import AssignStaffModal from "../components/AssignStaffModal";

const STORAGE_KEY_DATE = "medq.staffDashboard.selectedDate";

const STATUS_COLORS = {
  "waiting": "bg-yellow-400",
  "in-progress": "bg-cyan-400",
  "completed": "bg-green-400",
};

const DEPARTMENTS = [
  { value: "all", label: "All Departments" },
  { value: "Emergency", label: "Emergency" },
  { value: "Pediatrics", label: "Pediatrics" },
  { value: "Cardiology", label: "Cardiology" },
  { value: "Radiology", label: "Radiology" },
];

function getNextStatus(currentStatus, label) {
  if (currentStatus === "waiting") {
    if (label === "Assign") return "in-progress";
    if (label === "Conclude") return "completed";
  } else if (currentStatus === "in-progress") {
    if (label === "Wait") return "waiting";
    if (label === "Conclude") return "completed";
  } else if (currentStatus === "completed") {
    if (label === "Wait") return "waiting";
    if (label === "Assign") return "in-progress";
  }
  return currentStatus;
}

function QueueCard({ item, actions, onViewDetails, onAction }) {
  const dotColor = STATUS_COLORS[item.status] || "bg-slate-400";

  return (
    <div className="card-standard mt-3">
      <div className="flex items-start gap-3">
        <span className={`w-3 h-3 rounded-full mt-1 ${dotColor}`} />
        <div className="flex-1">
          <h3 className="heading-3 mb-1">{item.name}</h3>
          <p className="text-body text-slate-300">Department: {item.dept}</p>
          <p className="text-small text-slate-400 mt-1">ETA: {item.eta}</p>
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        {/* Details Button */}
        {onViewDetails && (
          <button
            onClick={() => onViewDetails(item)}
            className="btn-small"
          >
            Details
          </button>
        )}

        {actions &&
          actions.map((label) => (
            <button
              key={label}
              onClick={() => onAction && onAction(item, label)}
              className="btn-small"
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
  const location = useLocation();
  const today = getTodayLocalISO();
  const { socket } = useWebSocket();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(() => {
    // Always default to today's date on fresh load
    // Only restore from sessionStorage if it's today's date
    const stored = sessionStorage.getItem(STORAGE_KEY_DATE);
    if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored) && stored === today) {
      return stored;
    }
    return today;
  });
  const [department, setDepartment] = useState("all");
  const [availableStaff, setAvailableStaff] = useState([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Restore filters from navigation state
  useEffect(() => {
    if (location.state?.fromStatusFilter) {
      setStatusFilter(location.state.fromStatusFilter);
    }
    if (location.state?.fromDate) {
      setSelectedDate(location.state.fromDate);
    }
    if (location.state?.fromDepartment) {
      setDepartment(location.state.fromDepartment);
    }
  }, [location.state]);

  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load available on-duty staff (not currently assigned)
  useEffect(() => {
    async function loadStaff() {
      try {
        const url = department === "all"
          ? "/staff/available"
          : `/staff/available?department=${encodeURIComponent(department)}`;
        const data = await apiRequest(url);
        setAvailableStaff(data.staff || []);
      } catch (err) {
        console.error("Error loading staff:", err);
      }
    }

    loadStaff();
  }, [department, queue]); // Reload when queue changes

  const filteredQueue = useMemo(() => {
    if (!selectedDate) return queue;

    return queue.filter((item) => {
      if (!item.checkinTime) return true;

      const itemDate = new Date(item.checkinTime).toLocaleDateString("en-CA");
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
      state: {
        patient: item,
        fromDate: selectedDate,
        fromDepartment: department,
        fromStatusFilter: statusFilter
      },
    });
  }

  async function handleAction(item, label) {
    // If "Assign" is clicked, open the modal
    if (label === "Assign") {
      setSelectedPatient(item);
      setIsAssignModalOpen(true);
      return;
    }

    // Handle other status changes
    const nextStatus = getNextStatus(item.status, label);
    if (nextStatus === item.status) return;

    const previousStatus = item.status;

    setQueue((prev) =>
      prev.map((q) =>
        q.id === item.id ? { ...q, status: nextStatus } : q
      )
    );

    try {
      await apiRequest(`/visit/${encodeURIComponent(item.visitId)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
    } catch (err) {
      setError(err.message || "Error updating status.");

      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id ? { ...q, status: previousStatus } : q
        )
      );
    }
  }

  async function handleAssignStaff(staffId) {
    if (!selectedPatient) return;

    try {
      await apiRequest(`/visit/${encodeURIComponent(selectedPatient.visitId)}/assign`, {
        method: "PATCH",
        body: JSON.stringify({
          assigned_staff: parseInt(staffId),
          status: "in-progress"
        }),
      });

      // Update local state
      setQueue((prev) =>
        prev.map((q) =>
          q.id === selectedPatient.id ? { ...q, status: "in-progress" } : q
        )
      );

      // Close modal
      setIsAssignModalOpen(false);
      setSelectedPatient(null);
    } catch (err) {
      setError(err.message || "Error assigning staff.");
    }
  }

  function handleCloseModal() {
    setIsAssignModalOpen(false);
    setSelectedPatient(null);
  }

  // Load queue data from API
  useEffect(() => {
    async function loadQueue() {
      try {
        setLoading(true);
        setError("");
        sessionStorage.setItem(STORAGE_KEY_DATE, selectedDate);

        const url = `/queue?department=${encodeURIComponent(department)}`;
        const data = await apiRequest(url);

        const items = (data.queue || []).map((entry, index) => {
          // Determine patient display name
          let displayName = "Patient";
          if (entry.name && entry.name.trim().length > 0) {
            displayName = entry.name;
          } else if (entry.anon_token) {
            displayName = `Patient ${entry.anon_token.slice(-4)}`;
          }

          return {
            id: entry.visit_id || index,
            status: entry.status || "waiting",
            name: displayName,
            dept: entry.department || data.department || department,
            eta: entry.predicted_wait_minutes != null ? `${entry.predicted_wait_minutes} minutes` : "-",
            visitId: entry.visit_id,
            anonToken: entry.anon_token,
            checkinTime: entry.checkin_time,
            severity: entry.severity,
            dob: entry.dob,
            phone: entry.phone,
            symptoms: entry.symptoms,
          };
        });

        setQueue(items);
      } catch (err) {
        setError(err.message || "Error loading queue.");
      } finally {
        setLoading(false);
      }
    }

    loadQueue();
  }, [department, selectedDate]);

  // WebSocket real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleQueueUpdate = (data) => {
      console.log("Queue update received:", data);
      // Reload queue when we receive an update
      const reloadQueue = async () => {
        try {
          const url = `/queue?department=${encodeURIComponent(department)}`;
          const response = await apiRequest(url);

          const items = (response.queue || []).map((entry, index) => {
            let displayName = "Patient";
            if (entry.name && entry.name.trim().length > 0) {
              displayName = entry.name;
            } else if (entry.anon_token) {
              displayName = `Patient ${entry.anon_token.slice(-4)}`;
            }

            return {
              id: entry.visit_id || index,
              status: entry.status || "waiting",
              name: displayName,
              dept: entry.department || response.department || department,
              eta: entry.predicted_wait_minutes != null ? `${entry.predicted_wait_minutes} minutes` : "-",
              visitId: entry.visit_id,
              anonToken: entry.anon_token,
              checkinTime: entry.checkin_time,
              severity: entry.severity,
              dob: entry.dob,
              phone: entry.phone,
              symptoms: entry.symptoms,
            };
          });

          setQueue(items);
        } catch (err) {
          console.error("Error reloading queue after update:", err);
        }
      };

      reloadQueue();
    };

    socket.on("queue_update", handleQueueUpdate);

    // Cleanup listener on unmount
    return () => {
      socket.off("queue_update", handleQueueUpdate);
    };
  }, [socket, department]);

  return (
    <div className="page-gradient flex justify-center">
      <main className="w-full container-staff">
        {/* Title */}
        <header className="header-section">
          <h1 className="heading-1">Staff Dashboard</h1>
          <p className="subtitle">
            Monitor and manage in real-time patient queue
          </p>
        </header>

        {/* Row 1: Board / Analytics / Staff */}
        <TabSwitcher
          className="mb-4"
          tabs={[
            { label: "Board", to: "/staff-dashboard" },
            { label: "Analytics", to: "/staff-analytics" },
            { label: "Staff", to: "/staff-management" },
          ]}
        />

        {/* Error Message */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm">
            {error}
          </div>
        )}

        {/* Row 1: Date + Filters */}
        <div className="flex flex-wrap items-center gap-3 section-margin">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input-date"
          />

          <div className="flex items-center gap-3 ml-auto">
            {/* Department select */}
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="select-standard ml-auto"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept.value} value={dept.value}>
                  {dept.label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select-standard ml-auto"
            >
              <option value="all">Status / Dept</option>
              <option value="waiting">Waiting</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-10">
            <p className="text-slate-300">Loading queue...</p>
          </div>
        )}

        {/* Queue Sections */}
        {!loading && (
          <>
            {/* Waiting */}
            {showSection("waiting") && (
              <section className="section-margin">
                <h3 className="heading-2 mb-4">
                  Waiting ({waiting.length})
                </h3>
                {waiting.length === 0 ? (
                  <p className="text-empty mt-3">No patients waiting</p>
                ) : (
                  waiting.map((item) => (
                    <QueueCard
                      key={item.id}
                      item={item}
                      actions={["Assign", "Conclude"]}
                      onViewDetails={handleViewDetails}
                      onAction={handleAction}
                    />
                  ))
                )}
              </section>
            )}

            {/* In Progress */}
            {showSection("in-progress") && (
              <section className="section-margin">
                <h3 className="heading-2 mb-4">
                  In Progress ({inProgress.length})
                </h3>
                {inProgress.length === 0 ? (
                  <p className="text-empty mt-3">No patients in progress</p>
                ) : (
                  inProgress.map((item) => (
                    <QueueCard
                      key={item.id}
                      item={item}
                      actions={["Wait", "Conclude"]}
                      onViewDetails={handleViewDetails}
                      onAction={handleAction}
                    />
                  ))
                )}
              </section>
            )}

            {/* Completed */}
            {showSection("completed") && (
              <section className="section-margin">
                <h3 className="heading-2 mb-4">
                  Completed ({completed.length})
                </h3>
                {completed.length === 0 ? (
                  <p className="text-empty mt-3">No completed visits</p>
                ) : (
                  completed.map((item) => (
                    <QueueCard
                      key={item.id}
                      item={item}
                      actions={["Wait", "Assign"]}
                      onViewDetails={handleViewDetails}
                      onAction={handleAction}
                    />
                  ))
                )}
              </section>
            )}
          </>
        )}
      </main>

      {/* Assign Staff Modal */}
      <AssignStaffModal
        isOpen={isAssignModalOpen}
        onClose={handleCloseModal}
        onAssign={handleAssignStaff}
        availableStaff={availableStaff}
        patientName={selectedPatient?.name || ""}
      />
    </div>
  );
}
