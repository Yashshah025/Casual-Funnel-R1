from flask import Blueprint, request
from services.ingestion_service import ingestion_service
from core.responses import success_response
from extensions import limiter
from config import Config

ingestion_bp = Blueprint('ingestion', __name__)

@ingestion_bp.route('/events', methods=['POST'])
@limiter.limit(Config.INGESTION_RATE_LIMIT)
def track_event():
    """
    Client Ingestion Endpoint
    Delegates to IngestionService and returns standard success response envelope.
    """
    payload = request.get_json(silent=True)
    result = ingestion_service.process_and_save_event(payload)
    return success_response(
        data=result,
        message="Event tracked successfully",
        status_code=201
    )
