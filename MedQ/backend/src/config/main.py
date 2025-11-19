# MedQ Backend Entry Point
# Flask app with Socket.IO ready structure

from flask import Flask, jsonify, request
from flask_cors import CORS
from collections import deque
import uuid
from typing import Deque, List, Dict
from datetime import datetime


try:
    from flask_socketio import SocketIO
except Exception:
    SocketIO = None


visits_db:  Dict[str, Dict] = {}   #PLACEHOLDER DATABASE


registration_queue: Deque[Dict] = deque()

STATUSES = ['Checked-In', 'Waiting', 'In Progress', 'Completed', 'Cancelled']

def create_app():
    app = Flask(__name__)
    CORS(app)
    app.config['SECRET_KEY'] = 'replace-me'

#SOCKETIO INITIALIZATION
    socketio_instance = None
    if SocketIO:
        socketio_instance = SocketIO(app, cors_allowed_origins='*')

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

        if not data:
            return jsonify(error="No data provided."), 400

        user_id = str(uuid.uuid4())
        user_data = {
            "user_id" : user_id,
            "name" : data.get("name"),
            "phone" : data.get("phone"),
            "dob" : data.get("dob"),
            "status" : "Checked-In", 
            "checked_in_at" : datetime.now(datetime.timezone.utc).isoformat(),
            "updated_at" : None
            }

        registration_queue.append(user_data)
        visits_db[user_id] = user_data
        queue_pos = len(registration_queue)

        if socketio_instance:
            socketio_instance.emit('queue_updated',{
                'action': 'check-in',
                'user' : user_data,
                'queue_length' : queue_pos
            }, broadcast=True)

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

        if next_user['user_id'] in visits_db:
            visits_db[next_user['user_id']]['status'] = 'In Progress'
            visits_db[next_user['user_id']]['updated_at'] =  datetime.now(datetime.timezone.utc).isoformat()
        
        if socketio_instance:
            socketio_instance.emit('queue_updated',{
                'action': 'process_next',
                'user' : next_user,
                'queue_length' : len(registration_queue)
            }, broadcast=True)

        return jsonify(message=f"User {next_user['name']} has been processed.", 
                   processed_user= next_user), 200
    @app.route('/api/visits/<user_id>', methods=['PATCH'])
    def update_visit_status(user_id):
        """
        Update visit status and broadcast changes via SocketIO
        
        Expected JSON Body:
        {
            "status" : "Completed"
        }
        """

        if user_id not in visits_db:
            return jsonify(error='Visit not found'), 404
        
        data = request.get_json()
        if not data:
            return jsonify(error='No data'), 400
        
        new_status = data.get('status')
        if not new_status:
            return jsonify(error='Status is required'), 400
        
        if new_status not in STATUSES:
            return jsonify(error=f'Invalid Status. Must be one of the following: {", ".join(STATUSES)}'), 400
        
        old_status = visits_db[user_id]['status']
        visits_db[user_id]['status'] = new_status
        visits_db[user_id]['updated_at'] =  datetime.now(datetime.timezone.utc).isoformat()

        updated_visit = visits_db[user_id]

        if socketio_instance:
            socketio_instance.emit('visit_updated',{
                'user_id' : user_id,
                'old_status' : old_status,
                'new_status' : new_status,
                'visit' : updated_visit,
                'timestamp' : updated_visit['updated_at']
            }, broadcast=True)

        return jsonify(
            success=True,
            message=f'Visit status updated from {old_status} to {new_status}',
            visit = updated_visit
        ), 200
    
    @app.route('/api/visits/<user_id>', methods=['GET'])
    def get_visit(user_id):
        """Get a single visit by User ID"""
        if user_id not in visits_db:
            return jsonify(error='Visit not found'), 404
        return jsonify(visits_db[user_id]), 200
    
    @app.route('/api/visits', methods=['GET'])
    def get_all_visits():
        """Get all visits"""
        return jsonify(list(visits_db.values())), 200
        
    app.socketio = socketio_instance
    return app 
app = create_app()

if __name__ == '__main__':
    # Dev server
    if SocketIO:
        socketio = SocketIO(app, cors_allowed_origins='*')
        socketio.run(app, host='0.0.0.0', port=5000, debug=True)
    else:
        app.run(host='0.0.0.0', port=5000, debug=True)
