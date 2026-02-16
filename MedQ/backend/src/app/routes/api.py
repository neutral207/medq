import os
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required
import bcrypt
from src.app.errors import ApiError
from src.app.routes.auth import token_required, role_required
import joblib
import pandas as pd
from datetime import datetime, timezone

load_dotenv()

api_bp = Blueprint("api", __name__)

# Import socketio for real-time updates
def get_socketio():
    from src.config.main import socketio
    return socketio

DATABASE_URL = os.getenv("DATABASE_URL",
)

from datetime import datetime

def parse_dob_mmddyyyy(value):
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        return datetime.strptime(s, "%m/%d/%Y").date()
    except ValueError:
        raise ApiError("dob must be in MM/DD/YYYY format", code=400)

def get_conn():
    return psycopg2.connect(DATABASE_URL)
USER = {
    "username": "admin",
    "password_hash": bcrypt.hashpw(b"admin123", bcrypt.gensalt())
}

@api_bp.get("/queue")
@token_required
def get_queue():
    """
    Get current queue (Requires: Any authenticated staff)
    Access: All staff roles (nurse, doctor, physician, admin)
    """
    department_name = request.args.get("department", "Emergency")

    # Optional: allow date filters
    start_date = parse_date_param("start")
    end_date = parse_date_param("end")

    # Default: today only if no filters were provided
    if not start_date and not end_date:
        start_date = datetime.now(timezone.utc).date()
        end_date = start_date

    where_date = ""
    where_dept = ""
    params = []

    # Handle "all" departments case
    if department_name and department_name.lower() != "all":
        where_dept = "WHERE d.name = %s"
        params.append(department_name)
    else:
        where_dept = "WHERE 1=1"
        department_name = "all"

    if start_date:
        where_date += " AND v.checkin_time::date >= %s"
        params.append(start_date)
    if end_date:
        where_date += " AND v.checkin_time::date <= %s"
        params.append(end_date)

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                f"""
                SELECT v.visit_id,
                    v.status,
                    p.anon_token,
                    p.severity,
                    p.full_name,
                    p.dob,
                    p.phone,
                    p.symptoms,
                    v.checkin_time,
                    v.predicted_wait_minutes,
                    d.name as department
                FROM visits v
                JOIN patients p ON p.patient_id = v.patient_id
                JOIN departments d ON d.dept_id = v.dept_id
                {where_dept}
                    AND v.status <> 'left'
                    {where_date}
                ORDER BY v.checkin_time ASC;
                """,
                tuple(params),
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
            "department": row["department"],
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
    symptoms = (data.get("symptoms") or "").strip()
    severity = int(data.get("severity") or 3)
    source = data.get("source") or "kiosk"
    full_name = (data.get("name") or "").strip()
    dob = data.get("dob")
    phone = (data.get("phone") or "").strip()

    if not symptoms:
        raise ApiError("symptoms is required", code=400)
    if not full_name:
        raise ApiError("name is required", code=400)

    def get_staff_in_service(conn, dept_id):
        # fallback if you do not have hourly agg populated yet
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT COALESCE(in_service, 0) AS in_service
                    FROM wait_time_agg_hourly
                    WHERE dept_id = %s
                    ORDER BY bucket_start DESC
                    LIMIT 1
                    """,
                    (dept_id,),
                )
                row = cur.fetchone()
                if row:
                    return int(row["in_service"] or 0)
        except Exception:
            pass
        return 3  # default fallback

    def get_queue_length_today(conn, dept_id):
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT COUNT(*)
                    FROM visits
                    WHERE dept_id = %s
                      AND status <> 'left'
                      AND checkin_time::date = (now() at time zone 'utc')::date
                    """,
                    (dept_id,),
                )
                return int(cur.fetchone()[0])
        except Exception:
            # if visits table is missing or query fails, just treat as empty
            return 0

    # --------------------------
    # DB work
    # --------------------------
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # 1) Resolve department id
            cur.execute(
                "SELECT dept_id FROM departments WHERE name = %s",
                (department_name,),
            )
            dept_row = cur.fetchone()
            if not dept_row:
                raise ApiError(f"Unknown department: {department_name}", code=400)
            dept_id = dept_row["dept_id"]

            # 2) Insert patient
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

            # 3) Compute queue position and ML features
            existing_len = get_queue_length_today(conn, dept_id)
            queue_position = existing_len + 1

            hour_of_day = datetime.now(timezone.utc).hour
            staff_in_service = get_staff_in_service(conn, dept_id)

            predicted_wait_minutes = 30  # fallback if model missing
            if model is not None:
                # IMPORTANT: keep feature names and order consistent with training
                df = pd.DataFrame([{
                    "severity": int(severity),
                    "hour_of_day": int(hour_of_day),
                    "queue_length": int(queue_position),
                    "staff_in_service": int(staff_in_service),
                }])
                try:
                    pred = model.predict(df)[0]
                    predicted_wait_minutes = int(round(float(pred)))
                except Exception:
                    predicted_wait_minutes = 30

            # 4) Insert visit with predicted wait
            cur.execute(
                """
                INSERT INTO visits (
                    patient_id, dept_id, status, predicted_wait_minutes
                )
                VALUES (%s, %s, 'waiting', %s)
                RETURNING visit_id, checkin_time, predicted_wait_minutes, status;
                """,
                (patient_row["patient_id"], dept_id, predicted_wait_minutes),
            )
            visit_row = cur.fetchone()
            if visit_row is None:
                raise ApiError("Failed to create visit record", code=500)

    # --------------------------
    # Response payload
    # --------------------------
    visit = {
        "visit_id": str(visit_row["visit_id"]),
        "anon_token": patient_row["anon_token"],
        "severity": severity,
        "symptoms": symptoms,
        "checkin_time": visit_row["checkin_time"].isoformat() if visit_row["checkin_time"] else None,
        "predicted_wait_minutes": visit_row["predicted_wait_minutes"],
        "status": visit_row["status"],
        "department": department_name,
        "name": full_name,
        "dob": dob,
        "phone": phone,
        "queue_position": queue_position,
        "features_used": {
            "hour_of_day": hour_of_day,
            "staff_in_service": staff_in_service,
            "queue_length": queue_position,
        },
    }

    # Emit WebSocket event for queue update
    try:
        socketio = get_socketio()
        socketio.emit("queue_update", {"message": "New patient checked in", "department": department_name})
    except Exception as e:
        print(f"Failed to emit queue_update: {e}")

    return jsonify({"message": "checked in", "visit": visit}), 201
  
