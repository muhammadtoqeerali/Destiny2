import json
import os

import pandas as pd
from fastapi import APIRouter, Depends, Query

from app.core.security import require_admin

router = APIRouter(prefix="/dataset", tags=["dataset"])

HERE = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
DATA_RAW = os.path.join(REPO_ROOT, "data", "raw")
DATA_ARTIFACTS = os.path.join(REPO_ROOT, "data", "artifacts")


def _read_json(path):
    with open(path) as f:
        return json.load(f)


@router.get("/annotation")
def dataset_annotation(_: bool = Depends(require_admin)):
    """Full data dictionary: every column, what it means, units."""
    return _read_json(os.path.join(DATA_RAW, "data_dictionary.json"))


@router.get("/summary")
def dataset_summary(_: bool = Depends(require_admin)):
    """Headline numbers + distributions for the admin 'Dataset' tab
    (reuses the BEFORE block computed during preprocessing)."""
    summary = _read_json(os.path.join(DATA_ARTIFACTS, "preprocessing_summary.json"))
    return {
        "n_rows": summary["before"]["n_rows"],
        "n_columns": summary["before"]["n_columns"],
        "target_prevalence": summary["before"]["target_prevalence"],
        "missingness_pct": summary["before"]["missingness_pct"],
        "numeric_summary": summary["before"]["numeric_summary"],
        "fried_status_counts": summary["before"]["fried_status_counts"],
        "feature_target_correlation": summary["feature_target_correlation_train"],
    }


@router.get("/sample")
def dataset_sample(limit: int = Query(25, ge=1, le=200), _: bool = Depends(require_admin)):
    """A preview table of raw rows for the dataset annotation page."""
    df = pd.read_csv(os.path.join(DATA_RAW, "patients_raw.csv"))
    sample = df.sample(min(limit, len(df)), random_state=1).fillna("—")
    return {"columns": sample.columns.tolist(), "rows": sample.to_dict(orient="records")}
