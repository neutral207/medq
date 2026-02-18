import { useEffect, useState } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { apiRequest } from "../apiClient";
import { getCurrentUser } from "../utils/authApi";

function formatDate(dateString) {
  if (!dateString) return "N/A";
  const [year, month, day] = dateString.split("-");
  return `${month}/${day}/${year}`;
}

function formatDateTime(dateString) {
  if (!dateString) return "N/A";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "N/A"
  return d.toLocaleString([], { dateStyle: "short", timeStyle: "short"});
}

function getTriageLabel(severity) {
  if (severity == null) return "N/A";
  const map = {
    1: "Level 1 - Non-urgent",
    2: "Level 2 - Less urgent",
    3: "Level 3 - Urgent",
    4: "Level 4 - Emergency",
    5: "Level 5 - Critical",
  };
  return map[severity] || `Severity ${severity}`;
}

const ROLE_COLORS = {
  nurse: "bg-blue-500",
  physician: "bg-purple-500",
  doctor: "bg-orange-500",
  admin: "bg-red-500",
};

export default function PatientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = getCurrentUser();

  const [visit, setVisit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    async function loadVisit() {
      try {
        setLoading(true)
        setError("")

        const data = await apiRequest(`/visit/${id}`);
        setVisit(data.visit);
      } catch (err) {
        console.error(err);
        setError(err.message || "Error loading patient details.");
      } finally {
        setLoading(false);
      }
    }

    loadVisit();
  }, [id]);

  useEffect(() => {
    async function loadNotes() {
      try {
        setNotesLoading(true);
        const data = await apiRequest(`/visit/${id}/notes`);
        setNotes(data.notes || []);
      } catch (err) {
        console.error("Error loading notes:", err);
      } finally {
        setNotesLoading(false);
      }
    }
    loadNotes();
  }, [id]);

  const handleBack = () => {
    const fromDate = location.state?.fromDate;
    const fromDepartment = location.state?.fromDepartment;
    const fromStatusFilter = location.state?.fromStatusFilter;

    if (fromDate || fromDepartment || fromStatusFilter) {
      navigate("/staff-dashboard", {
        state: {
          fromDate,
          fromDepartment,
          fromStatusFilter,
        },
      });
    } else {
      navigate(-1);
    }
  };

  async function updateStatus(newStatus) {
    if (!visit || visit.status === newStatus) return;
    setStatusError("");
    setUpdatingStatus(true);

    const previousStatus = visit.status;
    setVisit((prev) => ({ ...prev, status: newStatus }));

    try {
      await apiRequest(`/visit/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      console.error(err);
      setStatusError(err.message || "Error updating status.");
      setVisit((prev) => ({ ...prev, status: previousStatus }));
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      const data = await apiRequest(`/visit/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({ content: newNote.trim() }),
      });
      setNotes((prev) => [
        {
          note_id: data.note_id,
          content: data.content,
          staff_id: currentUser?.staff_id,
          staff_name: currentUser?.full_name || "You",
          staff_role: currentUser?.role || "",
          created_at: data.created_at,
        },
        ...prev,
      ]);
      setNewNote("");
    } catch (err) {
      console.error("Error adding note:", err);
    } finally {
      setAddingNote(false);
    }
  }

  async function handleEditNote(noteId) {
    if (!editContent.trim()) return;
    try {
      await apiRequest(`/visit/${id}/notes/${noteId}`, {
        method: "PATCH",
        body: JSON.stringify({ content: editContent.trim() }),
      });
      setNotes((prev) =>
        prev.map((n) =>
          n.note_id === noteId ? { ...n, content: editContent.trim() } : n
        )
      );
      setEditingNoteId(null);
      setEditContent("");
    } catch (err) {
      console.error("Error editing note:", err);
    }
  }

  async function handleDeleteNote(noteId) {
    try {
      await apiRequest(`/visit/${id}/notes/${noteId}`, {
        method: "DELETE"
      });
      setNotes((prev) => prev.filter((n) => n.note_id !== noteId));
    } catch (err) {
      console.error("Error deleting note:", err);
    }
  }

  if (loading) {
    return (
      <div className="page-gradient flex justify-center">
        <div className="w-full container-patient">
          <button
            onClick={handleBack}
            className="btn-primary mb-4"
          >
            ← Back to Dashboard
          </button>
          <p className="text-body text-white/80">Loading patient information...</p>
        </div>
      </div>
    );
  }

  if (error || !visit) {
    return (
      <div className="page-gradient flex justify-center">
        <div className="w-full container-patient">
          <button
            onClick={handleBack}
            className="btn-primary mb-4"
          >
            ← Back to Dashboard
          </button>
          <p className="text-body text-red-300">
            {error || "Unable to load patient information."}
          </p>
        </div>
      </div>
    );
  }

  const triage = getTriageLabel(visit.severity);
  const dob = formatDate(visit.dob);
  const checkin_time = formatDateTime(visit.checkin_time);
  const serviceStart = formatDateTime(visit.service_start);
  const serviceEnd = formatDateTime(visit.service_end);

  return (
    <div className="page-gradient flex justify-center">
      <div className="w-full container-patient">
        {/* Back + Title */}
        <button
          onClick={handleBack}
          className="btn-primary mb-4"
        >
          ← Back to Dashboard
        </button>

        <div className="flex items-center gap-4 mb-6">
          <h1 className="heading-1">Patient Information</h1>
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full ${
              visit.status === "waiting"
                ? "bg-yellow-400 text-black"
                : visit.status === "in-progress"
                ? "bg-cyan-400 text-black"
                : visit.status === "completed"
                ? "bg-green-400 text-black"
                : "bg-slate-500 text-white"
            }`}
          >
            {visit.status?.replace("-", " ") || "N/A"}
          </span>
        </div>

        {/* Patient Info */}
        <section className="space-y-4 text-body leading-relaxed">
          {/* Patient Details Card */}
          <div className="card-standard">
            <h3 className="heading-3 mb-3">Patient Details</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-label">Name</span>
                <p className="font-medium">{visit.name}</p>
              </div>
              <div>
                <span className="text-label">Triage Level</span>
                <p className="font-medium">{triage}</p>
              </div>
              <div>
                <span className="text-label">Date of Birth</span>
                <p className="font-medium">{dob}</p>
              </div>
              <div>
                <span className="text-label">Phone</span>
                <p className="font-medium">{visit.phone || "N/A"}</p>
              </div>
            </div>
          </div>

          {/* Department & Symptoms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card-standard">
              <h3 className="heading-3 mb-2">Department</h3>
              <p className="text-sm">{visit.department}</p>
            </div>
            <div className="card-standard">
              <h3 className="heading-3 mb-2">Assigned Staff</h3>
              {visit.assigned_staff_name ? (
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={`${
                      ROLE_COLORS[visit.assigned_staff_role] || "bg-gray-500"
                    } text-xs px-2 py-0.5 rounded-full`}
                  >
                    {visit.assigned_staff_role === "physician" || visit.assigned_staff_role === "doctor"
                      ? "Doctor"
                      : visit.assigned_staff_role === "nurse"
                      ? "Nurse"
                      : "Staff"}
                  </span>
                  <span>{visit.assigned_staff_name}</span>
                </div>
              ) : (
                <p className="text-empty text-sm">Not yet assigned</p>
              )}
            </div>
          </div>

          {/* Symptoms Card */}
          <div className="card-standard">
            <h3 className="heading-3 mb-2">Patient Symptom Description</h3>
            <p className="text-sm text-content">{visit.symptoms}</p>
          </div>

          {/* Time Metrics Card */}
          <div className="card-standard">
            <h3 className="heading-3 mb-3">Time Metrics</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-label">Check-In Time</span>
                <p className="font-mono font-medium">{checkin_time}</p>
              </div>
              <div>
                <span className="text-label">Service Start</span>
                <p className="font-mono font-medium">{serviceStart}</p>
              </div>
              <div>
                <span className="text-label">Service End</span>
                <p className="font-mono font-medium">{serviceEnd}</p>
              </div>
            </div>
          </div>
        </section>
        
        {/* Notes */}
        <section className="mt-8">
          <h2 className="heading-2 mb-4">Notes</h2>

          {/* Add Note */}
          <div className="card-standard mb-4">
            <textarea 
              className="w-full note-textarea border rounded-lg p-3 text-sm resize-none focus:outline-none"
              rows={3}
              placeholder="Add a note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAddNote();
              }}
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-label">Ctrl+Enter to submit</span>
              <button
                onClick={handleAddNote}
                disabled={addingNote || !newNote.trim()}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {addingNote ? "Adding..." : "Add Note"}
              </button>
            </div>
          </div>

          {/* Notes List */}
          {notesLoading ? (
            <p className="text-slate-400 text-sm">Loading notes...</p>
          ) : notes.length === 0 ? (
            <p className="text-empty">No notes yet for this visit.</p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.note_id} className="card-standard">
                  {/* Header: author + timestamp */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm">{note.staff_name}</span>
                    {note.staff_role && (
                      <span
                        className={`${
                          ROLE_COLORS[note.staff_role] || "bg-gray-500"
                        } text-xs px-2 py-0.5 rounded-full`}
                      >
                        {note.staff_role}
                      </span>
                    )}
                    <span className="text-xs text-label ml-auto">
                      {formatDateTime(note.created_at)}
                    </span>
                  </div>

                  {/* Content (or edit mode) */}
                  {editingNoteId === note.note_id ? (
                    <div>
                      <textarea
                        className="w-full note-textarea border rounded-lg p-2 text-sm resize-none focus:outline-none"
                        rows={3}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          onClick={() => { setEditingNoteId(null); setEditContent(""); }}
                          className="btn-small"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleEditNote(note.note_id)}
                          className="btn-primary text-sm"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-content whitespace-pre-wrap">
                      {note.content}
                    </p>
                  )}

                  {/* Edit/Delete buttons (only for own notes) */}
                  {currentUser?.staff_id === note.staff_id &&
                    editingNoteId !== note.note_id && (
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          onClick={() => {
                            setEditingNoteId(note.note_id);
                            setEditContent(note.content);
                          }}
                          className="text-xs text-label hover:text-medqPink transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note.note_id)}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}