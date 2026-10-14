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

        result = session_repository.get_paginated_sessions(skip=skip, limit=limit)
        sessions = result.get("sessions", [])
        total_count = result.get("total_count", 0)
        total_pages = max(1, math.ceil(total_count / limit)) if total_count > 0 else 1

        return {
            "sessions": sessions,
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
                norm = d.get("normalized")
                vp = d.get("viewport")
                doc_bounds = d.get("document")

                # If normalized wasn't stored by client, compute from viewport or document if available
                pct_x = norm.get("pct_x") if norm else None
                pct_y = norm.get("pct_y") if norm else None
                if pct_x is None and doc_bounds and doc_bounds.get("width"):
                    pct_x = round((coords["x"] / doc_bounds["width"]) * 100, 3)
                if pct_y is None and doc_bounds and doc_bounds.get("height"):
                    pct_y = round((coords["y"] / doc_bounds["height"]) * 100, 3)

                points.append({
                    "id": str(d["_id"]),
                    "x": coords["x"],
                    "y": coords["y"],
                    "pct_x": pct_x,
                    "pct_y": pct_y,
                    "viewport": vp,
                    "document": doc_bounds,
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
