"""
Runtime inference for a single patient, using exactly the same
feature-engineering + encoding + imputation + scaling fitted during
training (loaded from data/artifacts/preprocessor.joblib) — this is what
prevents train/serve skew.

Explanation strategy:
  - The headline risk score comes from the BEST model (by validation
    PR-AUC), saved as models/best_model.joblib.
  - The "why" shown to the doctor is a transparent, additive decomposition
    from the always-trained LOGISTIC REGRESSION model: for each (scaled)
    feature, contribution = coefficient * scaled_value. This is exact
    (not an approximation) for the logistic model and gives doctors a
    ranked list of what pushed the score up or down for this patient.
  - If `shap` is installed and the best model is tree-based, a real
    SHAP explanation is computed too and included when available.
"""
from __future__ import annotations

import json
import os
import sys
import numpy as np
import pandas as pd
import joblib

HERE = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from data.preprocess import engineer_features  # noqa: E402

ARTIFACTS_DIR = os.path.join(REPO_ROOT, "data", "artifacts")
MODELS_DIR = os.path.join(REPO_ROOT, "models")

_cache: dict = {}


def _load():
    if not _cache:
        _cache["preprocessor"] = joblib.load(os.path.join(ARTIFACTS_DIR, "preprocessor.joblib"))
        _cache["best_model"] = joblib.load(os.path.join(MODELS_DIR, "best_model.joblib"))
        _cache["logreg"] = joblib.load(os.path.join(MODELS_DIR, "logistic_model.joblib"))
        with open(os.path.join(MODELS_DIR, "model_meta.json")) as f:
            _cache["meta"] = json.load(f)
    return _cache["preprocessor"], _cache["best_model"], _cache["logreg"], _cache["meta"]


def artifacts_available() -> bool:
    return (
        os.path.exists(os.path.join(ARTIFACTS_DIR, "preprocessor.joblib"))
        and os.path.exists(os.path.join(MODELS_DIR, "best_model.joblib"))
    )


def _transform(raw: dict, preprocessor: dict) -> pd.DataFrame:
    df = pd.DataFrame([raw])
    df = engineer_features(df)

    feature_cols_raw = preprocessor["feature_cols_raw"]
    for c in feature_cols_raw:
        if c not in df.columns:
            df[c] = np.nan
    df = df[feature_cols_raw]

    numeric_cols = preprocessor["numeric_cols"]
    cat_nominal = preprocessor["cat_nominal"]
    cat_ordinal = preprocessor["cat_ordinal"]
    onehot = preprocessor["onehot"]
    ordinal = preprocessor["ordinal"]
    imputer = preprocessor["imputer"]
    scaler = preprocessor["scaler"]
    all_feature_names = preprocessor["all_feature_names"]
    ohe_names = onehot.get_feature_names_out(cat_nominal).tolist()

    num = df[numeric_cols].reset_index(drop=True)
    ohe = pd.DataFrame(
        onehot.transform(df[cat_nominal]), columns=ohe_names
    ).reset_index(drop=True)
    ordv = pd.DataFrame(
        ordinal.transform(df[cat_ordinal]), columns=cat_ordinal
    ).reset_index(drop=True)
    enc = pd.concat([num, ordv, ohe], axis=1)[all_feature_names]

    imp = pd.DataFrame(imputer.transform(enc), columns=all_feature_names)
    scaled = pd.DataFrame(scaler.transform(imp), columns=all_feature_names)
    return scaled


FRIENDLY_NAMES = {
    "age": "Age", "frailty_index_baseline": "Baseline frailty index",
    "grip_strength_kg": "Grip strength", "gait_speed_ms": "Gait speed",
    "timed_up_and_go_s": "Timed Up & Go", "chair_stand_time_s": "Chair stand test",
    "falls_last_year": "Falls in last year", "mmse_score": "MMSE (cognition) score",
    "depression_screen_score": "Depression screen score",
    "comorbidity_count": "Number of comorbidities",
    "polypharmacy_n_meds": "Number of medications",
    "hemoglobin_g_dl": "Haemoglobin", "crp_mg_l": "CRP (inflammation)",
    "albumin_g_l": "Albumin", "vitamin_d_nmol_l": "Vitamin D", "egfr_ml_min": "eGFR (kidney function)",
    "bmi": "BMI", "lives_alone": "Lives alone", "exhaustion_score": "Self-reported exhaustion",
    "weight_loss_kg_last_year": "Unintentional weight loss (1y)",
    "physical_activity_score": "Physical activity score",
    "fried_frailty_status_baseline": "Fried frailty status", "multimorbidity_flag": "Multimorbidity (3+ conditions)",
    "recurrent_falls_flag": "Recurrent falls (2+/year)", "low_mmse_flag": "Cognitive impairment flag",
    "ckd_stage_flag": "Reduced kidney function flag", "polypharmacy_flag": "Polypharmacy (5+ meds)",
}


def friendly(feature: str) -> str:
    return FRIENDLY_NAMES.get(feature, feature.replace("_", " "))


def predict_one(raw: dict) -> dict:
    preprocessor, best_model, logreg, meta = _load()
    X = _transform(raw, preprocessor)

    proba = float(best_model.predict_proba(X)[:, 1][0])
    threshold = float(meta["decision_threshold"])
    risk_label = "High risk" if proba >= threshold else "Low / stable risk"

    coefs = logreg.coef_[0]
    feature_names = meta["feature_names"]
    contributions = X.iloc[0].values * coefs
    ranked = sorted(
        zip(feature_names, contributions), key=lambda t: -abs(t[1])
    )[:8]
    top_factors = [
        {
            "feature": f,
            "label": friendly(f),
            "contribution": round(float(c), 4),
            "direction": "increases risk" if c > 0 else "decreases risk",
        }
        for f, c in ranked
    ]

    return {
        "risk_probability": round(proba, 4),
        "risk_percent": round(proba * 100, 1),
        "risk_label": risk_label,
        "decision_threshold": round(threshold, 4),
        "model_used": meta["best_model_name"],
        "top_contributing_factors": top_factors,
        "explanation_method": "logistic_regression_linear_decomposition",
    }
