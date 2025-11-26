import { useParams, useNavigate } from "react-router-dom";

// MOCK DATABASE
const MOCK_PATIENTS = {
  1: {
    name: "Gustavo",
    triage: "Level 3 - Urgent",
    dob: "05/12/1999",
    phone: "(123) 456-7890",
    symptoms: "Chest pain and shortness of breath.",
    nurse1: "Nurse Kelly",
    nurse2: "Nurse Sam",
    doctor: "Dr. Williams",
    caseManager: "Pat Caseworker",
    arrival: "[2025-10-17 09:05 PM]",
    waited: "20 minutes",
    serviceStart: "[2025-10-17 09:25 PM]",
    serviceEnd: "[TBD]",
  },
};

export default function PatientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const patient = MOCK_PATIENTS[id] || {
    name: "Unknown Patient",
    triage: "N/A",
    dob: "N/A",
    phone: "N/A",
    symptoms: "N/A",
    nurse1: "N/A",
    nurse2: "N/A",
    doctor: "N/A",
    caseManager: "N/A",
    arrival: "[TIMESTAMP]",
    waited: "N/A",
    serviceStart: "[TIMESTAMP]",
    serviceEnd: "[TIMESTAMP]",
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-medqDark to-medqDeep text-white flex justify-center">
      <div className="w-full max-w-2xl px-6 py-10">
        {/* Back + Title */}
        <button
          onClick={() => navigate(-1)}
          className="text-sm mb-4 hover:underline"
        >
          ← Back to Queue
        </button>

        <h1 className="text-3xl font-bold mb-6">Patient Information</h1>

        {/* Patient Info */}
        <section className="space-y-4 text-sm leading-relaxed">
          <div>
            <p className="font-semibold">Patient Name</p>
            <p>{patient.name}</p>
            <p>{patient.triage}</p>
            <p>{patient.dob}</p>
            <p>{patient.phone}</p>
          </div>

          <div>
            <p className="font-semibold">Patient Sympton Description</p>
            <p>{patient.symptoms}</p>
          </div>

          <div>
            <p className="font-semibold">Assigned Staff:</p>
            <p>Nurse Name: {patient.nurse1}</p>
            <p>Nurse Name: {patient.nurse2}</p>
            <p>Doctor Name: {patient.doctor}</p>
            <p>Patient Case Manager: {patient.caseManager}</p>
          </div>

          <div>
            <p className="font-semibold">Time Metrics</p>
            <p>Arrival Time: {patient.arrival}</p>
            <p>Time waited: {patient.waited}</p>
            <p>Service Start: {patient.serviceStart}</p>
            <p>Service End: {patient.serviceEnd}</p>
          </div>
        </section>

        {/* Bottom Buttons */}
        <div className="mt-8 flex gap-3">
          <button className="px-6 py-2 rounded-xl bg-medqPink text-sm font-semibold shadow-md">
            Transfer
          </button>
          <button className="px-6 py-2 rounded-xl bg-medqPink text-sm font-semibold shadow-md">
            Discharge
          </button>
        </div>
      </div>
    </div>
  );
}