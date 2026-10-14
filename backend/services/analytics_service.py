from repositories.event_repository import event_repository
from repositories.session_repository import session_repository
from core.exceptions import NotFoundError, ValidationError

class AnalyticsService:
    @staticmethod
    def get_overview_metrics():
        """Aggregates high-level metrics for dashboard cards."""
        total_events = event_repository.count_by_type()
        total_page_views = event_repository.count_by_type("page_view")
        total_clicks = event_repository.count_by_type("click")
        total_sessions = event_repository.count_distinct_sessions()
        unique_urls = len(event_repository.get_distinct_urls())

        return {
            "total_events": total_events,
            "total_sessions": total_sessions,
            "total_page_views": total_page_views,
            "total_clicks": total_clicks,
            "unique_urls": unique_urls
        }

    @staticmethod
    def get_session_summaries(page=1, limit=10):
        """Fetches aggregated session documents with pagination metadata."""
        import math
        page = max(1, page)
        limit = max(1, min(limit, 100))
        skip = (page - 1) * limit

        result = session_repository.aggregate_sessions(skip=skip, limit=limit)
        raw_sessions = result.get("sessions", [])
        total_count = result.get("total_count", 0)
        total_pages = max(1, math.ceil(total_count / limit)) if total_count > 0 else 1

        formatted = []
        for doc in raw_sessions:
            started_at = doc.get("started_at")
            last_active = doc.get("last_active")
            duration_secs = 0
            if started_at and last_active:
                duration_secs = max(0, int((last_active - started_at).total_seconds()))

            formatted.append({
                "session_id": doc["_id"],
                "total_events": doc.get("total_events", 0),
                "page_views": doc.get("page_views", 0),
                "clicks": doc.get("clicks", 0),
                "started_at": started_at.isoformat() if started_at else None,
                "last_active": last_active.isoformat() if last_active else None,
                "duration_seconds": duration_secs,
                "pages_visited": doc.get("pages_visited", [])
            })

        return {
            "sessions": formatted,
            "pagination": {
                "total_count": total_count,
                "page": page,
                "limit": limit,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1
            }
        }

    @staticmethod
    def get_user_journey(session_id):
        """Fetches and transforms ordered timeline of events for a specific session."""
        if not session_id:
            raise ValidationError("Session ID is required")

        docs = event_repository.find_by_session_id(session_id)
        if not docs:
            raise NotFoundError(f"No events found for session: {session_id}")

        events = []
        for d in docs:
            events.append({
                "id": str(d["_id"]),
                "session_id": d.get("session_id"),
                "event_type": d.get("event_type"),
                "url": d.get("url"),
                "timestamp": d["timestamp"].isoformat() if d.get("timestamp") else None,
                "coordinates": d.get("coordinates"),
                "viewport": d.get("viewport")
            })

        return {
            "session_id": session_id,
            "total_events": len(events),
            "events": events
        }

    @staticmethod
    def get_page_heatmap_clicks(url):
        """Fetches click coordinates for a given page URL."""
        if not url:
            raise ValidationError("Query parameter 'url' is required")

        docs = event_repository.find_clicks_by_url(url.strip())
        points = []
        for d in docs:
            coords = d.get("coordinates")
            if coords and "x" in coords and "y" in coords:
                points.append({
                    "id": str(d["_id"]),
                    "x": coords["x"],
                    "y": coords["y"],
                    "viewport": d.get("viewport"),
                    "timestamp": d["timestamp"].isoformat() if d.get("timestamp") else None
                })

        return {
            "url": url,
            "total_clicks": len(points),
            "points": points
        }

    @staticmethod
    def get_tracked_pages():
        """Returns sorted list of distinct tracked URLs."""
        urls = event_repository.get_distinct_urls()
        return sorted([u for u in urls if u])

analytics_service = AnalyticsService()
