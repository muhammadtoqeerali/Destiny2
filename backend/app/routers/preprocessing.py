import json
import os

from fastapi import APIRouter, Depends

from app.core.security import require_admin

router = APIRouter(prefix="/preprocessing", tags=["preprocessing"])

HERE = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
ARTIFACTS = os.path.join(REPO_ROOT, "data", "artifacts")


@router.get("/summary")
def preprocessing_summary(_: bool = Depends(require_admin)):
    """Before/after stats + the exact list of steps applied — drives the
    admin 'Preprocessing' tab (before/after charts + step list)."""
    with open(os.path.join(ARTIFACTS, "preprocessing_summary.json")) as f:
        return json.load(f)
