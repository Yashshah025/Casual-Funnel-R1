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
    Client Ingestion Endpoint (Single or Batch).
    If an array is sent, delegates to batch processing; otherwise processes single event.
    """
    payload = request.get_json(silent=True)
    if isinstance(payload, list):
        result = ingestion_service.process_and_save_batch(payload)
        return success_response(
            data=result,
            message=f"Batch of {result['inserted_count']} events tracked successfully",
            status_code=201
        )

    result = ingestion_service.process_and_save_event(payload)
    return success_response(
        data=result,
        message="Event tracked successfully",
        status_code=201
    )

@ingestion_bp.route('/events/batch', methods=['POST'])
@limiter.limit(Config.INGESTION_RATE_LIMIT)
def track_events_batch():
    """
    Dedicated bulk ingestion endpoint for batched client payloads.
    Persists events using bulk MongoDB insert_many.
    """
    payload = request.get_json(silent=True)
    result = ingestion_service.process_and_save_batch(payload)
    return success_response(
        data=result,
        message=f"Bulk batch of {result['inserted_count']} events tracked successfully",
        status_code=201
    )
