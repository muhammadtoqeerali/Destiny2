"""
Model training & comparison for the frailty-progression risk model.

Design choices (worth saying out loud in the interview):
  - Primary ranking metric is Average Precision (PR-AUC), not accuracy,
    because the target is imbalanced (~9% positive, 4y adverse outcome).
    ROC-AUC is still reported since clinicians know it.
  - Model selection happens on the VALIDATION split; the TEST split is
    touched exactly once, at the end, for the chosen model only -> an
    honest, non-leaked performance estimate.
  - Two models are always kept: the single BEST model (by val PR-AUC,
    used for the risk score shown to doctors) and a LOGISTIC REGRESSION
    model (always trained, used as a transparent, coefficient-based
    explanation even when a non-linear model wins on performance).
  - class_weight='balanced' / sample_weight is used throughout so the
    minority (high-risk) class isn't ignored.
  - SHAP is used for explanations when available on the machine running
    this script (pip install shap); otherwise permutation importance
    (always available, scikit-learn-native) is used as the global
    explanation and the logistic-regression decomposition as the local
    (per-patient) explanation. Both paths are wired into the backend.

Outputs:
  models/best_model.joblib
  models/logistic_model.joblib
  data/artifacts/model_comparison.json   (CV, val, test metrics; curves)
  data/artifacts/global_feature_importance.json
"""
from __future__ import annotations

import json
import os
import time
import numpy as np
import pandas as pd
import joblib

from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.metrics import (
    roc_auc_score, average_precision_score, f1_score, precision_score,
    recall_score, accuracy_score, roc_curve, precision_recall_curve,
    confusion_matrix, brier_score_loss,
)
from sklearn.inspection import permutation_importance
from sklearn.utils.class_weight import compute_sample_weight

try:
    import xgboost as xgb
    HAS_XGB = True
except ImportError:
    HAS_XGB = False

try:
    import shap  # noqa: F401
    HAS_SHAP = True
except ImportError:
    HAS_SHAP = False

