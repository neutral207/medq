import os
from flask_socketio import emit
from flask import request
import psycopg2
from psycopg2.extras import RealDictCursor
import os



DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/medq",
)

def get_conn():
    return psycopg2.connect(DATABASE_URL)

def register_socketio_events(socketio):
    
    @socketio.on('connect')
    def handle_connect():
        print(f'Client Connected: {request.sid}')
        #SEND INITIAL QUEUE STATE
        emit('connected', {'status': 'connected'})

    @socketio.on('disconnect')
    def handle_disconnect():
        print(f'Client Disconnected: {request.sid}')

    @socketio.on('subscribe_department')
    def handle_subscribe(data):
        #Subscribe for updates to a specific department
        department =  data.get('department', 'Emergency')

        #Get Current queue for this department
        with get_conn as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT v.visit_id,
                    p.anon_token,
                    p.severity,
                    p.full_name,
                    p.symptoms,
                    v.checkin_time,
                    v.predicted_wait_minutes
                    FROM visits v
                    JOIN patients p ON p.patient_id = v.patient_id
                    JOIN departments d ON d.dept_id = v.dept_id
                    WHERE d.name = %s
                        AND status = 'queued'
                    ORDER BY v.checkin_time ASC;
                    """,
                    (department,),
                )
                rows = cur.fetchall()
        
        queue = [
            {
                "visit_id": str(row["visit_id"]),
                "anon_token": row["anon_token"],
                "severity": row["severity"],
                "name": row["full_name"],
                "symptoms": row["symptoms"],
                "checkin_time": row["checkin_time"].isoformat() if row["checkin_time"] else None,
                "predicted_wait_minutes": row["predicted_wait_minutes"],
            }
            for row  in rows
        ]

        emit('queue_snapshot', {
            'department': department,
            'queue': queue,
            'total_patients': len(queue)
        })

    @socketio.on('update_visit_status')
    def handle_update_status(data):
        visit_id = data.get('visit_id')
        new_status = data.get('status', 'in_service')

        with get_conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                #GET DEPARTMENT FOR BROADCAST
                cur.execute(
                    """
                    SELECT d.name as department_name
                    FROM visits v
                    JOIN departments d ON d.dept_id = v.dept_id
                    WHERE v.visit_id = %s;
                    """,
                    (visit_id,),
                )
                dept_row = cur.fetchone()

                if not dept_row:
                    emit('error', {'message': 'Visit not found'})
                    return
                
                if new_status == 'in_service':
                    cur.execute(
                        """
                        UPDATE visits
                        SET status = %s, service_start = NOW()
                        WHERE visit_id = %s;
                        """
                        (new_status, visit_id),
                    )
                else:
                    cur.execute(
                        """
                        UPDATE visits
                        SET status = %s
                        WHERE visit_id = %s;
                        """
                        (new_status, visit_id),
                    )
                conn.commit()
        
        #BROADCAST TO ALL CLIENTS
        socketio.emit('queue_update', {
            'department': dept_row['department_name'],
            'action': 'status_changed',
            'visit_id': str(visit_id),
            'new_status': new_status
        }, broadcast=True)