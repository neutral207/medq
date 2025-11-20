from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required
import bcrypt
from src.app.errors import ApiError

api_bp = Blueprint("api", __name__)

USER = {
    "username": "admin",
    "password_hash": bcrypt.hashpw(b"admin123", bcrypt.gensalt())
}

@api_bp.get("/queue")
def get_queue():
    return jsonify(department="ER", queue=[])

@api_bp.post("/checkin")
def check_in():
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