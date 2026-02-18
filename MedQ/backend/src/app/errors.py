from flask import jsonify
from werkzeug.exceptions import HTTPException

class ApiError(HTTPException):
    code = 400
    description = "Bad Request"
    def __init__(self, message=None, code=400, extra=None):
        if code: self.code = code
        self.extra = extra or {}
        self.message = message or self.description
        super().__init__(self.message)

def error_response(message, code=400, **extra):
    return jsonify({"error": message}), code

def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def handle_api_error(error):
        return error_response(error.message, error.code)

    @app.errorhandler(404)
    def _404(_):
        return error_response("Not found", 404)

    @app.errorhandler(Exception)
    def _500(err):
        app.logger.exception(err)
        return error_response("Internal server error", 500)