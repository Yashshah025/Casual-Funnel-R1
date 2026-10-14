from database.connection import mongo_manager
from bson import ObjectId

class EventRepository:
    def __init__(self):
        self._collection = None

    @property
    def collection(self):
        if self._collection is None:
            self._collection = mongo_manager.get_collection("events")
        return self._collection

    def find_by_event_id(self, event_id):
        """Find an event by its idempotency event_id."""
        if not event_id:
            return None
        return self.collection.find_one({"event_id": event_id})

    def find_existing_event_ids(self, event_ids):
        """Find set of existing event_ids from a list to filter duplicates."""
        if not event_ids:
            return set()
        existing = self.collection.distinct("event_id", {"event_id": {"$in": event_ids}})
        return set(existing)

    def insert(self, event_doc):
        """Insert a single event document."""
        result = self.collection.insert_one(event_doc)
        return str(result.inserted_id)

    def insert_batch(self, event_docs):
        """Insert multiple event documents."""
        if not event_docs:
            return []
        result = self.collection.insert_many(event_docs, ordered=False)
        return [str(idx) for idx in result.inserted_ids]

    def find_by_session_id(self, session_id):
        """Find all events for a given session sorted chronologically."""
        return list(self.collection.find({"session_id": session_id}).sort("timestamp", 1))

    def find_clicks_by_url(self, url):
        """Find click events for a specific URL."""
        query = {
            "url": url,
            "event_type": "click",
            "coordinates": {"$ne": None}
        }
        projection = {"coordinates": 1, "normalized": 1, "viewport": 1, "document": 1, "timestamp": 1, "_id": 1}
        return list(self.collection.find(query, projection).sort("timestamp", -1))

    def get_distinct_urls(self):
        """Fetch distinct tracked URLs."""
        return self.collection.distinct("url")

    def count_by_type(self, event_type=None):
        """Count events matching event_type or total."""
        query = {"event_type": event_type} if event_type else {}
        return self.collection.count_documents(query)

    def count_distinct_sessions(self):
        """Count total distinct session IDs."""
        return len(self.collection.distinct("session_id"))

event_repository = EventRepository()
