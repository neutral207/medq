# MedQ Backend Entry Point
# Flask app with Socket.IO ready structure

from flask import Flask, jsonify, request
from flask_cors import CORS
from collections import deque
import uuid
from typing import Deque, List, Dict


try:
    from flask_socketio import SocketIO
except Exception:
    SocketIO = None


registration_queue: Deque[Dict] = deque()


def create_app():
    app = Flask(__name__)
    CORS(app)
    app.config['SECRET_KEY'] = 'replace-me'

    # Register blueprints
    try:
        from app.routes.api import api_bp
        app.register_blueprint(api_bp, url_prefix='/api')
    except ImportError:
        pass

    @app.route('/health', methods=['GET'])
    def health():
        return jsonify(status='ok')



    @app.route('/api/checkin', methods=['POST'])
    def check_in_user():
        data = request.get_json()


        user_id = str(uuid.uuid4())
        user_data = {
            "user_id" : user_id,
            "name" : request.name,
            "phone" : request.phone,
            "dob" : request.dob,
            }

        registration_queue.append(user_data)
        queue_pos = len(registration_queue)


        return jsonify(
            user_id= user_id,
            queue_position= queue_pos,
            message = "Patient Checked in Successfully."
        ),  201

    @app.route('/api/queue/status', methods=['GET'])
    def get_qstatus():
        return jsonify(list(registration_queue)), 200

    @app.route('/api/queue/process_next', methods=['POST'])
    def process_next_in_q():
        if not registration_queue:
            return jsonify(error="Queue is Empty."), 404 
    

        next_user = registration_queue.popleft()

        return jsonify(message=f"User {next_user['name']} has been processed.", 
                   processed_user= next_user), 200
    return app 
app = create_app()

if __name__ == '__main__':
    # Dev server
    if SocketIO:
        socketio = SocketIO(app, cors_allowed_origins='*')
        socketio.run(app, host='0.0.0.0', port=5000, debug=True)
    else:
        app.run(host='0.0.0.0', port=5000, debug=True)
