import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
    <div className='min-h-screen grid grid-rows-[auto,1fr] bg-gradient-to-b from-medqDark to-medqDeep text-white overflow-y-auto'>
      {/* Header */}
      <header className='pt-6 pb-0 flex flex-col items-center pointer-events-none sm:gap-1 mb-4 sm:mb-6'>
          <img
            src={medqLogo}
            alt="Med-Q Logo"
            className='block h-32 object-contain drop-shadow-lg'
          />
          <h1 className='text-2xl md:text-[42px] tracking-wide text-white leading-tight'>
            Med-Q
          </h1>
      </header>

      {/* Form */}
      <main className='px-6 flex justify-center py-8 md:py-12'>
        <form 
          onSubmit={handleSubmit} 
          className='w-[360px] space-y-4 text-[15px] font-medium'
        >
          <h2 className='text-lg font-semibold leading-snug mb-4 '>
            Welcome. Please fill out the following so we can better give the care you need.
          </h2>

          {/* Name */}
          <div className='space-y-1'>
            <label className='text-sm block mb-1'>
              Name:
              <input
                type='text'
                name='name'
                placeholder='Last M First'
                value={formData.name}
                onChange={handleChange}
                className='w-full rounded-md bg-transparent border border-white/30 px-3 py-2 text-white placeholder-white/50 focus:border-medqPink outline-none'
                required
              />
            </label>
          </div>

          {/* Date of Birth */}
          <div className='space-y-1'>
            <label className='text-sm block mb-1'>
              Date of Birth:
              <input
                type='date'
                name='dob'
                value={formData.dob}
                onChange={handleChange}
                className='w-full rounded-md bg-transparent border border-white/30 px-3 py-2 text-white/50 focus:border-medqPink outline-none uppercase'
                required
              />
            </label>
          </div>
          
          {/* Reason */}
          <div className='space-y-1'>
            <label className='text-sm block'>Reason for Visit:</label>
            {!isReasonOpen && (
              <button
                type='button'
                onClick={openReasonList}
                className='w-full text-left rounded-md bg-transparent border border-white/30 px-3 py-2
                           text-white/50 hover:text-white focus:border-medqPink outline-none'
                aria-haspopup="listbox"
                aria-expanded={isReasonOpen}  
              >
                {formData.reason ? formData.reason : "Select a reason..."}
              </button>
            )}

            {isReasonOpen && (
              <select
                ref={reasonListRef}
                name='reason'
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
                className='w-full rounded-md bg-transparent text-white border border-white/30 py-2 pl-3'
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
                type='text'
                name='customReason'
                value={formData.customReason || ""}
                onChange={handleChange}
                placeholder='Briefly describe your reason'
                className="mt-2 w-full rounded-md bg-transparent border border-white/30 text-white
                placeholder-white/50 focus:outline-none focus:border-medqPink px-3 py-2"
                required
              />
            )}
          </div>

          {/* Phone */}
          <div className='space-y-1'>
            <label className='text-sm block mb-1'>
              Phone Number:
              <input
                type='tel'
                name='phone'
                placeholder='(123) 456-7890'
                value={formData.phone}
                onChange={handleChange}
                className='w-full rounded-md bg-transparent border border-white/30 px-3 py-2 text-white placeholder-white/50 focus:border-medqPink outline-none'
                required
              />
            </label>
          </div>

          {/* Button */}
          <button 
            type='submit' 
            className="w-full mt-4 bg-medqPink hover:bg-pink-400 py-2 rounded-md font-semibold transition-colors"
          >
            Continue
          </button>
        </form>
      </main>
    </div>
  );
}