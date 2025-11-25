import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import medqLogo from "../assets/images/medq-logo.png";

const REASONS = [
  "Fever", "Cough", "Headache", "Chest pain", "Shortness of breath",
  "Abdominal pain", "Nausea/Vomiting", "Diarrhea", "Allergic reaction",
  "Injury/Trauma", "Medication refill", "Follow-up appointment",
  "Lab work", "Immunization shot", "Physical Exam", "COVID-19 symptoms",
  "Flu symptoms", "Skin issue", "Ear pain", "Sore throat", "Back pain",
  "Pregnancy", "Mental health", "Other"
];

export default function PatientCheckIn() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    dob: "",
    reason: "",
    customReason: "",
    phone: "",
  });

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

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.reason) {
      alert("Please select a reason for your visit.");
      openReasonList();
      return;
    }

    if (formData.reason === "Other" && !formData.customReason.trim()) {
      alert("Please describe your reason under 'Other'.");
      return;
    }

    // TODO: Implement into database
    console.log("Submitted:", formData);
    alert("Check-in data submitted");

    navigate("/queue-status");
  };

  return (
    <div className="medq-page">
      {/* Header */}
      <header className="medq-logo-header">
        <img src={medqLogo} alt="Med-Q Logo" />
        <h1>Med-Q</h1>
      </header>

      {/* Form */}
      <main className="medq-form-shell">
        <form
          onSubmit={handleSubmit}
          className="medq-form-card medq-form"
        >
          <h2 className="medq-form-title">
            Welcome. Please fill out the following so we can better give the care you need.
          </h2>

          {/* Name */}
          <div className="space-y-1">
            <label className="medq-field-label">
              Name
              <input
                type="text"
                name="name"
                placeholder="Last M First"
                value={formData.name}
                onChange={handleChange}
                className="medq-field"
                required
              />
            </label>
          </div>

          {/* Date of Birth */}
          <div className="space-y-1">
            <label className="medq-field-label">
              Date of Birth
              <input
                type="date"
                name="dob"
                value={formData.dob}
                onChange={handleChange}
                className="medq-field"
                required
              />
            </label>
          </div>

          {/* Reason */}
          <div className="space-y-1">
            <label className="medq-field-label">Reason for Visit</label>
            {!isReasonOpen && (
              <button
                type="button"
                onClick={openReasonList}
                className="medq-field medq-field-button"
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
                className="medq-field"
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
                className="medq-field mt-2"
                required
              />
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <label className="medq-field-label">
              Phone Number
              <input
                type="tel"
                name="phone"
                placeholder="(123) 456-7890"
                value={formData.phone}
                onChange={handleChange}
                className="medq-field"
                required
              />
            </label>
          </div>

          {/* Button */}
          <button
            type="submit"
            className="medq-btn-primary"
          >
            Continue
          </button>
        </form>
      </main>
    </div>
  );
}