@api_bp.get("/visit/<visit_id>")
@token_required
def get_visit(visit_id):
    """
    Get visit details (Requires: Any authenticated staff)
    Access: All staff roles (nurse, doctor, physician, admin)
    """
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
                    d.name AS department_name,
                    s.name AS assigned_staff_name,
                    s.role AS assigned_staff_role,
                    (
                        SELECT COUNT(*)
                        FROM visits v2
                        WHERE v2.dept_id = v.dept_id
                          AND v2.status = 'waiting'
                          AND v2.checkin_time IS NOT NULL
                          AND v.checkin_time IS NOT NULL
                          AND (v2.checkin_time AT TIME ZONE 'utc')::date = (now() AT TIME ZONE 'utc')::date
                          AND v2.checkin_time <= v.checkin_time
                    ) AS queue_position
                FROM visits v
                JOIN patients p ON p.patient_id = v.patient_id
                JOIN departments d ON d.dept_id = v.dept_id
                LEFT JOIN staff s ON s.staff_id = v.assigned_staff
                WHERE v.visit_id = %s
                LIMIT 1;
                """,
                (visit_id,),
            )
            row = cur.fetchone()

    if not row:
        raise ApiError(f"Visit not found: {visit_id}", code=404)

    visit = {
        "visit_id": str(row["visit_id"]),
        "status": row["status"],
        "checkin_time": row["checkin_time"].isoformat() if row["checkin_time"] else None,
        "service_start": row["service_start"].isoformat() if row["service_start"] else None,
        "service_end": row["service_end"].isoformat() if row["service_end"] else None,
        "predicted_wait_minutes": row["predicted_wait_minutes"],
        "actual_wait_minutes": row["actual_wait_minutes"],
        "queue_position": int(row["queue_position"]) if row["queue_position"] is not None else None,
        "anon_token": row["anon_token"],
        "name": row["full_name"],
        "dob": row["dob"].isoformat() if row["dob"] else None,
        "phone": row["phone"],
        "symptoms": row["symptoms"],
        "severity": row["severity"],
        "department": row["department_name"],
        "assigned_staff_name": row["assigned_staff_name"],
        "assigned_staff_role": row["assigned_staff_role"],
    }

    return jsonify({"visit": visit}), 200


@api_bp.get("/visit/<visit_id>/public")
def get_visit_public(visit_id):
    """
    Public endpoint for patients to check their queue status.
    No authentication required, but requires anon_token query parameter for verification.
    Returns limited information (no PII like full name, DOB, phone).

    GET /api/visit/<visit_id>/public?token=<anon_token>
    """
    anon_token = request.args.get("token", "").strip()

    if not anon_token:
        raise ApiError("Token parameter is required", code=400)

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    v.visit_id,
                    v.checkin_time,
                    v.status,
                    v.predicted_wait_minutes,
                    p.anon_token,
                    p.severity,
                    d.name AS department_name,
                    (
                        SELECT COUNT(*)
                        FROM visits v2
                        WHERE v2.dept_id = v.dept_id
                          AND v2.status = 'waiting'
                          AND v2.checkin_time IS NOT NULL
                          AND v.checkin_time IS NOT NULL
                          AND (v2.checkin_time AT TIME ZONE 'utc')::date = (now() AT TIME ZONE 'utc')::date
                          AND v2.checkin_time <= v.checkin_time
                    ) AS queue_position
                FROM visits v
                JOIN patients p ON p.patient_id = v.patient_id
                JOIN departments d ON d.dept_id = v.dept_id
                WHERE v.visit_id = %s AND p.anon_token = %s
                LIMIT 1;
                """,
                (visit_id, anon_token),
            )
            row = cur.fetchone()

    if not row:
        raise ApiError("Visit not found or invalid token", code=404)

    visit = {
        "visit_id": str(row["visit_id"]),
        "status": row["status"],
        "checkin_time": row["checkin_time"].isoformat() if row["checkin_time"] else None,
        "predicted_wait_minutes": row["predicted_wait_minutes"],
        "queue_position": int(row["queue_position"]) if row["queue_position"] is not None else None,
        "severity": row["severity"],
        "department": row["department_name"],
    }

    return jsonify({"visit": visit}), 200


