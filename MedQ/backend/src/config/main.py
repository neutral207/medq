from collections import deque
import uuid
from typing import Deque, Dict
from datetime import datetime, timezone
import os

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from flask_jwt_extended import JWTManager

from src.app.errors import register_error_handlers
from src.app.routes.api import api_bp
from src.app.routes.staff_management import staff_mgmt_bp
from src.app.routes.auth import auth_bp

# Global Socket.IO instance
# CORS origins can be restricted via CORS_ORIGINS environment variable
cors_origins = os.environ.get("CORS_ORIGINS", "*")
socketio = SocketIO(cors_allowed_origins=cors_origins)

# In-memory placeholder database
visits_db: Dict[str, Dict] = {}
registration_queue: Deque[Dict] = deque()

STATUSES = ["Checked-In", "Waiting", "In Progress", "Completed", "Cancelled"]


def create_app():
    app = Flask(__name__)
    
    # Configure CORS with environment variable support
    cors_origins = os.environ.get("CORS_ORIGINS", "*")
    if cors_origins == "*":
        CORS(app)
    else:
        # Parse comma-separated origins
        allowed_origins = [origin.strip() for origin in cors_origins.split(",")]
        CORS(app, origins=allowed_origins)
    
    # SECRET_KEY must be set in production for session security
    secret_key = os.environ.get("SECRET_KEY")
    if not secret_key:
        # Generate a random key for development only
        import sys
        if "pytest" not in sys.modules:  # Allow tests to run without SECRET_KEY
            print("WARNING: SECRET_KEY not set. Using random key (will invalidate tokens on restart)")
        secret_key = os.urandom(32)
    app.config["SECRET_KEY"] = secret_key

    # JWT (you can hook into this later)
    jwt = JWTManager(app)

    # Register error handlers and API blueprints
    register_error_handlers(app)
    app.register_blueprint(api_bp, url_prefix="/api")
    app.register_blueprint(staff_mgmt_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")

    @app.route("/health", methods=["GET"])
    def health():
        return jsonify(status="ok")

    # -----------------------------
    # CHECK-IN
    # -----------------------------
    @app.route("/api/checkin", methods=["POST"])
    def check_in_user():
        data = request.get_json()

        if not data:
            return jsonify(error="No data provided."), 400

        user_id = str(uuid.uuid4())
        user_data = {
            "user_id": user_id,
            "name": data.get("name"),
            "phone": data.get("phone"),
            "dob": data.get("dob"),
            "status": "Checked-In",
            "checked_in_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": None,
        }

        registration_queue.append(user_data)
        visits_db[user_id] = user_data
        queue_pos = len(registration_queue)

        # Broadcast queue update over Socket.IO
        socketio.emit(
            "queue_updated",
            {
                "action": "check-in",
                "user": user_data,
                "queue_length": queue_pos,
            },
            broadcast=True,
        )

        return (
            jsonify(
                user_id=user_id,
                queue_position=queue_pos,
                message="Patient Checked in Successfully.",
            ),
            201,
        )

    # -----------------------------
    # QUEUE STATUS
    # -----------------------------
    @app.route("/api/queue/status", methods=["GET"])
    def get_qstatus():
        return jsonify(list(registration_queue)), 200

    # -----------------------------
    # PROCESS NEXT IN QUEUE
    # -----------------------------
    @app.route("/api/queue/process_next", methods=["POST"])
    def process_next_in_q():
        if not registration_queue:
            return jsonify(error="Queue is Empty."), 404

        next_user = registration_queue.popleft()

        if next_user["user_id"] in visits_db:
            visits_db[next_user["user_id"]]["status"] = "In Progress"
            visits_db[next_user["user_id"]]["updated_at"] = datetime.now(
                timezone.utc
            ).isoformat()

        socketio.emit(
            "queue_updated",
            {
                "action": "process_next",
                "user": next_user,
                "queue_length": len(registration_queue),
            },
            broadcast=True,
        )

        return (
            jsonify(
                message=f"User {next_user['name']} has been processed.",
                processed_user=next_user,
            ),
            200,
        )

    # -----------------------------
    # UPDATE VISIT STATUS
    # -----------------------------
    @app.route("/api/visits/<user_id>", methods=["PATCH"])
    def update_visit_status(user_id):
        """
        Update visit status and broadcast changes via Socket.IO

        Expected JSON body:
        {
            "status": "Completed"
        }
        """
        if user_id not in visits_db:
            return jsonify(error="Visit not found"), 404

        data = request.get_json()
        if not data:
            return jsonify(error="No data"), 400

        new_status = data.get("status")
        if not new_status:
            return jsonify(error="Status is required"), 400

        if new_status not in STATUSES:
            return (
                jsonify(
                    error=(
                        f'Invalid Status. Must be one of the following: '
                        f'{", ".join(STATUSES)}'
                    )
                ),
                400,
            )

        old_status = visits_db[user_id]["status"]
        visits_db[user_id]["status"] = new_status
        visits_db[user_id]["updated_at"] = datetime.now(timezone.utc).isoformat()

        updated_visit = visits_db[user_id]

        socketio.emit(
            "visit_updated",
            {
                "user_id": user_id,
                "old_status": old_status,
                "new_status": new_status,
                "visit": updated_visit,
                "timestamp": updated_visit["updated_at"],
            },
            broadcast=True,
        )

        return (
            jsonify(
                success=True,
                message=f"Visit status updated from {old_status} to {new_status}",
                visit=updated_visit,
            ),
            200,
        )

    # -----------------------------
    # VISIT LOOKUPS
    # -----------------------------
    @app.route("/api/visits/<user_id>", methods=["GET"])
    def get_visit(user_id):
        """Get a single visit by User ID"""
        if user_id not in visits_db:
            return jsonify(error="Visit not found"), 404
        return jsonify(visits_db[user_id]), 200

    @app.route("/api/visits", methods=["GET"])
    def get_all_visits():
        """Get all visits"""
        return jsonify(list(visits_db.values())), 200

    # -----------------------------
    # SOCKET.IO EVENTS
    # -----------------------------
    @socketio.on("connect")
    def handle_connect():
        """Handle Client Connection"""
        print("Client Connected")
        emit("connection_response", {"message": "Connected to visit updates"})

    @socketio.on("disconnect")
    def handle_disconnect():
        """Handle Client Disconnection"""
        print("Client Disconnected")

    @socketio.on("request_visit_update")
    def handle_visit_request(data):
        """Handle request for specific visit updates"""
        user_id = data.get("user_id")
        if user_id and user_id in visits_db:
            emit("visit_data", visits_db[user_id])
        else:
            emit("error", {"message": "Visit not found"})

    return app


# Create app and bind Socket.IO
app = create_app()
socketio.init_app(app, cors_allowed_origins=cors_origins)

# Dev entrypoint
if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
