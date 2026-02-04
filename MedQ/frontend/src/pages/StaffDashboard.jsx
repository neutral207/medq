import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiRequest } from "../apiClient";
import TabSwitcher from "../components/TabSwitcher";
import { useWebSocket } from "../contexts/WebSocketContext";
import AssignStaffModal from "../components/AssignStaffModal";
import ClockInOutButton from "../components/ClockInOutButton";
import { needsClockInOut } from "../utils/permissions";
import { getCurrentUser, logout } from "../utils/authApi";
import ThemeToggle from "../components/ThemeToggle";

const STORAGE_KEY_DATE = "medq.staffDashboard.selectedDate";

const STATUS_COLORS = {
  "waiting": "bg-yellow-400",
  "in-progress": "bg-cyan-400",
  "completed": "bg-green-400",
};

const STAFF_ROLES = [
  { value: "all", label: "All Roles" },
  { value: "nurse", label: "Nurses" },
  { value: "doctor", label: "Doctors" },
  { value: "physician", label: "Physicians" },
];

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

// Countdown timer component for displaying remaining wait time
function CountdownTimer({ checkinTime, predictedWaitMinutes }) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    const calculateSecondsLeft = () => {
      const mins = Number(predictedWaitMinutes);
      if (!Number.isFinite(mins) || mins <= 0) return 0;

      if (checkinTime) {
        const checkinDate = new Date(checkinTime);
        const now = new Date();
        const elapsedMinutes = (now - checkinDate) / 1000 / 60;
        const remainingMinutes = Math.max(0, mins - elapsedMinutes);
        return Math.round(remainingMinutes * 60);
      }

      return Math.round(mins * 60);
    };

    setSecondsLeft(calculateSecondsLeft());

    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [checkinTime, predictedWaitMinutes]);

  const formatTime = (totalSeconds) => {
    const s = Math.max(0, Number(totalSeconds) || 0);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  };

  if (predictedWaitMinutes == null) {
    return <span className="text-slate-400">-</span>;
  }

  const isOverdue = secondsLeft === 0 && predictedWaitMinutes > 0;

  return (
    <span className={`font-mono ${isOverdue ? "text-red-400" : "text-emerald-400"}`}>
      {isOverdue ? "00:00 (overdue)" : formatTime(secondsLeft)}
    </span>
  );
}

function QueueCard({ item, actions, onViewDetails, onAction }) {
  const dotColor = STATUS_COLORS[item.status] || "bg-slate-400";

  return (
    <div className="card-standard">
      <div className="flex items-start gap-3">
        <span className={`w-3 h-3 rounded-full mt-1 ${dotColor}`} />
        <div className="flex-1">
          <h3 className="heading-3 mb-1">{item.name}</h3>
          <p className="text-body text-muted">Department: {item.dept}</p>
          <p className="text-small text-muted mt-1">
            ETA:{" "}
            {item.status === "waiting" ? (
              <CountdownTimer
                checkinTime={item.checkinTime}
                predictedWaitMinutes={item.predictedWaitMinutes}
              />
            ) : (
              <span className="text-slate-400">-</span>
            )}
          </p>
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
  const currentUser = getCurrentUser();
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
  const [staffRoleFilter, setStaffRoleFilter] = useState("all");
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
  const loadAvailableStaff = useCallback(async () => {
    try {
      const url = department === "all"
        ? "/staff/available"
        : `/staff/available?department=${encodeURIComponent(department)}`;
      const data = await apiRequest(url);
      setAvailableStaff(data.staff || []);
    } catch (err) {
      console.error("Error loading staff:", err);
    }
  }, [department]);

  useEffect(() => {
    loadAvailableStaff();
  }, [department, queue, loadAvailableStaff]); // Reload when queue changes

  // Filter available staff by role
  const filteredAvailableStaff = useMemo(() => {
    if (staffRoleFilter === "all") return availableStaff;
    return availableStaff.filter((s) => s.role === staffRoleFilter);
  }, [availableStaff, staffRoleFilter]);

  // Callback for when clock status changes
  const handleClockStatusChange = useCallback(() => {
    loadAvailableStaff();
  }, [loadAvailableStaff]);

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
            predictedWaitMinutes: entry.predicted_wait_minutes,
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
              predictedWaitMinutes: entry.predicted_wait_minutes,
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
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h1 className="heading-1">Staff Dashboard</h1>
              <p className="subtitle">
                Monitor and manage in real-time patient queue
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
              {/* Clock In/Out Button - Only show for non-admin clinical staff */}
              {needsClockInOut() && (
                <ClockInOutButton onClockStatusChange={handleClockStatusChange} />
              )}

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

        {/* Row 1: Board / Analytics / Staff */}
        <TabSwitcher
          className="mb-4"
          tabs={[
            { label: "Board", to: "/staff-dashboard", permission: "canViewDashboard" },
            { label: "Analytics", to: "/staff-analytics", permission: "canViewAnalytics" },
            { label: "Staff", to: "/staff-management", permission: "canViewStaffManagement" },
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
              className="select-standard"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept.value} value={dept.value}>
                  {dept.label}
                </option>
              ))}
            </select>

            {/* Staff Role Filter */}
            <select
              value={staffRoleFilter}
              onChange={(e) => setStaffRoleFilter(e.target.value)}
              className="select-standard"
            >
              {STAFF_ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select-standard"
            >
              <option value="all">All Status</option>
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
                  <p className="text-empty">No patients waiting</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {waiting.map((item) => (
                      <QueueCard
                        key={item.id}
                        item={item}
                        actions={["Assign", "Conclude"]}
                        onViewDetails={handleViewDetails}
                        onAction={handleAction}
                      />
                    ))}
                  </div>
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
                  <p className="text-empty">No patients in progress</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {inProgress.map((item) => (
                      <QueueCard
                        key={item.id}
                        item={item}
                        actions={["Wait", "Conclude"]}
                        onViewDetails={handleViewDetails}
                        onAction={handleAction}
                      />
                    ))}
                  </div>
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
                  <p className="text-empty">No completed visits</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {completed.map((item) => (
                      <QueueCard
                        key={item.id}
                        item={item}
                        actions={["Wait", "Assign"]}
                        onViewDetails={handleViewDetails}
                        onAction={handleAction}
                      />
                    ))}
                  </div>
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
        availableStaff={filteredAvailableStaff}
        patientName={selectedPatient?.name || ""}
        patientDepartment={selectedPatient?.dept || ""}
      />
    </div>
  );
}
