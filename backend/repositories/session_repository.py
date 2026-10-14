from database.connection import mongo_manager
from pymongo import DESCENDING, ASCENDING
from core.logger import logger

class SessionRepository:
    def __init__(self):
        self._events = None
        self._sessions = None

    @property
    def events_col(self):
        if self._events is None:
            self._events = mongo_manager.get_collection("events")
        return self._events

    @property
    def sessions_col(self):
        if self._sessions is None:
            self._sessions = mongo_manager.get_collection("sessions")
            # Ensure index on last_active for instant O(log N) paginated reads
            try:
                self._sessions.create_index([("last_active", DESCENDING)], background=True)
            except Exception as e:
                logger.warning(f"Failed to create session index: {e}")
        return self._sessions

    def upsert_session_summary(self, event_doc):
        """
        Incrementally maintains materialized session summary on event ingestion.
        Eliminates expensive full-collection aggregation during dashboard reads.
        """
        session_id = event_doc["session_id"]
        timestamp = event_doc["timestamp"]
        event_type = event_doc["event_type"]
        url = event_doc["url"]

        self.sessions_col.update_one(
            {"_id": session_id},
            {
                "$setOnInsert": {
                    "session_id": session_id
                },
                "$max": {"last_active": timestamp},
                "$min": {"started_at": timestamp},
                "$inc": {
                    "total_events": 1,
                    "page_views": 1 if event_type == "page_view" else 0,
                    "clicks": 1 if event_type == "click" else 0
                },
                "$addToSet": {"pages_visited": url}
            },
            upsert=True
        )

    def upsert_session_summaries_bulk(self, event_docs):
        """Maintains session summaries in bulk for batched events."""
        for doc in event_docs:
            self.upsert_session_summary(doc)

    def get_paginated_sessions(self, skip=0, limit=10):
        """
        Paginate over pre-computed, indexed session summaries.
        Time Complexity: O(log N) for skip + limit using { last_active: -1 } index.
        """
        total_count = self.sessions_col.count_documents({})
        cursor = self.sessions_col.find({}).sort("last_active", DESCENDING).skip(skip).limit(limit)

        sessions = []
        for doc in cursor:
            started = doc.get("started_at")
            last = doc.get("last_active")
            duration_secs = 0
            if started and last:
                duration_secs = max(0, int((last - started).total_seconds()))

            sessions.append({
                "session_id": doc["_id"],
                "total_events": doc.get("total_events", 0),
                "page_views": doc.get("page_views", 0),
                "clicks": doc.get("clicks", 0),
                "started_at": started.isoformat() if started else None,
                "last_active": last.isoformat() if last else None,
                "duration_seconds": duration_secs,
                "pages_visited": doc.get("pages_visited", [])
            })

        return {"sessions": sessions, "total_count": total_count}

    def sync_materialized_sessions_if_needed(self):
        """
        Utility to populate/rebuild session summaries from existing event documents
        if collection is fresh or out of sync.
        """
        try:
            session_count = self.sessions_col.count_documents({})
            event_count = self.events_col.count_documents({})
            if session_count == 0 and event_count > 0:
                logger.info("Materializing session summaries from existing event collection...")
                pipeline = [
                    {
                        "$group": {
                            "_id": "$session_id",
                            "total_events": {"$sum": 1},
                            "page_views": {"$sum": {"$cond": [{"$eq": ["$event_type", "page_view"]}, 1, 0]}},
                            "clicks": {"$sum": {"$cond": [{"$eq": ["$event_type", "click"]}, 1, 0]}},
                            "started_at": {"$min": "$timestamp"},
                            "last_active": {"$max": "$timestamp"},
                            "pages_visited": {"$addToSet": "$url"}
                        }
                    }
                ]
                results = list(self.events_col.aggregate(pipeline))
                for r in results:
                    r["session_id"] = r["_id"]
                    self.sessions_col.replace_one({"_id": r["_id"]}, r, upsert=True)
                logger.info(f"Materialized {len(results)} session summaries.")
        except Exception as e:
            logger.warning(f"Session materialization notice: {e}")

session_repository = SessionRepository()
