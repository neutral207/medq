import os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Blueprint, request, jsonify
from src.app.errors import ApiError
import joblib
import pandas as pd
from datetime import datetime, timezone

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
                    v.status,
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
                    AND v.status <> 'left'
                ORDER BY v.checkin_time ASC;
                """,
                (department_name,),
            )
            rows = cur.fetchall()
    queue = [
        {
            "visit_id": str(row["visit_id"]),
            "status": row["status"],
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

def parse_date_param(name: str):
    
    value = request.args.get(name)
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        return None

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
                VALUES (%s, %s, 'waiting', %s)
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
  
@api_bp.patch("/visit/<visit_id>/status")
def update_visit_status(visit_id):
    if not request.is_json:
        raise ApiError("Content-Type must be application/json", code=415)
    
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")

    if new_status not in ("waiting", "in-progress", "completed", "left"):
        raise ApiError("Invalid status value", code=400)

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    status,
                    service_start
                FROM visits
                WHERE visit_id = %s;
                """,
                (visit_id,),
            )
            current = cur.fetchone()
            if not current:
                raise ApiError(f"Visit not found: {visit_id}", code=404)

            now = datetime.now(timezone.utc)

            updates = { "status": new_status }

            # If we go back to waiting, clear timers (nurse wasn't ready / patient sent back)
            if new_status == "waiting":
                updates["service_start"] = None
                updates["service_end"] = None

            # When moving into in-progress, start service clock (if not already started)
            elif new_status == "in-progress" and current["service_start"] is None:
                updates["service_start"] = now
            
            # When moving into completed, end service
            elif new_status == "completed":
                # If service_start was never set, set it now
                if current["service_start"] is None:
                    updates["service_start"] = now
                updates["service_end"] = now

            set_clauses = []
            params = []
            for col, val in updates.items():
                set_clauses.append(f"{col} = %s")
                params.append(val)
            params.append(visit_id)

            cur.execute(
                f"""
                UPDATE visits
                SET {', '.join(set_clauses)}
                WHERE visit_id = %s
                RETURNING visit_id, status, service_start, service_end;
                """,
                params,
            )
            row = cur.fetchone()
            conn.commit()

    return jsonify({
        "visit_id": str(row["visit_id"]),
        "status": row["status"],
        "service_start": row["service_start"].isoformat() if row["service_start"] else None,
        "service_end": row["service_end"].isoformat() if row["service_end"] else None,
    }), 200
  
# -----------------------------
# MODEL LOADING
# -----------------------------

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "ml", "wait_time_model.pkl")
MODEL_PATH = os.path.abspath(MODEL_PATH)

try:
    model = joblib.load(MODEL_PATH)
    print(f"Loaded wait time model from {MODEL_PATH}")
except Exception as e:
    print(f"Error loading model: {e}")
    model = None


# -----------------------------
# DB CONNECTION HELPER
# -----------------------------

def get_db_conn():
    db_url = os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/medq"
    )
    return psycopg2.connect(db_url, cursor_factory=RealDictCursor)


# -----------------------------
# WAIT TIME PREDICTION ENDPOINT
# -----------------------------

@api_bp.route("/predict_wait", methods=["POST"])
def predict_wait():
    if model is None:
        return jsonify({"error": "Model not available"}), 500

    data = request.get_json()

    required = ["severity", "hour_of_day", "queue_length", "staff_in_service"]
    missing = [f for f in required if f not in data]

    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

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

    return jsonify({"predicted_wait_minutes": round(float(prediction), 2)})


# -----------------------------
# NEW SUMMARY ENDPOINT
# -----------------------------

