from datetime import datetime, timezone
from core.exceptions import ValidationError
from repositories.event_repository import event_repository
from core.logger import logger

ALLOWED_EVENT_TYPES = {'page_view', 'click'}

class IngestionService:
    @staticmethod
    def process_and_save_event(raw_data):
        """
        Validates, sanitizes, and persists incoming analytics event.
        """
        if not raw_data or not isinstance(raw_data, dict):
            raise ValidationError("Payload must be a valid JSON object")

        session_id = raw_data.get('session_id')
        event_type = raw_data.get('event_type')
        url = raw_data.get('url')

        if not session_id or not isinstance(session_id, str) or not session_id.strip():
            raise ValidationError("Missing or invalid field: 'session_id'")

        if not event_type or event_type not in ALLOWED_EVENT_TYPES:
            raise ValidationError(f"Invalid 'event_type'. Must be one of: {sorted(list(ALLOWED_EVENT_TYPES))}")

        if not url or not isinstance(url, str) or not url.strip():
            raise ValidationError("Missing or invalid field: 'url'")

        # Timestamp normalization
        raw_ts = raw_data.get('timestamp')
        if raw_ts and isinstance(raw_ts, str):
            try:
                clean_ts = raw_ts.replace('Z', '+00:00')
                parsed_timestamp = datetime.fromisoformat(clean_ts)
            except Exception:
                parsed_timestamp = datetime.now(timezone.utc)
        else:
            parsed_timestamp = datetime.now(timezone.utc)

        # Coordinate validation for click events
        coordinates = None
        if event_type == 'click':
            coords = raw_data.get('coordinates')
            if not coords or not isinstance(coords, dict):
                raise ValidationError("Coordinates object with 'x' and 'y' is required for click events")

            x = coords.get('x')
            y = coords.get('y')
            if x is None or y is None or not (isinstance(x, (int, float)) and isinstance(y, (int, float))):
                raise ValidationError("Coordinates 'x' and 'y' must be valid numbers")

            coordinates = {
                "x": round(float(x), 2),
                "y": round(float(y), 2)
            }

        # Optional Viewport
        viewport = None
        vp = raw_data.get('viewport')
        if vp and isinstance(vp, dict):
            w = vp.get('width')
            h = vp.get('height')
            if isinstance(w, (int, float)) and isinstance(h, (int, float)):
                viewport = {"width": int(w), "height": int(h)}

        document = {
            "session_id": session_id.strip(),
            "event_type": event_type,
            "url": url.strip(),
            "timestamp": parsed_timestamp,
            "coordinates": coordinates,
            "viewport": viewport
        }

        event_id = event_repository.insert(document)
        logger.info(f"Ingested event [{event_type}] for session [{session_id[:12]}...]")
        return {"event_id": event_id, "session_id": session_id, "event_type": event_type}

ingestion_service = IngestionService()
