import { useState, useEffect } from "react";

export default function AssignStaffModal({ isOpen, onClose, onAssign, availableStaff, patientName }) {
  const [selectedStaffId, setSelectedStaffId] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSelectedStaffId("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAssign = () => {
    if (!selectedStaffId) {
      alert("Please select a staff member");
      return;
    }
    onAssign(selectedStaffId);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#2D3047] rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-2xl font-bold mb-4 text-white">Assign Staff Member</h2>
        <p className="text-slate-300 text-sm mb-6">
          Select a staff member to assign to <span className="font-semibold">{patientName}</span>
        </p>

        {availableStaff.length === 0 ? (
          <div className="mb-6">
            <p className="text-red-300 text-sm">
              No staff members are currently clocked in for this department.
            </p>
          </div>
        ) : (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-white mb-2">
              Staff Member
            </label>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full rounded-xl bg-[#1a1d2e] border border-slate-600/70 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-medqPink"
            >
              <option value="">Select a staff member...</option>
              {availableStaff.map((staff) => (
                <option key={staff.staff_id} value={staff.staff_id}>
                  {staff.name} ({staff.role})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-slate-600 text-sm font-semibold shadow-md hover:bg-slate-500"
          >
            Cancel
          </button>
          {availableStaff.length > 0 && (
            <button
              onClick={handleAssign}
              className="px-6 py-2 rounded-xl bg-medqPink text-sm font-semibold shadow-md hover:bg-medqPink/90"
            >
              Assign
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
