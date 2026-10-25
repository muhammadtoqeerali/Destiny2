"""
Preprocessing pipeline for the frailty cohort.

Steps (each justified for a clinical ML pipeline, worth narrating in an
interview):
  1. Load raw extract, enforce dtypes.
  2. Capture BEFORE statistics (missingness, distribution summaries) for
     the admin "preprocessing" dashboard tab.
  3. Feature engineering: derived flags (polypharmacy, CKD stage,
     multimorbidity, low cognition, recurrent falls); age bands and BMI
     category are also derived but kept DISPLAY-ONLY (see DISPLAY_ONLY_COLS
     below for why they, plus the two composite frailty scores and
     municipality, are excluded from the model matrix).
  4. Encode remaining categoricals (one-hot; currently just `sex`).
  5. Impute missing values with a KNN imputer fit on the TRAIN split only
     (avoids leakage), applied to val/test with the train-fitted imputer.
  6. Scale numeric features with a StandardScaler (fit on train only) -
     needed for the logistic-regression explainable model; tree models
     ignore scaling but share the same matrix for simplicity.
  7. Stratified train/val/test split (70/15/15) on the target.
  8. Capture AFTER statistics + save every fitted transformer with joblib
     so the FastAPI backend can preprocess a single new patient at
     inference time exactly the same way.

Outputs:
  data/processed/{train,val,test}.csv
  data/processed/feature_names.json
  data/artifacts/preprocessing_summary.json   (before/after, for dashboard)
  data/artifacts/preprocessor.joblib          (imputer + scaler + encoders)
"""
from __future__ import annotations

import json
import os
import numpy as np
import pandas as pd
import joblib
from sklearn.impute import KNNImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder, OrdinalEncoder
from sklearn.model_selection import train_test_split

HERE = os.path.dirname(__file__)
RAW_CSV = os.path.join(HERE, "raw", "patients_raw.csv")
PROCESSED_DIR = os.path.join(HERE, "processed")
ARTIFACTS_DIR = os.path.join(HERE, "artifacts")
os.makedirs(PROCESSED_DIR, exist_ok=True)
os.makedirs(ARTIFACTS_DIR, exist_ok=True)

TARGET = "future_frailty_risk"
ID_COL = "patient_id"
# columns that leak the outcome / are post-baseline and must be excluded
# from the feature set used to PREDICT future risk at baseline time.
LEAK_COLS = ["follow_up_frailty_index"]

NOMINAL_COLS = ["sex"]
ORDINAL_COLS: dict[str, list[str]] = {}
# These columns are generated / retained for human-readable display only
# (dataset annotation, preprocessing dashboard, patient profile) and are
# deliberately NOT fed into the model matrix:
#   - age_band, bmi_category: deterministic bins of age/bmi, which are
#     already present as continuous features -> encoding both forms of
#     the same signal creates multicollinearity and unstable coefficients
#     (verified while testing: produced a nonsensical "age 65-70
#     increases risk" artifact).
#   - frailty_index_baseline, fried_frailty_status_baseline: both are
#     deterministic aggregates computed FROM ~25 of the other baseline
#     features (the 5 Fried components, 8 comorbidities, falls, MMSE,
#     depression score, labs, living situation). Including a composite
#     alongside the very features it is built from is the same
#     redundancy problem, just spread across most of the feature set;
#     it made several coefficients flip sign (e.g. physical activity
#     appearing to *increase* risk). The model instead learns directly
#     from the granular clinical variables, which keeps the per-patient
#     explanation faithful; the composite index is still shown to
#     clinicians as a familiar summary score, just not as a model input.
#   - municipality: was generated with NO designed relationship to the
#     outcome (a geographic/administrative label, not a physiological
#     risk factor). Including it added 7 one-hot columns of pure noise
#     to a ~4,200-row training set and, through regularization +
#     encoding variance, produced small but non-zero coefficients that
#     then showed up as a spurious "top contributing factor" for every
#     patient from that municipality — misleading in a clinical
#     explanation. Still shown in the admin dataset view for context.
DISPLAY_ONLY_COLS = [
    "age_band", "bmi_category",
    "frailty_index_baseline", "fried_frailty_status_baseline",
    "municipality",
]


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["age_band"] = pd.cut(
        df["age"], bins=[64, 70, 75, 80, 85, 96],
        labels=["65-70", "71-75", "76-80", "81-85", "86+"],
    ).astype(str)
    df["bmi_category"] = pd.cut(
        df["bmi"], bins=[0, 18.5, 25, 30, 100],
        labels=["Underweight", "Normal", "Overweight", "Obese"],
    ).astype(str)
    df["polypharmacy_flag"] = (df["polypharmacy_n_meds"] >= 5).astype(int)
    df["ckd_stage_flag"] = (df["egfr_ml_min"] < 60).astype(int)
    df["multimorbidity_flag"] = (df["comorbidity_count"] >= 3).astype(int)
    df["low_mmse_flag"] = (df["mmse_score"] < 24).astype(int)
    df["recurrent_falls_flag"] = (df["falls_last_year"] >= 2).astype(int)
    return df


