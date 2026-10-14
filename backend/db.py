from database.connection import mongo_manager

def get_events_collection():
    return mongo_manager.get_collection("events")
