import os
from functools import lru_cache

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/patients", tags=["patients"])

HERE = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
PROCESSED = os.path.join(REPO_ROOT, "data", "processed")
ARTIFACTS = os.path.join(REPO_ROOT, "data", "artifacts")

LIST_COLUMNS = [
    "patient_id", "age", "sex", "municipality", "fried_frailty_status_baseline",
    "frailty_index_baseline", "comorbidity_count", "falls_last_year",
]


@lru_cache(maxsize=1)
def _load_joined() -> pd.DataFrame:
    full = pd.read_csv(os.path.join(PROCESSED, "patients_engineered_full.csv"))
    risk = pd.read_csv(os.path.join(ARTIFACTS, "patient_risk_scores.csv"))
    merged = full.merge(
        risk[["patient_id", "predicted_risk_probability", "predicted_risk_label", "split"]],
        on="patient_id", how="left",
    )
    return merged


@router.get("")
def list_patients(
    search: str | None = Query(None, description="Search by patient ID or municipality"),
    risk: str | None = Query(None, description="Filter: 'High risk' or 'Low/stable risk'"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    df = _load_joined()
    if search:
        s = search.lower()
        df = df[
            df["patient_id"].str.lower().str.contains(s)
            | df["municipality"].str.lower().str.contains(s)
        ]
    if risk:
        df = df[df["predicted_risk_label"] == risk]

    total = len(df)
    page = df.iloc[offset: offset + limit]
    cols = LIST_COLUMNS + ["predicted_risk_probability", "predicted_risk_label"]
    return {
        "total": int(total),
        "limit": limit,
        "offset": offset,
        "patients": page[cols].fillna("—").to_dict(orient="records"),
    }


@router.get("/{patient_id}")
def get_patient(patient_id: str):
    df = _load_joined()
    row = df[df["patient_id"] == patient_id]
    if row.empty:
        raise HTTPException(status_code=404, detail="Patient not found.")
    record = row.iloc[0].where(pd.notnull(row.iloc[0]), None).to_dict()

    history = [
        {
            "timepoint": "Baseline (HUNT-style wave 1)",
            "frailty_index": record.get("frailty_index_baseline"),
            "fried_status": record.get("fried_frailty_status_baseline"),
        },
        {
            "timepoint": "~4y follow-up (synthetic)",
            "frailty_index": record.get("follow_up_frailty_index"),
            "fried_status": None,
        },
    ]
    record["history"] = history
    return record
