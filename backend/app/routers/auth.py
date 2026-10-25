from fastapi import APIRouter, HTTPException, status

from app.core.config import settings
from app.schemas import AdminLoginRequest, AdminLoginResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/admin-login", response_model=AdminLoginResponse)
def admin_login(payload: AdminLoginRequest):
    if payload.password != settings.ADMIN_PASSWORD:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect password.")
    return AdminLoginResponse(token=settings.ADMIN_TOKEN)
