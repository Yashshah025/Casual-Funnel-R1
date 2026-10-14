from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
from config import Config
from core.logger import logger
from core.exceptions import DatabaseError

class MongoConnectionManager:
    _instance = None
    _client = None
    _db = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def connect(self):
        if self._client is not None:
            return self._db

        try:
            logger.info("Initializing MongoDB connection...")
            self._client = MongoClient(Config.MONGO_URI, serverSelectionTimeoutMS=5000)
            # Ping to verify
            self._client.admin.command('ping')

            default_db_name = "causalfunnel_analytics"
            try:
                db_name = self._client.get_default_database().name or default_db_name
            except Exception:
                db_name = default_db_name

            self._db = self._client[db_name]
            logger.info(f"Connected to MongoDB database: [{db_name}]")
            return self._db
        except ConnectionFailure as err:
            logger.error(f"MongoDB connection failed: {err}")
            raise DatabaseError(f"Database connection failed: {err}")

    def get_db(self):
        if self._db is None:
            return self.connect()
        return self._db

    def get_collection(self, collection_name="events"):
        db = self.get_db()
        return db[collection_name]

mongo_manager = MongoConnectionManager.get_instance()
