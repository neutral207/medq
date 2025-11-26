from functools import wraps
import jwt
from flask import request, abort, current_app


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if "Authorization" in request.headers:
            token = request.headers["Authorization"].split(" ")[1]

        if not token:
            abort(401, description="Token Missing.")

        try: 
            data = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            abort(401, description="Token expired.")
        except jwt.InvalidTokenError:
            abort(401, description="Invalid Token.")

        return f(*args, **kwargs)
    return decorated