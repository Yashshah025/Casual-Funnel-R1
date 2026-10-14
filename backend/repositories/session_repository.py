from database.connection import mongo_manager

class SessionRepository:
    def __init__(self):
        self._collection = None

    @property
    def collection(self):
        if self._collection is None:
            self._collection = mongo_manager.get_collection("events")
        return self._collection

    def aggregate_sessions(self, skip=0, limit=10):
        """
        Aggregate session metrics with pagination using MongoDB $facet.
        Returns both paginated session slice and total distinct session count in one query.
        """
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
                    "pages_visited": {"$addToSet": "$url"}
                }
            },
            {
                "$facet": {
                    "metadata": [{"$count": "total"}],
                    "data": [
                        {"$sort": {"last_active": -1}},
                        {"$skip": skip},
                        {"$limit": limit}
                    ]
                }
            }
        ]
        
        results = list(self.collection.aggregate(pipeline))
        if not results:
            return {"sessions": [], "total_count": 0}

        facet_result = results[0]
        total_count = facet_result["metadata"][0]["total"] if facet_result["metadata"] else 0
        sessions = facet_result["data"]

        return {"sessions": sessions, "total_count": total_count}

session_repository = SessionRepository()