def missingness_report(df: pd.DataFrame) -> dict:
    miss = df.isna().mean().sort_values(ascending=False)
    return {col: round(float(v), 4) for col, v in miss.items() if v > 0}


def numeric_summary(df: pd.DataFrame, cols: list[str]) -> dict:
    out = {}
    for c in cols:
        s = df[c].dropna()
        if len(s) == 0:
            continue
        out[c] = {
            "mean": round(float(s.mean()), 3),
            "std": round(float(s.std()), 3),
            "min": round(float(s.min()), 3),
            "p25": round(float(s.quantile(0.25)), 3),
            "median": round(float(s.median()), 3),
            "p75": round(float(s.quantile(0.75)), 3),
            "max": round(float(s.max()), 3),
        }
    return out


def run():
    df_raw = pd.read_csv(RAW_CSV)
    numeric_cols_raw = df_raw.select_dtypes(include=[np.number]).columns.tolist()
    numeric_cols_raw = [c for c in numeric_cols_raw if c != TARGET]

    before = {
        "n_rows": int(len(df_raw)),
        "n_columns": int(df_raw.shape[1]),
        "missingness_pct": missingness_report(df_raw),
        "target_prevalence": round(float(df_raw[TARGET].mean()), 4),
        "numeric_summary": numeric_summary(df_raw, numeric_cols_raw),
        "fried_status_counts": df_raw["fried_frailty_status_baseline"]
        .value_counts().to_dict(),
    }

    # ---- feature engineering -----------------------------------------
    df = engineer_features(df_raw)  # full, human-readable table (keeps display-only cols)
    model_df = df.drop(columns=LEAK_COLS + DISPLAY_ONLY_COLS)

    feature_cols = [c for c in model_df.columns if c not in (TARGET, ID_COL)]
    cat_nominal = NOMINAL_COLS
    cat_ordinal = list(ORDINAL_COLS.keys())
    numeric_cols = [
        c for c in feature_cols
        if c not in cat_nominal + cat_ordinal
    ]

    # ---- split FIRST (avoid leakage into imputer/scaler fitting) -------
    ids = model_df[ID_COL].values
    X = model_df[feature_cols]
    y = model_df[TARGET].values

    X_train, X_temp, y_train, y_temp, id_train, id_temp = train_test_split(
        X, y, ids, test_size=0.30, stratify=y, random_state=42
    )
    X_val, X_test, y_val, y_test, id_val, id_test = train_test_split(
        X_temp, y_temp, id_temp, test_size=0.50, stratify=y_temp, random_state=42
    )

    # ---- encode categoricals -------------------------------------------
    onehot = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    onehot.fit(X_train[cat_nominal])
    ohe_names = onehot.get_feature_names_out(cat_nominal).tolist()

    ordinal = OrdinalEncoder(
        categories=[ORDINAL_COLS[c] for c in cat_ordinal],
        handle_unknown="use_encoded_value", unknown_value=-1,
    )
    ordinal.fit(X_train[cat_ordinal])

    def encode(Xpart: pd.DataFrame) -> pd.DataFrame:
        num = Xpart[numeric_cols].reset_index(drop=True)
        ohe = pd.DataFrame(
            onehot.transform(Xpart[cat_nominal]), columns=ohe_names
        ).reset_index(drop=True)
        ordv = pd.DataFrame(
            ordinal.transform(Xpart[cat_ordinal]), columns=cat_ordinal
        ).reset_index(drop=True)
        return pd.concat([num, ordv, ohe], axis=1)

    Xtr_enc = encode(X_train)
    Xval_enc = encode(X_val)
    Xte_enc = encode(X_test)
    all_feature_names = Xtr_enc.columns.tolist()

    # ---- impute (fit on train only) -------------------------------------
    imputer = KNNImputer(n_neighbors=7)
    Xtr_imp = pd.DataFrame(imputer.fit_transform(Xtr_enc), columns=all_feature_names)
    Xval_imp = pd.DataFrame(imputer.transform(Xval_enc), columns=all_feature_names)
    Xte_imp = pd.DataFrame(imputer.transform(Xte_enc), columns=all_feature_names)

    # ---- scale (fit on train only) ---------------------------------------
    scaler = StandardScaler()
    Xtr_scaled = pd.DataFrame(scaler.fit_transform(Xtr_imp), columns=all_feature_names)
    Xval_scaled = pd.DataFrame(scaler.transform(Xval_imp), columns=all_feature_names)
    Xte_scaled = pd.DataFrame(scaler.transform(Xte_imp), columns=all_feature_names)

    def finalize(Xs, y_arr, id_arr, split_name):
        out = Xs.copy()
        out.insert(0, ID_COL, id_arr)
        out[TARGET] = y_arr
        out.to_csv(os.path.join(PROCESSED_DIR, f"{split_name}.csv"), index=False)
        return out

    finalize(Xtr_scaled, y_train, id_train, "train")
    finalize(Xval_scaled, y_val, id_val, "val")
    finalize(Xte_scaled, y_test, id_test, "test")

    # also save a human-readable (unscaled, engineered) full table for the
    # "dataset annotation" tab and for the doctor-side patient browser
    df.to_csv(os.path.join(PROCESSED_DIR, "patients_engineered_full.csv"), index=False)

    # ---- AFTER statistics ------------------------------------------------
    after_missing_train = {
        col: round(float(Xtr_enc[col].isna().mean()), 4)
        for col in all_feature_names if Xtr_enc[col].isna().mean() > 0
    }
    after = {
        "n_train": int(len(Xtr_scaled)), "n_val": int(len(Xval_scaled)), "n_test": int(len(Xte_scaled)),
        "n_features_after_encoding": len(all_feature_names),
        "missingness_pct_after_imputation": after_missing_train,  # should be ~empty
        "numeric_summary_scaled_train": numeric_summary(Xtr_scaled, numeric_cols),
        "target_prevalence_train": round(float(y_train.mean()), 4),
        "target_prevalence_val": round(float(y_val.mean()), 4),
        "target_prevalence_test": round(float(y_test.mean()), 4),
    }

    # correlation of each numeric baseline feature with target (train split,
    # pre-scaling values) -> useful "what drives risk" chart pre-modelling
    corr = {}
    tmp = Xtr_imp[numeric_cols].copy()
    tmp[TARGET] = y_train
    corr_series = tmp.corr(numeric_only=True)[TARGET].drop(TARGET).sort_values(
        key=lambda s: s.abs(), ascending=False
    )
    corr = {k: round(float(v), 3) for k, v in corr_series.items()}

    summary = {
        "target": TARGET,
        "before": before,
        "after": after,
        "feature_target_correlation_train": corr,
        "feature_names": all_feature_names,
        "categorical_nominal": cat_nominal,
        "categorical_ordinal": cat_ordinal,
        "numeric_features": numeric_cols,
        "preprocessing_steps": [
            "Feature engineering: age bands, BMI category, polypharmacy flag, "
            "CKD-stage flag, multimorbidity flag, low-MMSE flag, recurrent-falls flag "
            "(age_band / bmi_category kept for display only, see below)",
            "Excluded post-baseline / leakage column: follow_up_frailty_index",
            "Excluded from model matrix (display-only): age_band, bmi_category, "
            "frailty_index_baseline, fried_frailty_status_baseline, municipality "
            "— each is either a deterministic aggregate of other included features "
            "or (municipality) unrelated to outcome; keeping them caused unstable, "
            "sign-flipping coefficients without improving test ROC-AUC",
            "Stratified 70/15/15 train/val/test split (fit transformers on train only)",
            "One-hot encoding: sex (only remaining nominal categorical)",
            "KNN imputation (k=7) for missing labs/tests, fit on train only",
            "Standardization (z-score) of all numeric features, fit on train only",
        ],
    }

    with open(os.path.join(ARTIFACTS_DIR, "preprocessing_summary.json"), "w") as f:
        json.dump(summary, f, indent=2)

    with open(os.path.join(PROCESSED_DIR, "feature_names.json"), "w") as f:
        json.dump({
            "all_feature_names": all_feature_names,
            "numeric_cols": numeric_cols,
            "cat_nominal": cat_nominal,
            "cat_ordinal": cat_ordinal,
            "ohe_names": ohe_names,
        }, f, indent=2)

    joblib.dump({
        "onehot": onehot, "ordinal": ordinal, "imputer": imputer, "scaler": scaler,
        "feature_cols_raw": feature_cols, "cat_nominal": cat_nominal,
        "cat_ordinal": cat_ordinal, "numeric_cols": numeric_cols,
        "all_feature_names": all_feature_names,
    }, os.path.join(ARTIFACTS_DIR, "preprocessor.joblib"))

    print("Preprocessing complete.")
    print(f"  train={len(Xtr_scaled)}  val={len(Xval_scaled)}  test={len(Xte_scaled)}")
    print(f"  features after encoding: {len(all_feature_names)}")
    print(f"  target prevalence: train={y_train.mean():.3f} val={y_val.mean():.3f} test={y_test.mean():.3f}")


if __name__ == "__main__":
    run()
