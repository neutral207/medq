from flask import Blueprint, request, jsonify
from src.app.errors import ApiError
import joblib
import pandas as pd
import os

api_bp = Blueprint("api", __name__)

@api_bp.get("/queue")
def get_queue():
    return jsonify(department="ER", queue=[])

@api_bp.post("/checkin")
def check_in():
<<<<<<< HEAD
    if not request.is_json:
        raise ApiError("Content-Type must be application/json", code=415)
    data = request.get_json(silent=True) or {}
    if "department" not in data:
        raise ApiError("Missing field: department", code=422)
    return jsonify(message="checked in", data=data), 201

# Load model at startup
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "ml", "wait_time_model.pkl")
MODEL_PATH = os.path.abspath(MODEL_PATH)

try:
    model = joblib.load(MODEL_PATH)
    print(f"Loaded wait time model from {MODEL_PATH}")
except Exception as e:
    print(f"Error loading model: {e}")
    model = None

@api_bp.route("/predict_wait", methods=["POST"])
def predict_wait():
    if model is None:
        return jsonify({"error": "Model not available"}), 500

    data = request.get_json()

    # Required fields for prediction
    required = ["severity", "hour_of_day", "queue_length", "staff_in_service"]

    missing = [field for field in required if field not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    # Convert single JSON input to DataFrame
    df = pd.DataFrame([{
        "severity": data["severity"],
        "hour_of_day": data["hour_of_day"],
        "queue_length": data["queue_length"],
        "staff_in_service": data["staff_in_service"]
    }])

    try:
        prediction = model.predict(df)[0]
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify({
        "predicted_wait_minutes": round(float(prediction), 2)
    })
=======
    payload = request.get_json(force=True, silent=True) or {}
    # TODO: write to database
    return jsonify(message='checked in', data=payload), 201

>>>>>>> f51bff0997f525a91c9b51e9b6b3bda64a708721
