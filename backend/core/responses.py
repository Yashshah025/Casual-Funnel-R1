from flask import jsonify

def success_response(data=None, message="Success", status_code=200, meta=None):
    """Unified success response envelope."""
    payload = {
        "success": True,
        "message": message,
        "data": data if data is not None else {}
    }
    if meta is not None:
        payload["meta"] = meta
    return jsonify(payload), status_code

def error_response(message="An error occurred", status_code=500, details=None):
    """Unified error response envelope."""
    payload = {
        "success": False,
        "error": {
            "message": message,
            "status_code": status_code,
            "details": details or {}
        }
    }
    return jsonify(payload), status_code
