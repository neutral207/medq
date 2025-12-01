import os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Blueprint, request, jsonify
from src.app.errors import ApiError
import joblib
import pandas as pd
import os

api_bp = Blueprint("api", __name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/medq",
)

def get_conn():
    return psycopg2.connect(DATABASE_URL)

@api_bp.get("/queue")
def get_queue():
    department_name = request.args.get("department", "Emergency")

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT v.visit_id,
                    p.anon_token,
                    p.severity,
                    p.full_name,
                    p.dob,
                    p.phone,
                    p.symptoms,
                    v.checkin_time,
                    v.predicted_wait_minutes
                FROM visits v
                JOIN patients p ON p.patient_id = v.patient_id
                JOIN departments d ON d.dept_id = v.dept_id
                WHERE d.name = %s
                    AND v.status = 'queued'
                ORDER BY v.checkin_time ASC;
                """,
                (department_name,),
            )
            rows = cur.fetchall()
    queue = [
        {
            "visit_id": str(row["visit_id"]),
            "anon_token": row["anon_token"],
            "severity": row["severity"],
            "name": row["full_name"],
            "dob": row["dob"].isoformat() if row["dob"] else None,
            "phone": row["phone"],
            "symptoms": row["symptoms"],
            "checkin_time": row["checkin_time"].isoformat() if row["checkin_time"] else None,
            "predicted_wait_minutes": row["predicted_wait_minutes"],
        }
        for row in rows
    ]
    return jsonify({"department": department_name, "queue": queue})

@api_bp.post("/checkin")
def check_in():
    if not request.is_json:
        raise ApiError("Content-Type must be application/json", code=415)
    
    data = request.get_json(silent=True) or {}

    department_name = data.get("department") or "Emergency"
    symptoms = data.get("symptoms")
    severity = int(data.get("severity") or 3)
    source = data.get("source") or "kiosk"
    full_name = (data.get("name") or "").strip()
    dob = data.get("dob")
    phone = (data.get("phone") or "").strip()
    
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT dept_id FROM departments WHERE name = %s",
                (department_name,),
            )
            dept_row = cur.fetchone()
            if not dept_row:
                raise ApiError(f"Unknown department: {department_name}", code=400)
            dept_id = dept_row["dept_id"]

            cur.execute(
                """
                INSERT INTO patients (anon_token, severity, symptoms, source, full_name, dob, phone)
                VALUES (
                    substr(encode(digest(gen_random_uuid()::text, 'sha1'), 'hex'),1,12),
                    %s, %s, %s,
                    %s, %s, %s
                )
                RETURNING patient_id, anon_token;
                """,
                (severity, symptoms, source, full_name, dob, phone),
            )
            patient_row = cur.fetchone()
            if patient_row is None:
                raise ApiError("Failed to create patient record", code=500)

            cur.execute(
                """
                INSERT INTO visits (
                    patient_id, dept_id, status, predicted_wait_minutes
                )
                VALUES (%s, %s, 'queued', %s)
                RETURNING visit_id, checkin_time, predicted_wait_minutes, status;
                """,
                (patient_row["patient_id"], dept_id, 30),
            )
            visit_row = cur.fetchone()
            if visit_row is None:
                raise ApiError("Failed to create visit record", code=500)
    
    visit = {
        "visit_id": str(visit_row["visit_id"]),
        "anon_token": patient_row["anon_token"],
        "severity": severity,
        "symptoms": symptoms,
        "checkin_time": visit_row["checkin_time"].isoformat()
        if visit_row["checkin_time"]
        else None,
        "predicted_wait_minutes": visit_row["predicted_wait_minutes"],
        "status": visit_row["status"],
        "department": department_name,
        "name": full_name,
        "dob": dob,
        "phone": phone,
    }

    # TODO: write to database
    return jsonify({"message": "checked in", "visit": visit}), 201

@api_bp.get("/visit/<visit_id>")
def get_visit(visit_id):
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    v.visit_id,
                    v.checkin_time,
                    v.service_start,
                    v.service_end,
                    v.status,
                    v.predicted_wait_minutes,
                    v.actual_wait_minutes,
                    p.anon_token,
                    p.full_name,
                    p.dob,
                    p.phone,
                    p.symptoms,
                    p.severity,
                    d.name AS department_name
                FROM visits v
                JOIN patients p ON p.patient_id = v.patient_id
                JOIN departments d ON d.dept_id = v.dept_id
                WHERE v.visit_id = %s;
                """,
                (visit_id,),
            )
            row = cur.fetchone()

    if not row:
        raise ApiError(f"Visit not found: {visit_id}", code=404)
    
    visit = {
        "visit_id": str(row["visit_id"]),
        "status": row["status"],
        "checkin_time": row["checkin_time"].isoformat()
            if row["checkin_time"] else None,
        "service_start": row["service_start"].isoformat()
            if row["service_start"] else None,
        "service_end": row["service_end"].isoformat()
            if row["service_end"] else None,
        "predicted_wait_minutes": row["predicted_wait_minutes"],
        "actual_wait_minutes": row["actual_wait_minutes"],
        "anon_token": row["anon_token"],
        "name": row["full_name"],
        "dob": row["dob"].isoformat() if row["dob"] else None,
        "phone": row["phone"],
        "symptoms": row["symptoms"],
        "severity": row["severity"],
        "department": row["department_name"],
    }

    return jsonify({ "visit": visit })
    data = request.get_json(silent=True) or {}
    if "department" not in data:
        raise ApiError("Missing field: department", code=422)
    return jsonify(message="checked in", data=data), 201

# Load model at startup
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "ml", "wait_time_model.pkl")
MODEL_PATH = os.path.abspath(MODEL_PATH)

try:
    model = joblib.load(MODEL_PATH)
    print(f"Loaded wait time model from {MODEL_PATH}")
except Exception as e:
    print(f"Error loading model: {e}")
    model = None

@api_bp.route("/predict_wait", methods=["POST"])
def predict_wait():
    if model is None:
        return jsonify({"error": "Model not available"}), 500

    data = request.get_json()

    # Required fields for prediction
    required = ["severity", "hour_of_day", "queue_length", "staff_in_service"]

    missing = [field for field in required if field not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    # Convert single JSON input to DataFrame
    df = pd.DataFrame([{
        "severity": data["severity"],
        "hour_of_day": data["hour_of_day"],
        "queue_length": data["queue_length"],
        "staff_in_service": data["staff_in_service"]
    }])

    try:
        prediction = model.predict(df)[0]
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify({
        "predicted_wait_minutes": round(float(prediction), 2)
    })
