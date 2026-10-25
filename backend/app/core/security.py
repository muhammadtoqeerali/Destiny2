"""
Minimal admin-session check for the demo admin area.

NOTE (flagged deliberately, say this out loud in the interview): this is a
single shared password + static bearer token, matching the brief's "simple
login like admin123". It is NOT production-grade auth. A production
version would use: per-user accounts, hashed+salted passwords (argon2),
short-lived JWTs or server sessions, HTTPS-only cookies, and rate limiting.
"""
from fastapi import Header, HTTPException, status

from app.core.config import settings


def require_admin(x_admin_token: str | None = Header(default=None)):
    if x_admin_token != settings.ADMIN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required.",
        )
    return True
