import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/causalfunnel_analytics")
    PORT = int(os.getenv("PORT", 5000))
    ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "")
    
    # Ingestion rate limits (prevent bot spam & DDoS)
    INGESTION_RATE_LIMIT = "120 per minute"
    
    # Analytics read rate limits
    ANALYTICS_RATE_LIMIT = "60 per minute"
    
    # Cache configuration (Simple in-memory cache)
    CACHE_TYPE = "SimpleCache"
    CACHE_DEFAULT_TIMEOUT = 30  # 30 seconds TTL for heavy aggregations
