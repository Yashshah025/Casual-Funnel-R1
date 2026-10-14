import os
from flask import Flask, send_from_directory
from config import Config
from extensions import cors, limiter, cache
from database.connection import mongo_manager
from database.indexes import setup_indexes
from routes import register_routes
from core.exceptions import AppError
from core.responses import error_response, success_response
from core.logger import logger

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # 1. Enforce max payload limit (16KB)
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024

    # 2. Initialize extensions
    cors.init_app(app, resources={
        r"/api/*": {
            "origins": "*",
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "X-API-Key"]
        }
    })
    limiter.init_app(app)
    cache.init_app(app)

    # 3. Database connection & index setup
    try:
        events_col = mongo_manager.get_collection("events")
        setup_indexes(events_col)
    except Exception as e:
        logger.warning(f"Database deferred initialization: {e}")

    # 4. Register modular blueprints
    register_routes(app)

    tracker_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'tracker'))
    demo_dir = os.path.join(tracker_dir, 'demo')

    @app.route('/tracker.js', methods=['GET'])
    def serve_tracker():
        response = send_from_directory(tracker_dir, 'tracker.js')
        response.headers['Cache-Control'] = 'public, max-age=600'
        return response

    @app.route('/demo/', methods=['GET'])
    @app.route('/demo/<path:filename>', methods=['GET'])
    def serve_demo(filename='index.html'):
        return send_from_directory(demo_dir, filename)

    # 6. Service Health Check
    @app.route('/health', methods=['GET'])
    def health():
        return success_response(
            data={"status": "healthy", "service": "CausalFunnel Analytics Engine"}
        )

    # 7. Global Exception Handlers
    @app.errorhandler(AppError)
    def handle_app_error(err):
        return error_response(
            message=err.message,
            status_code=err.status_code,
            details=err.details
        )

    @app.errorhandler(429)
    def handle_ratelimit(e):
        return error_response(
            message="Rate limit exceeded. Please throttle your requests.",
            status_code=429
        )

    @app.errorhandler(413)
    def handle_payload_too_large(e):
        return error_response(
            message="Payload exceeds the maximum allowed size of 16KB.",
            status_code=413
        )

    @app.errorhandler(404)
    def handle_not_found(e):
        return error_response(
            message="Resource endpoint not found.",
            status_code=404
        )

    @app.errorhandler(Exception)
    def handle_unexpected_error(e):
        logger.error(f"Unhandled Exception: {str(e)}", exc_info=True)
        return error_response(
            message="An internal server error occurred.",
            status_code=500
        )

    return app

if __name__ == '__main__':
    app = create_app()
    port = Config.PORT
    logger.info(f"Starting server on http://0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)