@api_bp.get("/summary")
def summary():
    try:
        conn = get_db_conn()
        cur = conn.cursor()

        # 1. Queue count
        cur.execute("""
            SELECT COUNT(*) AS queue_count
            FROM visits
            WHERE status = 'queued';
        """)
        queue_count = cur.fetchone()["queue_count"]

        # 2. Average completed wait time today
        cur.execute("""
            SELECT AVG(actual_wait_minutes) AS avg_wait
            FROM visits
            WHERE status = 'completed'
              AND checkin_time::date = CURRENT_DATE;
        """)
        row = cur.fetchone()
        avg_wait = row["avg_wait"] or 0

        # 3. Staff currently in service
        cur.execute("""
            SELECT COUNT(DISTINCT assigned_staff) AS active_staff
            FROM visits
            WHERE status = 'in_service'
              AND assigned_staff IS NOT NULL;
        """)
        active_staff = cur.fetchone()["active_staff"]

        # 4. Hourly history for charts
        cur.execute("""
            SELECT bucket_start, arrivals, avg_wait_minutes, in_service
            FROM wait_time_agg_hourly
            ORDER BY bucket_start DESC
            LIMIT 6;
        """)
        rows = list(reversed(cur.fetchall()))

        queue_history = [r["arrivals"] for r in rows]
        avg_wait_history = [r["avg_wait_minutes"] for r in rows]
        staff_load_history = [r["in_service"] for r in rows]

        cur.close()
        conn.close()

        return jsonify({
            "queueCount": queue_count,
            "averageWait": round(float(avg_wait), 2),
            "activeStaff": active_staff,
            "queueHistory": queue_history,
            "averageWaitHistory": avg_wait_history,
            "staffLoadHistory": staff_load_history,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.get("/wait_heatmap")
def wait_heatmap():
    start_date = parse_date_param("start")
    end_date = parse_date_param("end")
    try:
        conn = get_db_conn()
        cur = conn.cursor()

        # Use bucket_start from your aggregate table
        cur.execute("""
            SELECT
                EXTRACT(DOW FROM bucket_start) AS day_of_week,
                EXTRACT(HOUR FROM bucket_start) AS hour,
                AVG(avg_wait_minutes) AS avg_wait
            FROM wait_time_agg_hourly
            GROUP BY day_of_week, hour
            ORDER BY day_of_week, hour;
        """)

        rows = cur.fetchall()
        cur.close()
        conn.close()

        # If there is no data yet, return a synthetic grid so the heatmap still draws
        if not rows:
            synthetic = [
                {
                    "day_of_week": d,
                    "hour": h,
                    "avg_wait": ((d * 7 + h * 2) % 50) + 5
                }
                for d in range(7)
                for h in range(24)
            ]
            return jsonify(synthetic)

        return jsonify([
            {
                "day_of_week": int(r["day_of_week"]),
                "hour": int(r["hour"]),
                "avg_wait": float(r["avg_wait"]),
            }
            for r in rows
        ])

    except psycopg2.errors.UndefinedTable:
        # wait_time_agg_hourly does not exist yet -> return synthetic data
        synthetic = [
            {
                "day_of_week": d,
                "hour": h,
                "avg_wait": ((d * 7 + h * 2) % 50) + 5
            }
            for d in range(7)
            for h in range(24)
        ]
        return jsonify(synthetic), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

DEPT_CAPACITY = {
    1: 10,  # Emergency
    2: 8,   # Radiology
    3: 6,   # Pediatrics
}


@api_bp.get("/staff_utilization")
def staff_utilization():
    
    empty_payload = {"byDept": [], "history": []}
    start_date = parse_date_param("start")
    end_date = parse_date_param("end")

    try:
        try:
            conn = get_db_conn()
            cur = conn.cursor()
            cur.execute("""
                SELECT bucket_start, dept_id, COALESCE(in_service, 0) AS in_service
                FROM wait_time_agg_hourly
                ORDER BY bucket_start DESC
                LIMIT 24;
            """)
            rows = cur.fetchall()
            cur.close()
            conn.close()
        except Exception:
            rows = []

        if not rows:
            return jsonify(empty_payload), 200

        latest_by_dept = {}
        for r in rows:
            did = r["dept_id"]
            if did not in latest_by_dept or r["bucket_start"] > latest_by_dept[did]["bucket_start"]:
                latest_by_dept[did] = r

        by_dept_payload = []
        for did, latest in latest_by_dept.items():
            in_serv = latest["in_service"] or 0
            capacity = DEPT_CAPACITY.get(did, max(in_serv, 1))  
            util = float(in_serv) / capacity if capacity else 0.0

            by_dept_payload.append({
                "deptId": did,
                "deptName": f"Dept {did}",
                "activeStaff": capacity,
                "inService": int(in_serv),
                "utilization": round(util, 2),
            })

        history_payload = []
        for r in rows:
            did = r["dept_id"]
            in_serv = r["in_service"] or 0
            capacity = DEPT_CAPACITY.get(did, max(in_serv, 1))
            util = float(in_serv) / capacity if capacity else 0.0

            bucket_start = r["bucket_start"]
            if hasattr(bucket_start, "isoformat"):
                bucket_start = bucket_start.isoformat()

            history_payload.append({
                "bucketStart": bucket_start,
                "deptId": did,
                "inService": int(in_serv),
                "activeStaff": capacity,
                "utilization": round(util, 2),
            })

        return jsonify({"byDept": by_dept_payload, "history": history_payload}), 200

    except Exception:
        return jsonify(empty_payload), 200