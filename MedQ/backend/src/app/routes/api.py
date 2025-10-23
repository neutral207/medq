# app/routes/api.py
from flask import Blueprint, request, jsonify

api_bp = Blueprint('api', __name__)

@api_bp.get('/queue')
def get_queue():
    # TODO: fetch from database
    return jsonify(department='ER', queue=[])

@api_bp.post('/checkin')
def check_in():
    payload = request.get_json(force=True, silent=True) or {}
    # TODO: write to database
    return jsonify(message='checked in', data=payload), 201
