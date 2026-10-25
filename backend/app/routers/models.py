import json
import os

from fastapi import APIRouter, Depends

from app.core.security import require_admin

router = APIRouter(prefix="/models", tags=["models"])

HERE = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
ARTIFACTS = os.path.join(REPO_ROOT, "data", "artifacts")
MODELS_DIR = os.path.join(REPO_ROOT, "models")


def _read_json(path):
    with open(path) as f:
        return json.load(f)


@router.get("/comparison")
def models_comparison(_: bool = Depends(require_admin)):
    """CV + validation + final test metrics for every trained model, plus
    ROC/PR curve points for charting — drives the admin 'Models' tab."""
    return _read_json(os.path.join(ARTIFACTS, "model_comparison.json"))


@router.get("/feature-importance")
def feature_importance(_: bool = Depends(require_admin)):
    """Global explainability: permutation importance (always available),
    logistic-regression coefficients (always available), and real SHAP
    values when the `shap` package is installed on the serving machine."""
    return _read_json(os.path.join(ARTIFACTS, "global_feature_importance.json"))


@router.get("/meta")
def model_meta(_: bool = Depends(require_admin)):
    return _read_json(os.path.join(MODELS_DIR, "model_meta.json"))
