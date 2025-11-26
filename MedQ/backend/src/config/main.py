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
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", os.urandom(32))

    register_error_handlers(app)
    app.register_blueprint(api_bp, url_prefix="/api")

    @app.get("/health")
    def health():
        return jsonify(status="ok")

    # THE FIX
    return app   # <-- You forgot this!


# Dev entrypoint
if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)