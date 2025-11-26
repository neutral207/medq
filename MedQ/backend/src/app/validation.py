from datetime import datetime
from flask import request
from app.errors import ApiError

def require_json():
    if not request.is_json:
        raise ApiError("Content-Type must be application/json", 415)
    data = request.get_json(silent=True)
    if data is None:
        raise ApiError("Malformed JSON body", 400)
    return data

def expect_fields(data, required: dict, optional: dict=None):
    optional = optional or {}
    out = {}

    # required fields
    for key, caster in required.items():
        if key not in data:
            raise ApiError(f"Missing field: {key}", 422)
        try:
            out[key] = caster(data[key])
        except Exception:
            raise ApiError(f"Invalid type for {key}", 422)

    # optional fields
    for key, caster in optional.items():
        if key in data and data[key] is not None:
            try:
                out[key] = caster(data[key])
            except Exception:
                raise ApiError(f"Invalid type for {key}", 422)

    return out

# casters
def to_int(v): return int(v)
def to_str(v):
    s = str(v).strip()
    if not s: raise ValueError()
    return s
def to_severity(v):
    x = int(v)
    if x < 1 or x > 5: raise ValueError()
    return x
def to_iso_dt(v):  # if you need timestamps later
    return datetime.fromisoformat(v)