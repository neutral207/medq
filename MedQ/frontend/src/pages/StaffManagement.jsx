import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../apiClient";
import { useWebSocket } from "../contexts/WebSocketContext";
import TabSwitcher from "../components/TabSwitcher";
import { hasPermission } from "../utils/permissions";

const ROLE_COLORS = {
  nurse: "bg-blue-500",
  physician: "bg-purple-500",
  doctor: "bg-orange-500",
};

export default function StaffManagement() {
  const navigate = useNavigate();
  const { socket } = useWebSocket();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  // Check permission on mount
  useEffect(() => {
    if (!hasPermission('canViewStaffManagement')) {
      alert('You do not have permission to view Staff Management. Redirecting to dashboard...');
      navigate('/staff-dashboard');
    }
  }, [navigate]);

  // Load staff data
  useEffect(() => {
    async function loadStaff() {
      try {
        setLoading(true);
        setError("");

        const url = departmentFilter === "all"
          ? "/staff"
          : `/staff?department=${encodeURIComponent(departmentFilter)}`;

        const data = await apiRequest(url);
        // Filter to only show nurses, physicians, and doctors
        const filteredStaff = (data.staff || []).filter(
          (s) => s.role === "nurse" || s.role === "physician" || s.role === "doctor"
        );
        setStaff(filteredStaff);
      } catch (err) {
        setError(err.message || "Error loading staff.");
      } finally {
        setLoading(false);
      }
    }

    loadStaff();
  }, [departmentFilter]);

  // WebSocket real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleStaffUpdate = async () => {
      try {
        const url = departmentFilter === "all"
          ? "/staff"
          : `/staff?department=${encodeURIComponent(departmentFilter)}`;

        const data = await apiRequest(url);
        // Filter to only show nurses, physicians, and doctors
        const filteredStaff = (data.staff || []).filter(
          (s) => s.role === "nurse" || s.role === "physician" || s.role === "doctor"
        );
        setStaff(filteredStaff);
      } catch (err) {
        console.error("Error reloading staff after update:", err);
      }
    };

    socket.on("staff_update", handleStaffUpdate);

    return () => {
      socket.off("staff_update", handleStaffUpdate);
    };
  }, [socket, departmentFilter]);

  async function handleClockIn(staffId) {
    try {
      await apiRequest(`/staff/${staffId}/clock-in`, {
        method: "POST",
      });

      // Reload staff data immediately
      const url = departmentFilter === "all"
        ? "/staff"
        : `/staff?department=${encodeURIComponent(departmentFilter)}`;
      const data = await apiRequest(url);
      const filteredStaff = (data.staff || []).filter(
        (s) => s.role === "nurse" || s.role === "physician" || s.role === "doctor"
      );
      setStaff(filteredStaff);
    } catch (err) {
      alert(err.message || "Error clocking in");
    }
  }

  async function handleClockOut(staffId) {
    try {
      await apiRequest(`/staff/${staffId}/clock-out`, {
        method: "POST",
      });

      // Reload staff data immediately
      const url = departmentFilter === "all"
        ? "/staff"
        : `/staff?department=${encodeURIComponent(departmentFilter)}`;
      const data = await apiRequest(url);
      const filteredStaff = (data.staff || []).filter(
        (s) => s.role === "nurse" || s.role === "physician" || s.role === "doctor"
      );
      setStaff(filteredStaff);
    } catch (err) {
      alert(err.message || "Error clocking out");
    }
  }

  const onDutyStaff = staff.filter((s) => s.on_duty);
  const offDutyStaff = staff.filter((s) => !s.on_duty);

  return (
    <div className="page-gradient flex justify-center">
      <main className="w-full container-staff">
        <header className="header-section">
          <h1 className="heading-1">Staff Management</h1>
          <p className="subtitle">
            Track staff availability and manage shifts
          </p>
        </header>

        <div className="flex gap-3 section-margin">
          <TabSwitcher
            tabs={[
              { label: "Board", to: "/staff-dashboard", permission: "canViewDashboard" },
              { label: "Analytics", to: "/staff-analytics", permission: "canViewAnalytics" },
              { label: "Staff", to: "/staff-management", permission: "canViewStaffManagement" },
            ]}
          />

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="select-standard ml-auto"
          >
            <option value="all">All Departments</option>
            <option value="Emergency">Emergency</option>
            <option value="Pediatrics">Pediatrics</option>
            <option value="Cardiology">Cardiology</option>
            <option value="Radiology">Radiology</option>
          </select>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-10">
            <p className="text-slate-300">Loading staff...</p>
          </div>
        ) : (
          <>
            {/* On Duty Section */}
            <section className="section-margin">
              <h2 className="heading-2 mb-4">
                On Duty ({onDutyStaff.length})
              </h2>
              {onDutyStaff.length === 0 ? (
                <p className="text-empty">No staff currently on duty</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {onDutyStaff.map((member) => (
                    <div
                      key={member.staff_id}
                      className="card-standard"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="heading-3">{member.name}</h3>
                            <span
                              className={`${
                                ROLE_COLORS[member.role] || "bg-gray-500"
                              } text-small px-2 py-1 rounded-full`}
                            >
                              {member.role}
                            </span>
                          </div>
                          <p className="text-body text-slate-300">
                            Department: {member.department_name}
                          </p>
                          <p className="text-small text-slate-400 mt-1">
                            Clocked in: {new Date(member.clock_in).toLocaleTimeString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleClockOut(member.staff_id)}
                          className="btn-danger"
                        >
                          Clock Out
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Off Duty Section */}
            <section>
              <h2 className="heading-2 mb-4">
                Off Duty ({offDutyStaff.length})
              </h2>
              {offDutyStaff.length === 0 ? (
                <p className="text-empty">All staff are on duty</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {offDutyStaff.map((member) => (
                    <div
                      key={member.staff_id}
                      className="card-standard opacity-70"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="heading-3">{member.name}</h3>
                            <span
                              className={`${
                                ROLE_COLORS[member.role] || "bg-gray-500"
                              } text-small px-2 py-1 rounded-full`}
                            >
                              {member.role}
                            </span>
                          </div>
                          <p className="text-body text-slate-300">
                            Department: {member.department_name}
                          </p>
                        </div>
                        {member.active ? (
                          <button
                            onClick={() => handleClockIn(member.staff_id)}
                            className="btn-success"
                          >
                            Clock In
                          </button>
                        ) : (
                          <span className="text-small text-slate-500 italic">Inactive</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
