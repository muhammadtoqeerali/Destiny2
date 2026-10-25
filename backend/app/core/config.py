"""
Central config. Everything here is read from environment variables so the
same code runs locally, on the workstation, and on a deployed backend
(Railway/Render/Fly/VM) without code changes. Sensible dev defaults are
provided, but production values MUST be overridden via env vars / secrets.
"""
import os


class Settings:
    APP_NAME = "NTNU Frailty ML Platform API"
    API_V1_PREFIX = "/api"

    # DEMO-ONLY admin password. This is intentionally simple to match the
    # brief ("simple login like admin123"). For a real deployment this
    # must become: hashed password storage, a proper session/JWT, rate
    # limiting on the login route, and HTTPS-only cookies.
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
    ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "demo-admin-token")

    # Comma-separated list of allowed frontend origins (Vercel preview +
    # prod URLs + local dev). Set CORS_ORIGINS="https://your-app.vercel.app,http://localhost:3000"
    CORS_ORIGINS = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")


settings = Settings()
