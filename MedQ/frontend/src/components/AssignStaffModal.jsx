import { useState, useEffect } from "react";

export default function AssignStaffModal({ isOpen, onClose, onAssign, availableStaff, patientName, patientDepartment }) {
  const [selectedStaffId, setSelectedStaffId] = useState("");

  // Filter staff to only show those from the patient's department
  const departmentStaff = availableStaff.filter(
    (staff) => {
      // Case-insensitive comparison to handle any naming variations
      const staffDept = staff.department_name?.toLowerCase() || '';
      const patientDept = patientDepartment?.toLowerCase() || '';
      return staffDept === patientDept;
    }
  );

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
      <div className="card-modal w-full max-w-md">
        <h2 className="heading-2 mb-4 text-white">Assign Staff Member</h2>
        <p className="subtitle mb-6">
          Select a staff member to assign to <span className="font-semibold">{patientName}</span>
        </p>

        {departmentStaff.length === 0 ? (
          <div className="mb-6">
            <p className="text-body text-red-300">
              No staff members from the {patientDepartment} department are currently clocked in.
            </p>
          </div>
        ) : (
          <div className="mb-6">
            <label className="block text-body font-semibold text-white mb-2">
              Staff Member ({patientDepartment})
            </label>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="select-standard w-full"
            >
              <option value="">Select a staff member...</option>
              {departmentStaff.map((staff) => (
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
            className="btn-secondary"
          >
            Cancel
          </button>
          {departmentStaff.length > 0 && (
            <button
              onClick={handleAssign}
              className="btn-primary"
            >
              Assign
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
