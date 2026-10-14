from flask import Blueprint, request, jsonify
from datetime import datetime
from db import get_events_collection
from config import Config

analytics_bp = Blueprint('analytics', __name__)

def verify_auth_if_configured():
    """Optional security check: verify API key if ADMIN_API_KEY is configured in env."""
    expected_key = Config.ADMIN_API_KEY
    if expected_key:
        auth_header = request.headers.get("X-API-Key") or request.headers.get("Authorization")
        if not auth_header or (auth_header != expected_key and auth_header != f"Bearer {expected_key}"):
            return False
    return True

@analytics_bp.before_request
def check_dashboard_auth():
    if not verify_auth_if_configured():
        return jsonify({"error": "Unauthorized: Invalid or missing API key"}), 401


@analytics_bp.route('/overview', methods=['GET'])
def get_overview():
    """Returns high-level application metrics for dashboard cards."""
    collection = get_events_collection()
    if collection is None:
        return jsonify({"error": "Database unavailable"}), 503

    try:
        total_events = collection.count_documents({})
        total_page_views = collection.count_documents({"event_type": "page_view"})
        total_clicks = collection.count_documents({"event_type": "click"})
        total_sessions = len(collection.distinct("session_id"))
        unique_urls = len(collection.distinct("url"))

        return jsonify({
            "total_events": total_events,
            "total_sessions": total_sessions,
            "total_page_views": total_page_views,
            "total_clicks": total_clicks,
            "unique_urls": unique_urls
        }), 200
    except Exception as e:
        return jsonify({"error": f"Failed to fetch overview: {str(e)}"}), 500


@analytics_bp.route('/sessions', methods=['GET'])
def get_sessions():
    """
    Fetch a list of sessions with total event counts, start time, last active,
    and pages visited. Supports pagination via 'limit' and 'skip'.
    """
    collection = get_events_collection()
    if collection is None:
        return jsonify({"error": "Database unavailable"}), 503

    limit = min(int(request.args.get('limit', 50)), 200)
    skip = int(request.args.get('skip', 0))

    try:
        pipeline = [
            {
                "$group": {
                    "_id": "$session_id",
                    "total_events": {"$sum": 1},
                    "page_views": {
                        "$sum": {"$cond": [{"$eq": ["$event_type", "page_view"]}, 1, 0]}
                    },
                    "clicks": {
                        "$sum": {"$cond": [{"$eq": ["$event_type", "click"]}, 1, 0]}
                    },
                    "started_at": {"$min": "$timestamp"},
                    "last_active": {"$max": "$timestamp"},
                    "urls": {"$addToSet": "$url"}
                }
            },
            {"$sort": {"last_active": -1}},
            {"$skip": skip},
            {"$limit": limit}
        ]

        results = list(collection.aggregate(pipeline))

        formatted_sessions = []
        for doc in results:
            # Calculate duration in seconds
            duration_secs = 0
            if doc.get("started_at") and doc.get("last_active"):
                duration_secs = int((doc["last_active"] - doc["started_at"]).total_seconds())

            formatted_sessions.append({
                "session_id": doc["_id"],
                "total_events": doc.get("total_events", 0),
                "page_views": doc.get("page_views", 0),
                "clicks": doc.get("clicks", 0),
                "started_at": doc["started_at"].isoformat() if doc.get("started_at") else None,
                "last_active": doc["last_active"].isoformat() if doc.get("last_active") else None,
                "duration_seconds": duration_secs,
                "pages_visited": doc.get("urls", [])
            })

        return jsonify({
            "count": len(formatted_sessions),
            "sessions": formatted_sessions
        }), 200
    except Exception as e:
        return jsonify({"error": f"Failed to fetch sessions: {str(e)}"}), 500


@analytics_bp.route('/sessions/<session_id>', methods=['GET'])
def get_session_journey(session_id):
    """
    Fetch all events for a specific session in chronological order (User Journey).
    """
    collection = get_events_collection()
    if collection is None:
        return jsonify({"error": "Database unavailable"}), 503

    if not session_id:
        return jsonify({"error": "session_id path parameter is required"}), 400

    try:
        cursor = collection.find({"session_id": session_id}).sort("timestamp", 1)
        
        events = []
        for doc in cursor:
            events.append({
                "id": str(doc["_id"]),
                "session_id": doc.get("session_id"),
                "event_type": doc.get("event_type"),
                "url": doc.get("url"),
                "timestamp": doc["timestamp"].isoformat() if doc.get("timestamp") else None,
                "coordinates": doc.get("coordinates"),
                "viewport": doc.get("viewport")
            })

        if not events:
            return jsonify({"error": "Session not found or has no recorded events", "events": []}), 404

        return jsonify({
            "session_id": session_id,
            "total_events": len(events),
            "events": events
        }), 200
    except Exception as e:
        return jsonify({"error": f"Failed to fetch session journey: {str(e)}"}), 500


@analytics_bp.route('/analytics/clicks', methods=['GET'])
def get_clicks_for_page():
    """
    Fetch all click coordinates for a given page URL (used to render heatmaps).
    Query parameter: 'url' (required)
    """
    collection = get_events_collection()
    if collection is None:
        return jsonify({"error": "Database unavailable"}), 503

    target_url = request.args.get('url')
    if not target_url:
        return jsonify({"error": "Missing required query parameter: 'url'"}), 400

    try:
        query = {
            "url": target_url.strip(),
            "event_type": "click",
            "coordinates": {"$ne": None}
        }
        
        cursor = collection.find(query, {"coordinates": 1, "viewport": 1, "timestamp": 1, "_id": 1}).sort("timestamp", -1)

        points = []
        for doc in cursor:
            coords = doc.get("coordinates")
            if coords and "x" in coords and "y" in coords:
                points.append({
                    "id": str(doc["_id"]),
                    "x": coords["x"],
                    "y": coords["y"],
                    "viewport": doc.get("viewport"),
                    "timestamp": doc["timestamp"].isoformat() if doc.get("timestamp") else None
                })

        return jsonify({
            "url": target_url,
            "total_clicks": len(points),
            "points": points
        }), 200
    except Exception as e:
        return jsonify({"error": f"Failed to fetch click data: {str(e)}"}), 500


@analytics_bp.route('/analytics/pages', methods=['GET'])
def get_tracked_pages():
    """
    Fetch a list of all distinct tracked URLs for dropdown selection in the heatmap.
    """
    collection = get_events_collection()
    if collection is None:
        return jsonify({"error": "Database unavailable"}), 503

    try:
        urls = collection.distinct("url")
        return jsonify({"pages": sorted(urls)}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to fetch tracked pages: {str(e)}"}), 500