@api_bp.patch("/visit/<visit_id>/status")
@token_required
@role_required('nurse', 'doctor', 'physician', 'admin')
def update_visit_status(visit_id):
    """
    Update visit status (Requires: Clinical staff or admin)
    Access: nurse, doctor, physician, admin
    """
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

            # If we go back to waiting, clear timers and assigned staff
            if new_status == "waiting":
                updates["service_start"] = None
                updates["service_end"] = None
                updates["assigned_staff"] = None

            # When moving into in-progress, start service clock (if not already started)
            elif new_status == "in-progress" and current["service_start"] is None:
                updates["service_start"] = now

            # When moving into completed, end service and clear assigned staff
            elif new_status == "completed":
                # If service_start was never set, set it now
                if current["service_start"] is None:
                    updates["service_start"] = now
                updates["service_end"] = now
                updates["assigned_staff"] = None

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

    # Emit WebSocket event for queue update
    try:
        socketio = get_socketio()
        socketio.emit("queue_update", {"message": "Visit status updated", "visit_id": visit_id, "status": new_status})
    except Exception as e:
        print(f"Failed to emit queue_update: {e}")

    return jsonify({
        "visit_id": str(row["visit_id"]),
        "status": row["status"],
        "service_start": row["service_start"].isoformat() if row["service_start"] else None,
        "service_end": row["service_end"].isoformat() if row["service_end"] else None,
    }), 200

