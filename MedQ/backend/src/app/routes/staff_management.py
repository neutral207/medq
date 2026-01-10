import os
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Blueprint, request, jsonify
from src.app.errors import ApiError
from datetime import datetime, timezone

load_dotenv()

staff_mgmt_bp = Blueprint("staff_management", __name__)

DATABASE_URL = os.getenv("DATABASE_URL")

def get_conn():
    return psycopg2.connect(DATABASE_URL)

def get_socketio():
    from src.config.main import socketio
    return socketio

@staff_mgmt_bp.get("/staff")
def get_all_staff():
    """Get all staff members with their current shift status"""
    department_filter = request.args.get("department")

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
                SELECT
                    s.staff_id,
                    s.name,
                    s.role,
                    s.active,
                    d.name as department_name,
                    d.dept_id,
                    sh.shift_id,
                    sh.clock_in,
                    sh.clock_out,
                    CASE
                        WHEN sh.shift_id IS NOT NULL AND sh.clock_out IS NULL THEN true
                        ELSE false
                    END as on_duty
                FROM staff s
                JOIN departments d ON d.dept_id = s.dept_id
                LEFT JOIN staff_shifts sh ON sh.staff_id = s.staff_id
                    AND sh.clock_out IS NULL
            """

            params = []
            if department_filter and department_filter.lower() != "all":
                query += " WHERE d.name = %s"
                params.append(department_filter)

            query += " ORDER BY s.name"

            cur.execute(query, tuple(params))
            rows = cur.fetchall()

    staff_list = [
        {
            "staff_id": row["staff_id"],
            "name": row["name"],
            "role": row["role"],
            "active": row["active"],
            "department_name": row["department_name"],
            "dept_id": row["dept_id"],
            "on_duty": row["on_duty"],
            "shift_id": row["shift_id"],
            "clock_in": row["clock_in"].isoformat() if row["clock_in"] else None,
        }
        for row in rows
    ]

    return jsonify({"staff": staff_list}), 200

@staff_mgmt_bp.post("/staff/<int:staff_id>/clock-in")
def clock_in_staff(staff_id):
    """Clock in a staff member"""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Check if staff exists and get their department
            cur.execute(
                "SELECT staff_id, dept_id, name, active FROM staff WHERE staff_id = %s",
                (staff_id,)
            )
            staff = cur.fetchone()

            if not staff:
                raise ApiError(f"Staff member not found: {staff_id}", code=404)

            if not staff["active"]:
                raise ApiError(f"Staff member is inactive", code=400)

            # Check if already clocked in
            cur.execute(
                """
                SELECT shift_id FROM staff_shifts
                WHERE staff_id = %s AND clock_out IS NULL
                """,
                (staff_id,)
            )
            existing_shift = cur.fetchone()

            if existing_shift:
                raise ApiError("Staff member is already clocked in", code=400)

            # Clock in
            cur.execute(
                """
                INSERT INTO staff_shifts (staff_id, dept_id, clock_in)
                VALUES (%s, %s, %s)
                RETURNING shift_id, clock_in
                """,
                (staff_id, staff["dept_id"], datetime.now(timezone.utc))
            )
            shift = cur.fetchone()
            conn.commit()

    # Emit WebSocket event
    try:
        socketio = get_socketio()
        socketio.emit("staff_update", {
            "message": "Staff clocked in",
            "staff_id": staff_id,
            "staff_name": staff["name"]
        })
    except Exception as e:
        print(f"Failed to emit staff_update: {e}")

    return jsonify({
        "message": "Clocked in successfully",
        "shift_id": shift["shift_id"],
        "clock_in": shift["clock_in"].isoformat()
    }), 201

@staff_mgmt_bp.post("/staff/<int:staff_id>/clock-out")
def clock_out_staff(staff_id):
    """Clock out a staff member"""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get staff info
            cur.execute(
                "SELECT staff_id, name FROM staff WHERE staff_id = %s",
                (staff_id,)
            )
            staff = cur.fetchone()

            if not staff:
                raise ApiError(f"Staff member not found: {staff_id}", code=404)

            # Find active shift
            cur.execute(
                """
                SELECT shift_id FROM staff_shifts
                WHERE staff_id = %s AND clock_out IS NULL
                """,
                (staff_id,)
            )
            shift = cur.fetchone()

            if not shift:
                raise ApiError("Staff member is not currently clocked in", code=400)

            # Clock out
            now = datetime.now(timezone.utc)
            cur.execute(
                """
                UPDATE staff_shifts
                SET clock_out = %s
                WHERE shift_id = %s
                RETURNING shift_id, clock_in, clock_out
                """,
                (now, shift["shift_id"])
            )
            updated_shift = cur.fetchone()
            conn.commit()

    # Emit WebSocket event
    try:
        socketio = get_socketio()
        socketio.emit("staff_update", {
            "message": "Staff clocked out",
            "staff_id": staff_id,
            "staff_name": staff["name"]
        })
    except Exception as e:
        print(f"Failed to emit staff_update: {e}")

    return jsonify({
        "message": "Clocked out successfully",
        "shift_id": updated_shift["shift_id"],
        "clock_in": updated_shift["clock_in"].isoformat(),
        "clock_out": updated_shift["clock_out"].isoformat()
    }), 200

@staff_mgmt_bp.get("/staff/on-duty")
def get_on_duty_staff():
    """Get count of staff currently on duty by department"""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT
                    d.name as department_name,
                    d.dept_id,
                    COUNT(sh.shift_id) as staff_count
                FROM departments d
                LEFT JOIN staff_shifts sh ON sh.dept_id = d.dept_id
                    AND sh.clock_out IS NULL
                GROUP BY d.dept_id, d.name
                ORDER BY d.name
            """)
            rows = cur.fetchall()

    departments = [
        {
            "department_name": row["department_name"],
            "dept_id": row["dept_id"],
            "staff_count": int(row["staff_count"])
        }
        for row in rows
    ]

    return jsonify({"departments": departments}), 200

