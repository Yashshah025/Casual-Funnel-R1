from routes.ingestion_routes import ingestion_bp
from routes.analytics_routes import analytics_bp

def register_routes(app):
    app.register_blueprint(ingestion_bp, url_prefix='/api')
    app.register_blueprint(analytics_bp, url_prefix='/api')