@api_bp.patch("/visit/<visit_id>/assign")
@token_required
@role_required('nurse', 'doctor', 'physician', 'admin')
def assign_staff_to_visit(visit_id):
    """
    Assign a staff member to a visit (Requires: Clinical staff or admin)
    Access: nurse, doctor, physician, admin
    """
    if not request.is_json:
        raise ApiError("Content-Type must be application/json", code=415)

    data = request.get_json(silent=True) or {}
    assigned_staff = data.get("assigned_staff")
    new_status = data.get("status", "in-progress")

    if not assigned_staff:
        raise ApiError("assigned_staff is required", code=400)

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verify visit exists
            cur.execute(
                "SELECT visit_id, status, service_start FROM visits WHERE visit_id = %s",
                (visit_id,)
            )
            current = cur.fetchone()
            if not current:
                raise ApiError(f"Visit not found: {visit_id}", code=404)

            # Verify staff exists and is on duty
            cur.execute(
                """
                SELECT s.staff_id, s.name, s.role, s.dept_id,
                       EXISTS(
                           SELECT 1 FROM staff_shifts sh
                           WHERE sh.staff_id = s.staff_id AND sh.clock_out IS NULL
                       ) as is_on_duty
                FROM staff s
                WHERE s.staff_id = %s
                """,
                (assigned_staff,)
            )
            staff = cur.fetchone()
            if not staff:
                raise ApiError(f"Staff member not found: {assigned_staff}", code=404)

            if not staff["is_on_duty"]:
                raise ApiError(f"Staff member {staff['name']} is not currently clocked in", code=400)

            # Check if staff is already assigned to another active patient
            cur.execute(
                """
                SELECT v.visit_id, p.full_name
                FROM visits v
                JOIN patients p ON p.patient_id = v.patient_id
                WHERE v.assigned_staff = %s
                  AND v.status = 'in-progress'
                  AND v.visit_id != %s
                LIMIT 1
                """,
                (assigned_staff, visit_id)
            )
            existing_assignment = cur.fetchone()
            if existing_assignment:
                raise ApiError(
                    f"Staff member {staff['name']} is already assigned to another patient ({existing_assignment['full_name']})",
                    code=400
                )

            now = datetime.now(timezone.utc)

            # Update visit with assigned staff and status
            updates = {
                "assigned_staff": assigned_staff,
                "status": new_status
            }

            # If moving to in-progress, start service clock
            if new_status == "in-progress" and current["service_start"] is None:
                updates["service_start"] = now

            set_clause = ", ".join([f"{k} = %s" for k in updates.keys()])
            values = list(updates.values()) + [visit_id]

            cur.execute(
                f"""
                UPDATE visits
                SET {set_clause}
                WHERE visit_id = %s
                RETURNING visit_id, status, assigned_staff, service_start, service_end
                """,
                tuple(values)
            )
            updated = cur.fetchone()
            conn.commit()

    # Emit WebSocket event
    try:
        socketio = get_socketio()
        socketio.emit("visit_updated", {
            "visit_id": visit_id,
            "assigned_staff": assigned_staff,
            "staff_name": staff["name"],
            "status": new_status
        })
    except Exception as e:
        print(f"Failed to emit visit_updated: {e}")

    return jsonify({
        "success": True,
        "message": f"Assigned {staff['name']} to visit",
        "visit_id": str(updated["visit_id"]),
        "status": updated["status"],
        "assigned_staff": updated["assigned_staff"]
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
@token_required
@role_required('admin', 'doctor', 'physician')
def summary():
    """
    Get summary statistics (Requires: Admin or clinical staff)
    Access: admin, doctor, physician
    """
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
@token_required
@role_required('admin', 'doctor', 'physician')
def wait_heatmap():
    """
    Get wait time heatmap data (Requires: Admin or clinical staff)
    Access: admin, doctor, physician
    """
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
@token_required
@role_required('admin', 'doctor', 'physician')
def staff_utilization():
    """
    Get staff utilization metrics (Requires: Admin or clinical staff)
    Access: admin, doctor, physician
    """
    
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
    payload = request.get_json(force=True, silent=True) or {}
    return jsonify(message="checked in", data=payload), 201

api_bp.post("/login")
def login():
    """
    POST /api/login
    Body: { "username": "", "password": "" }
    """
    data = request.get_json() or {}
    username = data.get("username")
    password = data.get("password")

    # this is missing fields
    if not username or not password:
        return jsonify(error="missing username or password"), 400

    # User not found
    if username != USER["username"]:
        return jsonify(error="invalid username or password"), 401

    # this check password using bcrypt
    if not bcrypt.checkpw(password.encode("utf-8"), USER["password_hash"]):
        return jsonify(error="invalid username or password"), 401

    # this create JWT
    token = create_access_token(identity=username)

    return jsonify(
        message="login successful",
        token=token
    ), 200

    #this is protected example
    @api_bp.get("/protected")
    @jwt_required()
    def protected():
     return jsonify(message="You have access to this protected route")
