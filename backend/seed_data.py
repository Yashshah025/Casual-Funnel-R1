"""
Database Seeder Script for CausalFunnel Analytics
Populates MongoDB with realistic e-commerce user interaction datasets:
- 25+ unique sessions across realistic time spans
- Multi-step chronological user journeys (bouncers, browsers, buyers)
- Realistic coordinate clusters on buttons, cards, and navigation for heatmaps
"""

import random
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient
from config import Config

def seed_database():
    client = MongoClient(Config.MONGO_URI)
    db_name = "causalfunnel_analytics"
    try:
        db_name = client.get_default_database().name or db_name
    except Exception:
        pass
    db = client[db_name]
    events_col = db["events"]

    print(f"[*] Connected to MongoDB: {db_name}")
    print(f"[*] Current documents in 'events': {events_col.count_documents({})}")

    # Target Pages
    BASE_URL = "http://localhost:5000/demo"
    URL_HOME = f"{BASE_URL}/index.html"
    URL_PRODUCT = f"{BASE_URL}/product.html"

    # Common clickable UI zones (Coordinates with small natural variance)
    CLICK_TARGETS_HOME = [
        {"name": "Hero CTA Button", "base_x": 680, "base_y": 270, "variance": 25},
        {"name": "Nav Featured Item", "base_x": 780, "base_y": 35, "variance": 15},
        {"name": "Nav Home", "base_x": 700, "base_y": 35, "variance": 15},
        {"name": "Headphones Add to Cart", "base_x": 280, "base_y": 550, "variance": 20},
        {"name": "Smart Watch Add to Cart", "base_x": 640, "base_y": 550, "variance": 20},
        {"name": "Camera Details Link", "base_x": 980, "base_y": 550, "variance": 20},
        {"name": "Headphones Card Area", "base_x": 280, "base_y": 420, "variance": 35},
        {"name": "Smart Watch Card Area", "base_x": 640, "base_y": 420, "variance": 35},
        {"name": "Vintage Camera Card Area", "base_x": 980, "base_y": 420, "variance": 35},
    ]

    CLICK_TARGETS_PRODUCT = [
        {"name": "Buy Now Button", "base_x": 640, "base_y": 420, "variance": 20},
        {"name": "Wishlist Button", "base_x": 800, "base_y": 420, "variance": 20},
        {"name": "Back to Products", "base_x": 230, "base_y": 140, "variance": 15},
        {"name": "Product Image Area", "base_x": 420, "base_y": 320, "variance": 40},
    ]

    def jitter(base, var):
        return round(base + random.gauss(0, var), 1)

    now = datetime.now(timezone.utc)
    all_events = []

    # Persona archetypes
    session_count = 30
    print(f"[*] Generating {session_count} realistic sessions with journeys...")

    for i in range(1, session_count + 1):
        # Stagger sessions over the past 48 hours
        session_time = now - timedelta(hours=random.uniform(0.5, 48))
        session_id = f"sess_cf_{session_time.strftime('%m%d')}_{random.randint(1000, 9999)}_{i:02d}"
        vw = random.choice([1440, 1920, 1366, 1536])
        vh = random.choice([900, 1080, 768, 864])
        viewport = {"width": vw, "height": vh}

        archetype = random.choices(["buyer", "browser", "bouncer", "curious"], weights=[30, 40, 15, 15])[0]

        # 1. First event: page_view on Homepage
        all_events.append({
            "session_id": session_id,
            "event_type": "page_view",
            "url": URL_HOME,
            "timestamp": session_time,
            "coordinates": None,
            "viewport": viewport
        })

        current_time = session_time

        if archetype == "bouncer":
            # 1 quick random click or none, leaves quickly
            if random.random() > 0.4:
                current_time += timedelta(seconds=random.randint(2, 6))
                t = random.choice(CLICK_TARGETS_HOME)
                all_events.append({
                    "session_id": session_id,
                    "event_type": "click",
                    "url": URL_HOME,
                    "timestamp": current_time,
                    "coordinates": {"x": jitter(t["base_x"], t["variance"]), "y": jitter(t["base_y"], t["variance"])},
                    "viewport": viewport
                })

        elif archetype == "browser":
            # Multiple clicks on homepage, maybe views product
            click_count = random.randint(2, 5)
            for _ in range(click_count):
                current_time += timedelta(seconds=random.randint(3, 12))
                t = random.choice(CLICK_TARGETS_HOME)
                all_events.append({
                    "session_id": session_id,
                    "event_type": "click",
                    "url": URL_HOME,
                    "timestamp": current_time,
                    "coordinates": {"x": jitter(t["base_x"], t["variance"]), "y": jitter(t["base_y"], t["variance"])},
                    "viewport": viewport
                })

            # 50% chance navigates to product page
            if random.random() > 0.5:
                current_time += timedelta(seconds=2)
                all_events.append({
                    "session_id": session_id,
                    "event_type": "page_view",
                    "url": URL_PRODUCT,
                    "timestamp": current_time,
                    "coordinates": None,
                    "viewport": viewport
                })
                # Wishlist click
                current_time += timedelta(seconds=random.randint(4, 10))
                t = CLICK_TARGETS_PRODUCT[1] # Wishlist
                all_events.append({
                    "session_id": session_id,
                    "event_type": "click",
                    "url": URL_PRODUCT,
                    "timestamp": current_time,
                    "coordinates": {"x": jitter(t["base_x"], t["variance"]), "y": jitter(t["base_y"], t["variance"])},
                    "viewport": viewport
                })

        elif archetype == "buyer":
            # High-intent path: Home -> click CTA or details -> Product page -> Buy Now
            current_time += timedelta(seconds=random.randint(3, 7))
            t = random.choice([CLICK_TARGETS_HOME[0], CLICK_TARGETS_HOME[5]]) # Hero CTA or Camera Details
            all_events.append({
                "session_id": session_id,
                "event_type": "click",
                "url": URL_HOME,
                "timestamp": current_time,
                "coordinates": {"x": jitter(t["base_x"], t["variance"]), "y": jitter(t["base_y"], t["variance"])},
                "viewport": viewport
            })

            # Navigates to product page
            current_time += timedelta(seconds=1)
            all_events.append({
                "session_id": session_id,
                "event_type": "page_view",
                "url": URL_PRODUCT,
                "timestamp": current_time,
                "coordinates": None,
                "viewport": viewport
            })

            # Inspects product
            current_time += timedelta(seconds=random.randint(5, 15))
            t = CLICK_TARGETS_PRODUCT[3] # Image area
            all_events.append({
                "session_id": session_id,
                "event_type": "click",
                "url": URL_PRODUCT,
                "timestamp": current_time,
                "coordinates": {"x": jitter(t["base_x"], t["variance"]), "y": jitter(t["base_y"], t["variance"])},
                "viewport": viewport
            })

            # Clicks Buy Now!
            current_time += timedelta(seconds=random.randint(4, 10))
            t = CLICK_TARGETS_PRODUCT[0] # Buy Now
            all_events.append({
                "session_id": session_id,
                "event_type": "click",
                "url": URL_PRODUCT,
                "timestamp": current_time,
                "coordinates": {"x": jitter(t["base_x"], t["variance"]), "y": jitter(t["base_y"], t["variance"])},
                "viewport": viewport
            })

        elif archetype == "curious":
            # Adds multiple items to cart on homepage
            for t in [CLICK_TARGETS_HOME[3], CLICK_TARGETS_HOME[4]]:
                current_time += timedelta(seconds=random.randint(4, 9))
                all_events.append({
                    "session_id": session_id,
                    "event_type": "click",
                    "url": URL_HOME,
                    "timestamp": current_time,
                    "coordinates": {"x": jitter(t["base_x"], t["variance"]), "y": jitter(t["base_y"], t["variance"])},
                    "viewport": viewport
                })

    # Bulk insert
    res = events_col.insert_many(all_events)
    print(f"[SUCCESS] Successfully inserted {len(res.inserted_ids)} events across {session_count} new sessions!")
    print(f"[*] New total documents in 'events': {events_col.count_documents({})}")

if __name__ == "__main__":
    seed_database()
