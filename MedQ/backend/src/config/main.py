# MedQ Backend Entry Point
# Flask app with Socket.IO ready structure

from collections import deque
from typing import Deque, Dict
from flask_jwt_extended import JWTManager
from flask import Flask, jsonify
from flask_cors import CORS

from src.app.errors import register_error_handlers
from src.app.routes.api import api_bp

from collections import deque
from typing import Deque, Dict
import os

registration_queue: Deque[Dict] = deque()


def create_app():
    app = Flask(__name__)
    CORS(app)
<<<<<<< HEAD
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", os.urandom(32))
=======
    app.config['SECRET_KEY'] = 'replace-me'
    app.config['JWT_SECRET_KEY'] = 'super_secret_key_change_me'
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 3600 #this is a 1 hour token lifeltime

    #this is intialize JWT
    jwt = JWTManager(app)
>>>>>>> f51bff0997f525a91c9b51e9b6b3bda64a708721

    register_error_handlers(app)
    app.register_blueprint(api_bp, url_prefix="/api")

    @app.get("/health")
    def health():
        return jsonify(status="ok")
    
    return app

    # THE FIX
    return app   # <-- You forgot this!


# Dev entrypoint
if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)