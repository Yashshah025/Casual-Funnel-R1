import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    ENV = os.getenv("FLASK_ENV", "development")
    DEBUG = ENV == "development"
    TESTING = False
    
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/causalfunnel_analytics")
    PORT = int(os.getenv("PORT", 5000))
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", 256 * 1024))  # 256KB bounded batch limit
    
    # Dashboard API Authentication
    ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "")
    REQUIRE_DASHBOARD_AUTH = os.getenv("REQUIRE_DASHBOARD_AUTH", "false").lower() in ("true", "1", "yes")

    # In production, require an explicit API key if auth is mandated
    if ENV == "production" and not ADMIN_API_KEY and REQUIRE_DASHBOARD_AUTH:
        raise ValueError("CRITICAL: ADMIN_API_KEY environment variable is required in production mode.")

    # Ingestion rate limits (per IP)
    INGESTION_RATE_LIMIT = os.getenv("INGESTION_RATE_LIMIT", "120 per minute")
    
    # Analytics read rate limits
    ANALYTICS_RATE_LIMIT = os.getenv("ANALYTICS_RATE_LIMIT", "60 per minute")
    
    # Rate limiter storage (Memory in dev; Redis in multi-worker production)
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", "memory://")
    
    # Cache configuration
    CACHE_TYPE = os.getenv("CACHE_TYPE", "SimpleCache")
    CACHE_DEFAULT_TIMEOUT = int(os.getenv("CACHE_DEFAULT_TIMEOUT", 30))

    # Allowed Origins: Public for tracker ingestion, restricted for analytics
    ALLOWED_DASHBOARD_ORIGINS = os.getenv("ALLOWED_DASHBOARD_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173").split(",")
