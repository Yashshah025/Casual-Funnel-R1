from flask import Blueprint, request
from services.analytics_service import analytics_service
from core.responses import success_response, error_response
from extensions import limiter, cache
from config import Config

analytics_bp = Blueprint('analytics', __name__)

@analytics_bp.before_request
def verify_api_key():
    """
    Enforces authentication on all dashboard/analytics endpoints.
    Active if REQUIRE_DASHBOARD_AUTH=true or ADMIN_API_KEY is configured.
    """
    if Config.REQUIRE_DASHBOARD_AUTH or Config.ADMIN_API_KEY:
        secret = Config.ADMIN_API_KEY
        key = request.headers.get("X-API-Key") or request.headers.get("Authorization")
        if not key or (key != secret and key != f"Bearer {secret}"):
            return error_response(
                message="Unauthorized: A valid API key is required to access analytics data.",
                status_code=401,
                details={"header_hint": "Provide 'X-API-Key' or 'Authorization: Bearer <key>'"}
            )

@analytics_bp.route('/overview', methods=['GET'])
@limiter.limit(Config.ANALYTICS_RATE_LIMIT)
def get_overview():
    data = analytics_service.get_overview_metrics()
    return success_response(data=data)

@analytics_bp.route('/sessions', methods=['GET'])
@limiter.limit(Config.ANALYTICS_RATE_LIMIT)
def get_sessions():
    try:
        page = max(1, int(request.args.get('page', 1)))
        limit = max(1, min(int(request.args.get('limit', 10)), 100))
    except (ValueError, TypeError):
        page, limit = 1, 10

    data = analytics_service.get_session_summaries(page=page, limit=limit)
    return success_response(
        data=data,
        meta=data.get("pagination")
    )

@analytics_bp.route('/sessions/<session_id>', methods=['GET'])
@limiter.limit(Config.ANALYTICS_RATE_LIMIT)
def get_session_journey(session_id):
    journey = analytics_service.get_user_journey(session_id)
    return success_response(data=journey)

@analytics_bp.route('/analytics/clicks', methods=['GET'])
@limiter.limit(Config.ANALYTICS_RATE_LIMIT)
def get_heatmap_clicks():
    url = request.args.get('url')
    data = analytics_service.get_page_heatmap_clicks(url)
    return success_response(data=data)

@analytics_bp.route('/analytics/pages', methods=['GET'])
@limiter.limit(Config.ANALYTICS_RATE_LIMIT)
def get_tracked_pages():
    pages = analytics_service.get_tracked_pages()
    return success_response(data={"pages": pages})
