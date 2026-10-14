from pymongo import ASCENDING, DESCENDING
from core.logger import logger

def setup_indexes(collection):
    """
    Creates compound indexes essential for sub-second analytics and journeys:
    1. session_id (ASC) + timestamp (ASC): Powers sequential user journey queries
    2. url (ASC) + event_type (ASC): Powers page heatmap filtering
    3. timestamp (DESC): Powers recent event inspection
    """
    try:
        # Index 1: Journey ordering
        collection.create_index(
            [("session_id", ASCENDING), ("timestamp", ASCENDING)],
            name="idx_session_journey",
            background=True
        )

        # Index 2: Heatmap click queries
        collection.create_index(
            [("url", ASCENDING), ("event_type", ASCENDING)],
            name="idx_url_event_type",
            background=True
        )

        # Index 3: Recent activity
        collection.create_index(
            [("timestamp", DESCENDING)],
            name="idx_timestamp_desc",
            background=True
        )

        # Index 4: Idempotency by client-supplied event_id (unique, sparse)
        collection.create_index(
            [("event_id", ASCENDING)],
            name="idx_event_id_unique",
            unique=True,
            sparse=True,
            background=True
        )

        logger.info("MongoDB indexes verified successfully.")
    except Exception as e:
        logger.warning(f"Error while setting up indexes: {e}")
