from flask import Blueprint, request, jsonify
from src.app.errors import ApiError

api_bp = Blueprint("api", __name__)

@api_bp.get("/queue")
def get_queue():
    return jsonify(department="ER", queue=[])

@api_bp.post("/checkin")
def check_in():
    if not request.is_json:
        raise ApiError("Content-Type must be application/json", code=415)
    data = request.get_json(silent=True) or {}
    if "department" not in data:
        raise ApiError("Missing field: department", code=422)
    return jsonify(message="checked in", data=data), 201