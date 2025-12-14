# MedQ Backend Entry Point
# Flask app with Socket.IO ready structure

from flask_jwt_extended import JWTManager
from flask import Flask
from src.app.routes.socketio_events import register_socketio_events
from flask_cors import CORS
from flask_socketio import SocketIO
from src.app.errors import register_error_handlers
from src.app.routes.api import api_bp
from src.ml.train_wait_time_model import WaitTimePrediction

def create_app():
    app = Flask(__name__)
    CORS(app)
    app.config['SECRET_KEY'] = 'replace-me'
    app.config['JWT_SECRET_KEY'] = 'super_secret_key_change_me'
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 3600 #this is a 1 hour token lifeltime
    predictor = WaitTimePrediction(csv_path='synthetic_training_data.csv')
    jwt = JWTManager(app)

    register_error_handlers(app)
    app.register_blueprint(api_bp, url_prefix="/api")
    
    return app 
app = create_app()
socketIO = SocketIO(app, cors_allowed_origins="*")
register_socketio_events(socketIO)
# Dev entrypoint
if __name__ == '__main__':
    app = create_app()
    socketIO.run(app, host="0.0.0.0", port=5000, debug=True)
