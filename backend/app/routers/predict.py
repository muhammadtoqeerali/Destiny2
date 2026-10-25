from fastapi import APIRouter, HTTPException

from app.ml.predict import predict_one, artifacts_available
from app.schemas import PatientPredictInput

router = APIRouter(prefix="/predict", tags=["predict"])


@router.post("")
def predict(payload: PatientPredictInput):
    """Runtime, what-if risk prediction: a clinician enters parameters for
    a (possibly hypothetical) patient and gets back a risk score plus a
    ranked explanation of the top factors driving it."""
    if not artifacts_available():
        raise HTTPException(
            status_code=503,
            detail=(
                "Model artifacts not found. Run `python data/generate_dataset.py`, "
                "`python data/preprocess.py`, then `python backend/app/ml/train.py` first."
            ),
        )
    return predict_one(payload.model_dump())