HERE = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
PROCESSED_DIR = os.path.join(REPO_ROOT, "data", "processed")
ARTIFACTS_DIR = os.path.join(REPO_ROOT, "data", "artifacts")
MODELS_DIR = os.path.join(REPO_ROOT, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

TARGET = "future_frailty_risk"
ID_COL = "patient_id"


def load_split(name):
    df = pd.read_csv(os.path.join(PROCESSED_DIR, f"{name}.csv"))
    y = df[TARGET].values
    X = df.drop(columns=[TARGET, ID_COL])
    return X, y, df[ID_COL].values


def save_patient_risk_scores(best_model, best_thr):
    """Score every patient (train+val+test) with the final model so the
    doctor dashboard can show a model-derived risk score, not the
    retrospective ground-truth label."""
    frames = []
    for name in ("train", "val", "test"):
        df = pd.read_csv(os.path.join(PROCESSED_DIR, f"{name}.csv"))
        df["_split"] = name
        frames.append(df)
    full = pd.concat(frames, ignore_index=True)
    X_full = full.drop(columns=[TARGET, ID_COL, "_split"])
    proba = best_model.predict_proba(X_full)[:, 1]
    out = pd.DataFrame({
        "patient_id": full[ID_COL],
        "split": full["_split"],
        "true_future_frailty_risk": full[TARGET],
        "predicted_risk_probability": proba.round(4),
        "predicted_risk_label": np.where(proba >= best_thr, "High risk", "Low/stable risk"),
    })
    out.to_csv(os.path.join(ARTIFACTS_DIR, "patient_risk_scores.csv"), index=False)
    print(f"Saved risk scores for {len(out)} patients -> patient_risk_scores.csv")


def build_models(y_train):
    sw = compute_sample_weight("balanced", y_train)
    models = {
        "LogisticRegression": LogisticRegression(
            max_iter=3000, class_weight="balanced", C=0.8, random_state=42
        ),
        "KNN": KNeighborsClassifier(n_neighbors=15, weights="distance"),
        "RandomForest": RandomForestClassifier(
            n_estimators=400, max_depth=10, min_samples_leaf=3,
            class_weight="balanced", random_state=42, n_jobs=-1,
        ),
        "HistGradientBoosting": HistGradientBoostingClassifier(
            max_iter=350, learning_rate=0.05, max_depth=4,
            class_weight="balanced", random_state=42,
        ),
        "SVM-RBF": SVC(
            kernel="rbf", C=2.0, gamma="scale", probability=True,
            class_weight="balanced", random_state=42,
        ),
    }
    if HAS_XGB:
        pos = (y_train == 1).sum()
        neg = (y_train == 0).sum()
        models["XGBoost"] = xgb.XGBClassifier(
            n_estimators=400, max_depth=4, learning_rate=0.05,
            subsample=0.9, colsample_bytree=0.9,
            scale_pos_weight=neg / max(pos, 1),
            eval_metric="logloss", random_state=42, n_jobs=-1,
        )
    return models, sw


def evaluate(y_true, proba, threshold):
    pred = (proba >= threshold).astype(int)
    return {
        "roc_auc": round(float(roc_auc_score(y_true, proba)), 4),
        "pr_auc": round(float(average_precision_score(y_true, proba)), 4),
        "accuracy": round(float(accuracy_score(y_true, pred)), 4),
        "precision": round(float(precision_score(y_true, pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_true, pred, zero_division=0)), 4),
        "brier_score": round(float(brier_score_loss(y_true, proba)), 4),
        "threshold_used": round(float(threshold), 4),
    }


def best_threshold_youden(y_true, proba):
    fpr, tpr, thr = roc_curve(y_true, proba)
    j = tpr - fpr
    return float(thr[np.argmax(j)])


def curve_points(y_true, proba, n=60):
    fpr, tpr, _ = roc_curve(y_true, proba)
    idx = np.linspace(0, len(fpr) - 1, min(n, len(fpr))).astype(int)
    roc = [{"fpr": round(float(fpr[i]), 4), "tpr": round(float(tpr[i]), 4)} for i in idx]

    prec, rec, _ = precision_recall_curve(y_true, proba)
    idx2 = np.linspace(0, len(prec) - 1, min(n, len(prec))).astype(int)
    pr = [{"recall": round(float(rec[i]), 4), "precision": round(float(prec[i]), 4)} for i in idx2]
    return roc, pr


def run():
    X_train, y_train, _ = load_split("train")
    X_val, y_val, _ = load_split("val")
    X_test, y_test, _ = load_split("test")
    feature_names = X_train.columns.tolist()

    models, sample_weight = build_models(y_train)

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scoring = ["roc_auc", "average_precision", "f1", "precision", "recall", "accuracy"]

    comparison = {}
    fitted = {}
    roc_curves, pr_curves = {}, {}

    for name, model in models.items():
        t0 = time.time()
        # 5-fold CV on train for robustness (fit_params only where supported)
        fit_params = {}
        if name in ("HistGradientBoosting",) or (HAS_XGB and name == "XGBoost"):
            pass  # class_weight / scale_pos_weight already set on estimator
        cvres = cross_validate(
            model, X_train, y_train, cv=cv, scoring=scoring,
            n_jobs=1, return_train_score=False,
        )
        cv_summary = {
            f"cv_{m}": {
                "mean": round(float(np.mean(cvres[f"test_{m}"])), 4),
                "std": round(float(np.std(cvres[f"test_{m}"])), 4),
            }
            for m in scoring
        }

        # fit on full train, pick threshold on val, score val
        model.fit(X_train, y_train)
        val_proba = model.predict_proba(X_val)[:, 1]
        thr = best_threshold_youden(y_val, val_proba)
        val_metrics = evaluate(y_val, val_proba, thr)
        roc_pts, pr_pts = curve_points(y_val, val_proba)

        comparison[name] = {
            "cv_train": cv_summary,
            "val": val_metrics,
            "train_seconds": round(time.time() - t0, 2),
        }
        fitted[name] = model
        roc_curves[name] = roc_pts
        pr_curves[name] = pr_pts
        print(f"[{name}] val ROC-AUC={val_metrics['roc_auc']}  PR-AUC={val_metrics['pr_auc']}  "
              f"({comparison[name]['train_seconds']}s)")

    # ---- pick best model by validation PR-AUC (robust to imbalance) ------
    best_name = max(comparison, key=lambda n: comparison[n]["val"]["pr_auc"])
    best_model = fitted[best_name]
    best_thr = comparison[best_name]["val"]["threshold_used"]

    # ---- final, single-touch evaluation on TEST for the chosen model ----
    test_proba = best_model.predict_proba(X_test)[:, 1]
    test_metrics = evaluate(y_test, test_proba, best_thr)
    cm = confusion_matrix(y_test, (test_proba >= best_thr).astype(int)).tolist()

    comparison[best_name]["test"] = test_metrics
    comparison[best_name]["test_confusion_matrix"] = {
        "labels": ["Low/stable risk", "High risk"], "matrix": cm,
    }

    # ---- global explainability: permutation importance (always) ---------
    perm = permutation_importance(
        best_model, X_val, y_val, scoring="average_precision",
        n_repeats=15, random_state=42, n_jobs=-1,
    )
    perm_importance = sorted(
        [
            {"feature": f, "importance_mean": round(float(m), 5), "importance_std": round(float(s), 5)}
            for f, m, s in zip(feature_names, perm.importances_mean, perm.importances_std)
        ],
        key=lambda d: -d["importance_mean"],
    )[:20]

    # ---- logistic regression: always-available transparent coefficients -
    logreg = fitted["LogisticRegression"]
    coefs = logreg.coef_[0]
    logreg_importance = sorted(
        [
            {"feature": f, "coefficient": round(float(c), 4)}
            for f, c in zip(feature_names, coefs)
        ],
        key=lambda d: -abs(d["coefficient"]),
    )[:20]

    # ---- optional real SHAP global importance if available ---------------
    shap_global = None
    if HAS_SHAP:
        try:
            import shap
            explainer = shap.TreeExplainer(best_model) if hasattr(best_model, "feature_importances_") \
                else shap.KernelExplainer(best_model.predict_proba, X_train.sample(min(100, len(X_train)), random_state=42))
            sv = explainer.shap_values(X_val.sample(min(300, len(X_val)), random_state=42))
            sv = sv[1] if isinstance(sv, list) else sv
            mean_abs = np.abs(sv).mean(axis=0)
            shap_global = sorted(
                [{"feature": f, "mean_abs_shap": round(float(v), 5)} for f, v in zip(feature_names, mean_abs)],
                key=lambda d: -d["mean_abs_shap"],
            )[:20]
        except Exception as e:  # pragma: no cover - best effort on unseen envs
            print(f"SHAP global importance skipped: {e}")
            shap_global = None

    # ---- save everything ---------------------------------------------------
    joblib.dump(best_model, os.path.join(MODELS_DIR, "best_model.joblib"))
    joblib.dump(logreg, os.path.join(MODELS_DIR, "logistic_model.joblib"))
    with open(os.path.join(MODELS_DIR, "model_meta.json"), "w") as f:
        json.dump({
            "best_model_name": best_name,
            "decision_threshold": best_thr,
            "feature_names": feature_names,
            "has_xgboost": HAS_XGB,
            "has_shap": HAS_SHAP,
        }, f, indent=2)

    out = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "ranking_metric": "pr_auc (validation)",
        "best_model": best_name,
        "decision_threshold": round(best_thr, 4),
        "models": comparison,
        "roc_curves_val": roc_curves,
        "pr_curves_val": pr_curves,
        "n_train": len(X_train), "n_val": len(X_val), "n_test": len(X_test),
        "positive_rate_train": round(float(y_train.mean()), 4),
    }
    with open(os.path.join(ARTIFACTS_DIR, "model_comparison.json"), "w") as f:
        json.dump(out, f, indent=2)

    with open(os.path.join(ARTIFACTS_DIR, "global_feature_importance.json"), "w") as f:
        json.dump({
            "best_model_name": best_name,
            "permutation_importance_val": perm_importance,
            "logistic_regression_coefficients": logreg_importance,
            "shap_global_importance_val": shap_global,
        }, f, indent=2)

    save_patient_risk_scores(best_model, best_thr)

    print("\n=== DONE ===")
    print(f"Best model: {best_name}  (decision threshold={best_thr:.3f})")
    print(f"Test metrics: {test_metrics}")
    print(f"xgboost available: {HAS_XGB}  |  shap available: {HAS_SHAP}")


if __name__ == "__main__":
    run()
