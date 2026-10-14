import math
import uuid
from urllib.parse import urlparse, urlunparse
from datetime import datetime, timezone, timedelta
from core.exceptions import ValidationError
from repositories.event_repository import event_repository
from repositories.session_repository import session_repository
from core.logger import logger

ALLOWED_EVENT_TYPES = {'page_view', 'click'}
MAX_BATCH_SIZE = 50

def normalize_url(raw_url):
    """
    Normalizes webpage URLs so query fragments or trailing slashes don't splinter
    analytics for the same logical page.
    """
    if not raw_url or not isinstance(raw_url, str):
        raise ValidationError("Missing or invalid field: 'url'")
    
    parsed = urlparse(raw_url.strip())
    if not parsed.scheme or not parsed.netloc:
        raise ValidationError("URL must be an absolute URL with valid scheme and host")

    # Strip hash fragments, normalize trailing slashes on root
    path = parsed.path.rstrip('/') if parsed.path != '/' else '/'
    normalized = urlunparse((
        parsed.scheme.lower(),
        parsed.netloc.lower(),
        path,
        parsed.params,
        parsed.query,
        ''  # Remove hash fragment
    ))
    return normalized

class IngestionService:
    @staticmethod
    def validate_and_prepare_event(raw_data):
        """
        Strictly validates incoming event payload without hiding errors:
        - Rejects timestamps without explicit timezone
        - Rejects negative, NaN, or infinite coordinates
        - Normalizes URLs
        - Captures stable event_id for idempotency
        - Captures both client_timestamp and server_ingested_at
        - Stores normalized coordinate percentages
        """
        if not raw_data or not isinstance(raw_data, dict):
            raise ValidationError("Event payload must be a JSON object")

        session_id = raw_data.get('session_id')
        event_type = raw_data.get('event_type')
        raw_url = raw_data.get('url')
        event_id = raw_data.get('event_id') or f"evt_{uuid.uuid4().hex}"

        if not session_id or not isinstance(session_id, str) or not session_id.strip():
            raise ValidationError("Missing or empty field: 'session_id'")

        if not event_type or event_type not in ALLOWED_EVENT_TYPES:
            raise ValidationError(f"Invalid 'event_type'. Must be one of: {sorted(list(ALLOWED_EVENT_TYPES))}")

        url = normalize_url(raw_url)

        # Timestamp validation (Strict parsing; require explicit timezone)
        raw_ts = raw_data.get('timestamp')
        if not raw_ts or not isinstance(raw_ts, str):
            raise ValidationError("Field 'timestamp' (ISO-8601 string) is required")

        try:
            clean_ts = raw_ts.replace('Z', '+00:00')
            client_timestamp = datetime.fromisoformat(clean_ts)
        except Exception as e:
            raise ValidationError(f"Malformed ISO-8601 timestamp '{raw_ts}': {str(e)}")

        if client_timestamp.tzinfo is None:
            raise ValidationError(f"Timestamp '{raw_ts}' must include an explicit timezone offset (e.g. 'Z' or '+00:00')")

        server_now = datetime.now(timezone.utc)

        # Timestamp sanity checks: reject timestamps more than 10 mins in future or > 60 days old
        if client_timestamp > server_now + timedelta(minutes=10):
            raise ValidationError("Timestamp is unreasonably in the future (> 10 minutes clock skew)")
        if client_timestamp < server_now - timedelta(days=60):
            raise ValidationError("Timestamp is too old (> 60 days in the past)")

        # Coordinate validation for click events
        coordinates = None
        normalized_coords = None

        if event_type == 'click':
            coords = raw_data.get('coordinates')
            if not coords or not isinstance(coords, dict):
                if 'x' in raw_data and 'y' in raw_data:
                    coords = {'x': raw_data.get('x'), 'y': raw_data.get('y')}
                else:
                    raise ValidationError("Click events require a 'coordinates' object with numeric 'x' and 'y'")

            x = coords.get('x')
            y = coords.get('y')

            # Verify numeric, finite, non-negative
            if x is None or y is None or not (isinstance(x, (int, float)) and isinstance(y, (int, float))):
                raise ValidationError("Coordinates 'x' and 'y' must be valid numbers")

            if math.isnan(x) or math.isinf(x) or math.isnan(y) or math.isinf(y):
                raise ValidationError("Coordinates must be finite numbers (NaN / Infinity rejected)")

            if x < 0 or y < 0:
                raise ValidationError("Coordinates cannot be negative numbers")

            coordinates = {
                "x": round(float(x), 2),
                "y": round(float(y), 2)
            }

            # Optional client-normalized percentages (pct_x, pct_y)
            raw_norm = raw_data.get('normalized')
            if not raw_norm and ('pct_x' in raw_data or 'pct_y' in raw_data):
                raw_norm = {'pct_x': raw_data.get('pct_x'), 'pct_y': raw_data.get('pct_y')}
            if raw_norm and isinstance(raw_norm, dict):
                pct_x = raw_norm.get('pct_x')
                pct_y = raw_norm.get('pct_y')
                if isinstance(pct_x, (int, float)) and isinstance(pct_y, (int, float)):
                    if 0 <= pct_x <= 100 and 0 <= pct_y <= 100:
                        normalized_coords = {
                            "pct_x": round(float(pct_x), 3),
                            "pct_y": round(float(pct_y), 3)
                        }

        # Optional Viewport Dimensions
        viewport = None
        vp = raw_data.get('viewport')
        if vp and isinstance(vp, dict):
            w = vp.get('width')
            h = vp.get('height')
            if isinstance(w, (int, float)) and isinstance(h, (int, float)):
                if w > 0 and h > 0 and not (math.isnan(w) or math.isinf(w) or math.isnan(h) or math.isinf(h)):
                    viewport = {"width": int(w), "height": int(h)}

        # Optional Document Dimensions
        document_bounds = None
        doc_b = raw_data.get('document')
        if doc_b and isinstance(doc_b, dict):
            dw = doc_b.get('width')
            dh = doc_b.get('height')
            if isinstance(dw, (int, float)) and isinstance(dh, (int, float)):
                if dw > 0 and dh > 0:
                    document_bounds = {"width": int(dw), "height": int(dh)}

        document = {
            "event_id": event_id,
            "session_id": session_id.strip(),
            "event_type": event_type,
            "url": url,
            "timestamp": client_timestamp,
            "server_ingested_at": server_now,
            "coordinates": coordinates,
            "normalized": normalized_coords,
            "viewport": viewport,
            "document": document_bounds
        }

        return document

    @staticmethod
    def process_and_save_event(raw_data):
        """
        Single event ingestion with idempotency and self-healing reconciliation.
        """
        doc = IngestionService.validate_and_prepare_event(raw_data)
        event_id_val = doc.get("event_id")

        # Idempotency check: if event_id already exists, return existing without re-counting
        existing = event_repository.find_by_event_id(event_id_val)
        if existing:
            logger.info(f"Duplicate event detected for event_id [{event_id_val}]. Returning idempotently.")
            return {
                "event_id": str(existing["_id"]),
                "session_id": doc["session_id"],
                "event_type": doc["event_type"],
                "duplicate": True
            }

        event_id = event_repository.insert(doc)
        
        # Maintain materialized session summary incrementally with fallback reconciliation
        try:
            session_repository.upsert_session_summary(doc)
        except Exception as e:
            logger.warning(f"Session summary update error for session [{doc['session_id']}]: {e}. Triggering targeted reconciliation...")
            session_repository.reconcile_session(doc["session_id"])

        logger.info(f"Ingested event [{doc['event_type']}] for session [{doc['session_id'][:12]}...]")
        return {"event_id": event_id, "session_id": doc["session_id"], "event_type": doc["event_type"]}

    @staticmethod
    def process_and_save_batch(raw_events):
        """
        True bulk event ingestion using MongoDB insert_many with batch idempotency
        and targeted session reconciliation.
        """
        if not isinstance(raw_events, list):
            raise ValidationError("Batch payload must be an array of event objects")

        if len(raw_events) == 0:
            return {"inserted_count": 0, "event_ids": []}

        if len(raw_events) > MAX_BATCH_SIZE:
            raise ValidationError(f"Batch size exceeds maximum limit of {MAX_BATCH_SIZE} events")

        prepared_docs = []
        for idx, item in enumerate(raw_events):
            try:
                doc = IngestionService.validate_and_prepare_event(item)
                prepared_docs.append(doc)
            except ValidationError as ve:
                raise ValidationError(f"Batch item [{idx}] invalid: {ve.message}")

        # Idempotency check: filter out already-ingested events by event_id
        incoming_ids = [d["event_id"] for d in prepared_docs if d.get("event_id")]
        existing_ids = event_repository.find_existing_event_ids(incoming_ids)
        new_docs = [d for d in prepared_docs if d.get("event_id") not in existing_ids]

        if new_docs:
            event_ids = event_repository.insert_batch(new_docs)
            try:
                session_repository.upsert_session_summaries_bulk(new_docs)
            except Exception as e:
                logger.warning(f"Batch session summary update error: {e}. Reconciling affected sessions...")
                affected_sessions = {d["session_id"] for d in new_docs}
                for s_id in affected_sessions:
                    session_repository.reconcile_session(s_id)
        else:
            event_ids = []

        logger.info(f"Batch processed: {len(new_docs)} new events ingested, {len(existing_ids)} duplicates skipped.")
        return {
            "inserted_count": len(new_docs),
            "duplicates_skipped": len(existing_ids),
            "event_ids": event_ids
        }

ingestion_service = IngestionService()
