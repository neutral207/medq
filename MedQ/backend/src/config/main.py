# MedQ Backend Entry Point
# Flask app with Socket.IO ready structure

from flask import Flask, jsonify
from flask_cors import CORS
try:
    from flask_socketio import SocketIO
except Exception:
    SocketIO = None

def create_app():
    app = Flask(__name__)
    CORS(app)
    app.config['SECRET_KEY'] = 'replace-me'
    app.config['JWT_SECRET_KEY'] = 'super_secret_key_change_me'
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 3600 #this is a 1 hour token lifeltime

    #this is intialize JWT
    jwt = JWTManager(app)

    # Register blueprints
    from app.routes.api import api_bp
    app.register_blueprint(api_bp, url_prefix='/api')

    @app.get('/health')
    def health():
        return jsonify(status='ok')

    return app

app = create_app()

if __name__ == '__main__':
    # Dev server
    if SocketIO:
        socketio = SocketIO(app, cors_allowed_origins='*')
        socketio.run(app, host='0.0.0.0', port=5000, debug=True)
    else:
        app.run(host='0.0.0.0', port=5000, debug=True)