@staff_mgmt_bp.get("/staff/available")
def get_available_staff():
    """Get staff who are on duty and not currently assigned to another patient"""
    department_filter = request.args.get("department")

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
                SELECT
                    s.staff_id,
                    s.name,
                    s.role,
                    s.active,
                    d.name as department_name,
                    d.dept_id,
                    sh.shift_id,
                    sh.clock_in,
                    sh.clock_out,
                    CASE
                        WHEN sh.shift_id IS NOT NULL AND sh.clock_out IS NULL THEN true
                        ELSE false
                    END as on_duty,
                    CASE
                        WHEN EXISTS(
                            SELECT 1 FROM visits v
                            WHERE v.assigned_staff = s.staff_id
                              AND v.status = 'in-progress'
                        ) THEN true
                        ELSE false
                    END as currently_assigned
                FROM staff s
                JOIN departments d ON d.dept_id = s.dept_id
                LEFT JOIN staff_shifts sh ON sh.staff_id = s.staff_id
                    AND sh.clock_out IS NULL
                WHERE (s.role = 'nurse' OR s.role = 'physician' OR s.role = 'doctor')
                  AND sh.shift_id IS NOT NULL
                  AND sh.clock_out IS NULL
                  AND NOT EXISTS(
                      SELECT 1 FROM visits v
                      WHERE v.assigned_staff = s.staff_id
                        AND v.status = 'in-progress'
                  )
            """

            params = []
            if department_filter and department_filter.lower() != "all":
                query += " AND d.name = %s"
                params.append(department_filter)

            query += " ORDER BY s.name"

            cur.execute(query, tuple(params))
            rows = cur.fetchall()

    staff_list = [
        {
            "staff_id": row["staff_id"],
            "name": row["name"],
            "role": row["role"],
            "active": row["active"],
            "department_name": row["department_name"],
            "dept_id": row["dept_id"],
            "on_duty": row["on_duty"],
            "shift_id": row["shift_id"],
            "clock_in": row["clock_in"].isoformat() if row["clock_in"] else None,
            "currently_assigned": row["currently_assigned"],
        }
        for row in rows
    ]

    return jsonify({"staff": staff_list}), 200
