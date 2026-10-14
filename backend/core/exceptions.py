class AppError(Exception):
    """Base application exception."""
    def __init__(self, message, status_code=500, details=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}

class ValidationError(AppError):
    def __init__(self, message, details=None):
        super().__init__(message, status_code=400, details=details)

class NotFoundError(AppError):
    def __init__(self, message="Resource not found", details=None):
        super().__init__(message, status_code=404, details=details)

class DatabaseError(AppError):
    def __init__(self, message="Database operation failed", details=None):
        super().__init__(message, status_code=503, details=details)

class UnauthorizedError(AppError):
    def __init__(self, message="Unauthorized access", details=None):
        super().__init__(message, status_code=401, details=details)
