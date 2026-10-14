"""
WSGI Production Entrypoint for CausalFunnel Analytics API
Use with Gunicorn or Waitress in production:
    gunicorn --workers 4 --bind 0.0.0.0:5000 wsgi:app
"""
from app import create_app

app = create_app()
application = app  # Alias for WSGI servers expecting 'application'

if __name__ == "__main__":
    app.run()
