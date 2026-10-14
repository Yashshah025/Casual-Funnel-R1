from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from db import get_events_collection

events_bp = Blueprint('events', __name__)

ALLOWED_EVENT_TYPES = {'page_view', 'click'}

@events_bp.route('/events', methods=['POST'])
def track_event():
    """
    Ingestion endpoint for tracker.js
    Payload schema:
    {
        "session_id": str (required),
        "event_type": "page_view" | "click" (required),
        "url": str (required),
        "timestamp": ISO-8601 string (optional, defaults to server now),
        "coordinates": {"x": int, "y": int} (required if event_type is 'click'),
        "viewport": {"width": int, "height": int} (optional)
    }
    """
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON payload"}), 400

    session_id = data.get('session_id')
    event_type = data.get('event_type')
    url = data.get('url')

    # Basic validations
    if not session_id or not isinstance(session_id, str):
        return jsonify({"error": "Missing or invalid 'session_id'"}), 400

    if not event_type or event_type not in ALLOWED_EVENT_TYPES:
        return jsonify({"error": f"Invalid 'event_type'. Must be one of {list(ALLOWED_EVENT_TYPES)}"}), 400

    if not url or not isinstance(url, str):
        return jsonify({"error": "Missing or invalid 'url'"}), 400

    # Parse timestamp
    raw_timestamp = data.get('timestamp')
    if raw_timestamp:
        try:
            # Handle ISO format strings (with or without 'Z')
            clean_ts = raw_timestamp.replace('Z', '+00:00')
            event_time = datetime.fromisoformat(clean_ts)
        except Exception:
            event_time = datetime.now(timezone.utc)
    else:
        event_time = datetime.now(timezone.utc)

    # Validate coordinates for click events
    coordinates = None
    if event_type == 'click':
        coords_raw = data.get('coordinates')
        if not coords_raw or not isinstance(coords_raw, dict):
            return jsonify({"error": "'coordinates' object with x and y is required for click events"}), 400
        
        x = coords_raw.get('x')
        y = coords_raw.get('y')
        if x is None or y is None or not (isinstance(x, (int, float)) and isinstance(y, (int, float))):
            return jsonify({"error": "Coordinates 'x' and 'y' must be numbers"}), 400

        coordinates = {"x": round(float(x), 2), "y": round(float(y), 2)}

    # Optional viewport metadata
    viewport = None
    viewport_raw = data.get('viewport')
    if viewport_raw and isinstance(viewport_raw, dict):
        vw = viewport_raw.get('width')
        vh = viewport_raw.get('height')
        if isinstance(vw, (int, float)) and isinstance(vh, (int, float)):
            viewport = {"width": int(vw), "height": int(vh)}

    # Build document
    event_doc = {
        "session_id": session_id.strip(),
        "event_type": event_type,
        "url": url.strip(),
        "timestamp": event_time,
        "coordinates": coordinates,
        "viewport": viewport
    }

    collection = get_events_collection()
    if collection is None:
        return jsonify({"error": "Database unavailable"}), 503

    try:
        result = collection.insert_one(event_doc)
        return jsonify({
            "status": "success",
            "message": "Event recorded",
            "event_id": str(result.inserted_id)
        }), 201
    except Exception as e:
        return jsonify({"error": f"Failed to store event: {str(e)}"}), 500
