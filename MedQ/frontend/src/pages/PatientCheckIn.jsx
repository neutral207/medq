import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import medqLogo from "../assets/images/medq-logo.png";
import { apiRequest } from "../apiClient";
import ThemeToggle from "../components/ThemeToggle";

const REASONS = [
  "Fever", "Cough", "Headache", "Chest pain", "Shortness of breath",
  "Abdominal pain", "Nausea/Vomiting", "Diarrhea", "Allergic reaction",
  "Injury/Trauma", "Medication refill", "Follow-up appointment",
  "Lab work", "Immunization shot", "Physical Exam", "COVID-19 symptoms",
  "Flu symptoms", "Skin issue", "Ear pain", "Sore throat", "Back pain",
  "Pregnancy", "Mental health", "Other"
];

function assignDeptAndSeverity(reason) {
  const r = (reason || "").toLowerCase();

  // default
  let department = "Emergency";
  let severity = 3;

  if (r.includes("chest") || r.includes("shortness") || r.includes("allergic")) {
    department = "Emergency";
    severity = 4;
  } else if (r.includes("injury") || r.includes("trauma")) {
    department = "Emergency";
    severity = 4;
  } else if (r.includes("pregnancy")) {
    department = "Pediatrics";
    severity = 3;
  } else if (r.includes("mental")) {
    department = "Emergency";
    severity = 3;
  } else if (r.includes("lab work") || r.includes("immunization") || r.includes("physical")) {
    department = "Radiology";
    severity = 2;
  } else if (r.includes("follow-up") || r.includes("medication refill")) {
    department = "Radiology";
    severity = 1;
  } else if (r.includes("fever") || r.includes("cough") || r.includes("flu") || r.includes("covid") || r.includes("sore throat")) {
    department = "Pediatrics";
    severity = 2;
  }

  return { department, severity };
}

export default function PatientCheckIn() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    dob: "",
    reason: "",
    customReason: "",
    phone: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [isReasonOpen, setIsReasonOpen] = useState(false);
  const reasonListRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openReasonList = () => {
    setIsReasonOpen(true);
    setTimeout(() => reasonListRef.current?.focus(), 0);
  }

  const closeReasonList = () => {
    setTimeout(() => setIsReasonOpen(false), 100);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const chosenReason =
        formData.reason === "Other"
          ? formData.customReason
          : formData.reason;

      const { department, severity } = assignDeptAndSeverity(chosenReason);

      const payload = {
        name: formData.name,
        dob: formData.dob,
        symptoms: chosenReason,
        phone: formData.phone,
        department,
        severity,
      };

      // Use direct fetch to avoid auth redirect for public endpoint
      const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";
      const response = await fetch(`${API_BASE}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to check in");
      }

      const data = await response.json();
      const { visit } = data;

      if (!visit) {
        throw new Error("Missing 'visit' field.");
      }

      navigate("/queue-status", {
        state: {
          visitId: visit.visit_id,
          anonToken: visit.anon_token,
          department: visit.department,
          initialWait: visit.predicted_wait_minutes,
          severity: visit.severity,
          queuePosition: visit.queue_position,
        },
      });
    } catch (err) {
      console.error(err);
      setError(err.message || "Error submitting check-in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-gradient grid grid-rows-[auto,1fr] overflow-y-auto relative">
      {/* Theme Toggle - Top Right */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* Header */}
      <header className="pt-6 pb-0 flex flex-col items-center pointer-events-none sm:gap-1 mb-4 sm:mb-6">
        <img src={medqLogo} alt="Med-Q Logo" className="block h-32 object-contain drop-shadow-lg" />
        <h1 className="text-2xl md:text-[42px] tracking-wide leading-tight">Med-Q</h1>
      </header>

      {/* Form */}
      <main className="px-6 flex justify-center py-8 md:py-12">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-[360px] space-y-4 text-[15px] font-medium"
        >
          <h2 className="text-lg font-semibold leading-snug mb-4">
            Welcome. Please fill out the following so we can better give the care you need.
          </h2>

          {/* Name */}
          <div className="space-y-1">
            <label className="text-sm block mb-1">
              Name
              <input
                type="text"
                name="name"
                placeholder="Last M First"
                value={formData.name}
                onChange={handleChange}
                className="w-full rounded-md input-form border px-3 py-2 focus:border-medqPink outline-none"
                required
              />
            </label>
          </div>

          {/* Date of Birth */}
          <div className="space-y-1">
            <label htmlFor="dob" className="text-sm block mb-1">
              Date of Birth
              <input
                type="date"
                name="dob"
                value={formData.dob}
                onChange={handleChange}
                className="w-full rounded-md input-form border px-3 py-2 focus:border-medqPink outline-none uppercase"
                required
              />
            </label>
          </div>

          {/* Reason */}
          <div className="space-y-1">
            <label className="text-sm block mb-1">Reason for Visit</label>
            {!isReasonOpen && (
              <button
                type="button"
                onClick={openReasonList}
                className="w-full text-left rounded-md input-form border px-3 py-2 focus:border-medqPink outline-none"
                aria-haspopup="listbox"
                aria-expanded={isReasonOpen}
              >
                {formData.reason ? formData.reason : "Select a reason..."}
              </button>
            )}

            {isReasonOpen && (
              <select
                ref={reasonListRef}
                name="reason"
                value={formData.reason || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "_placeholder") return;
                  setFormData((p) => ({ ...p, reason: v }));
                  closeReasonList();
                }}
                onBlur={closeReasonList}
                onKeyDown={(e) => e.key === "Escape" && closeReasonList()}
                size={8}
                className="w-full rounded-md input-form border py-2 pl-3"
                required
              >
                <option value="" disabled>Select a reason...</option>
                {REASONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            )}

            {formData.reason == "Other" && (
              <input
                type="text"
                name="customReason"
                value={formData.customReason || ""}
                onChange={handleChange}
                placeholder="Briefly describe your reason"
                className="mt-2 w-full rounded-md input-form border focus:outline-none focus:border-medqPink px-3 py-2"
                required
              />
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <label className="text-sm block mb-1">
              Phone Number
              <input
                type="tel"
                name="phone"
                placeholder="(123) 456-7890"
                value={formData.phone}
                onChange={handleChange}
                className="w-full rounded-md input-form border px-3 py-2 focus:border-medqPink outline-none"
                required
              />
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-300 bg-red-900/40 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 bg-medqPink hover:bg-pink-400 py-2 rounded-md font-semibold transition-colors disabled:opacity-60"
          >
            {loading ? "Submitting..." : "Continue"}
          </button>
        </form>
      </main>
    </div>
  );
}