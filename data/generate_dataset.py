"""
Synthetic cohort generator modeled on the HUNT Study's variable structure.

This does NOT use real HUNT data (which is access-controlled by the HUNT
Research Centre / REK approval). It generates a *structurally realistic*
elderly cohort so the rest of the pipeline (preprocessing, modelling,
explainability, dashboard) can be demonstrated end-to-end, and swapped for
the real HUNT extract later with the same column contract.

Modelled domains (mirroring HUNT4 70+ / geriatric sub-studies):
  - Demographics & socioeconomics
  - Fried frailty phenotype components (used to derive a frailty label)
  - Physical performance (grip strength, gait speed, TUG, chair stands)
  - Comorbidities (CCI-style conditions)
  - Cognition (MMSE-like score), mental health (depression screen)
  - Lab values (Hb, CRP, albumin, vitamin D, creatinine/eGFR)
  - Medications count (polypharmacy), falls history, living situation
  - A longitudinal follow-up (HUNT4 -> HUNT5 style, ~4 years) producing the
    prediction target: clinically meaningful frailty progression / adverse
    outcome at follow-up.

Output: data/raw/patients_raw.csv  (one row per participant, baseline +
follow-up outcome columns), plus data/raw/data_dictionary.json describing
every column (used to drive the "dataset annotation" admin page).
"""
from __future__ import annotations

import json
import os
import numpy as np
import pandas as pd

RNG_SEED = 42
N_PATIENTS = 6000
OUT_DIR = os.path.join(os.path.dirname(__file__), "raw")
os.makedirs(OUT_DIR, exist_ok=True)

rng = np.random.default_rng(RNG_SEED)


def clip(arr, lo, hi):
    return np.clip(arr, lo, hi)


def generate():
    n = N_PATIENTS
    ids = [f"HUNT-SYN-{i:05d}" for i in range(1, n + 1)]

    # ---- Demographics -----------------------------------------------
    age = clip(rng.normal(74, 7.5, n), 65, 95).round(0)
    sex = rng.choice(["Female", "Male"], size=n, p=[0.54, 0.46])
    education_years = clip(
        rng.normal(np.where(age > 80, 10, 12), 3.2, n), 6, 20
    ).round(0)
    lives_alone = rng.binomial(1, clip(0.18 + (age - 65) * 0.012, 0.1, 0.65, ))
    municipality = rng.choice(
        ["Trondheim", "Levanger", "Steinkjer", "Stjordal", "Verdal",
         "Namsos", "Melhus", "Orkland"],
        size=n,
    )

    # underlying latent frailty propensity drives almost everything else
    latent_frailty = clip(
        rng.normal(0, 1, n)
        + (age - 74) * 0.045
        + (education_years < 10) * 0.25
        + lives_alone * 0.15,
        -3, 3,
    )

    # ---- Fried frailty phenotype components --------------------------
    # 1) unintentional weight loss (kg lost in last year)
    weight_loss_kg = clip(rng.normal(0.5 + latent_frailty * 1.1, 1.8, n), -3, 12)
    weight_loss_flag = (weight_loss_kg >= 4.5).astype(int)

    # 2) exhaustion (self-reported, CES-D style items collapsed to 0-1)
    exhaustion_score = clip(rng.normal(0.3 + latent_frailty * 0.18, 0.18, n), 0, 1)
    exhaustion_flag = (exhaustion_score >= 0.55).astype(int)

    # 3) grip strength (kg) - sex specific, lower = frail
    grip_base = np.where(sex == "Male", 34, 21)
    grip_strength_kg = clip(
        grip_base - (age - 65) * 0.28 - latent_frailty * 4.2 + rng.normal(0, 3.2, n),
        5, 55,
    )
    grip_cutoff = np.where(sex == "Male", 26, 16)
    weakness_flag = (grip_strength_kg < grip_cutoff).astype(int)

    # 4) gait speed (m/s)
    gait_speed_ms = clip(
        1.05 - (age - 65) * 0.0095 - latent_frailty * 0.14 + rng.normal(0, 0.11, n),
        0.2, 1.6,
    )
    slowness_flag = (gait_speed_ms < 0.6).astype(int)

    # 5) low physical activity (kcal/week proxy, PASE-like 0-400)
    physical_activity_score = clip(
        240 - (age - 65) * 2.6 - latent_frailty * 42 + rng.normal(0, 35, n), 0, 400
    )
    low_activity_flag = (physical_activity_score < 90).astype(int)

    fried_components = (
        weight_loss_flag + exhaustion_flag + weakness_flag
        + slowness_flag + low_activity_flag
    )
    frailty_status_baseline = pd.cut(
        fried_components, bins=[-1, 0, 2, 5],
        labels=["Robust", "Pre-frail", "Frail"],
    ).astype(str)

    # ---- Additional physical performance ------------------------------
    timed_up_and_go_s = clip(
        8.5 + (age - 65) * 0.11 + latent_frailty * 1.6 + rng.normal(0, 1.4, n), 4, 35
    )
    chair_stand_time_s = clip(
        11 + (age - 65) * 0.13 + latent_frailty * 1.8 + rng.normal(0, 2.1, n), 6, 60
    )
    falls_last_year = rng.poisson(clip(0.25 + latent_frailty * 0.35, 0, 3))

    # ---- Cognition & mental health -------------------------------------
    mmse_score = clip(
        28 - (age - 65) * 0.06 - latent_frailty * 1.5 + rng.normal(0, 1.6, n), 10, 30
    ).round(0)
    depression_screen_score = clip(
        3 + latent_frailty * 2.1 + rng.normal(0, 1.6, n), 0, 15
    ).round(0)  # GDS-15 style

    # ---- Comorbidities (Charlson-style binary flags) --------------------
    def comorbid(base_p, extra=0.0):
        p = clip(base_p + extra * latent_frailty.clip(min=0), 0.01, 0.9)
        return rng.binomial(1, p)

    hypertension = comorbid(0.45, 0.05)
    diabetes_t2 = comorbid(0.16, 0.05)
    cvd_history = comorbid(0.14, 0.08)       # prior MI / stroke
    copd = comorbid(0.09, 0.06)
    osteoporosis = comorbid(0.13, 0.05)
    chronic_kidney_disease = comorbid(0.08, 0.07)
    cancer_history = comorbid(0.1, 0.03)
    arthritis = comorbid(0.32, 0.04)
    hearing_impairment = comorbid(0.28, 0.03)
    vision_impairment = comorbid(0.17, 0.03)

    comorbidity_count = (
        hypertension + diabetes_t2 + cvd_history + copd + osteoporosis
        + chronic_kidney_disease + cancer_history + arthritis
    )

    polypharmacy_n_meds = clip(
        rng.poisson(clip(2.2 + comorbidity_count * 0.9 + latent_frailty * 0.6, 0.3, 14)),
        0, 18,
    )

    # ---- Labs -------------------------------------------------------
    hemoglobin_g_dl = clip(
        np.where(sex == "Male", 14.3, 13.2) - latent_frailty * 0.45 + rng.normal(0, 0.9, n),
        8, 18,
    )
    crp_mg_l = clip(np.exp(rng.normal(0.6 + latent_frailty * 0.35, 0.8, n)), 0.1, 90)
    albumin_g_l = clip(42 - latent_frailty * 1.6 + rng.normal(0, 2.4, n), 25, 50)
    vitamin_d_nmol_l = clip(58 - latent_frailty * 6 + rng.normal(0, 16, n), 10, 140)
    egfr_ml_min = clip(
        85 - (age - 65) * 0.7 - latent_frailty * 4.5 + rng.normal(0, 10, n), 10, 120
    )
    bmi = clip(26.5 - latent_frailty * 0.6 + rng.normal(0, 3.4, n), 15, 42)

    # ---- Baseline frailty index (continuous, 0-1, HUNT/Rockwood-style) --
    deficits = np.vstack([
        weight_loss_flag, exhaustion_flag, weakness_flag, slowness_flag,
        low_activity_flag, (falls_last_year > 0).astype(int),
        (mmse_score < 24).astype(int), (depression_screen_score >= 5).astype(int),
        hypertension, diabetes_t2, cvd_history, copd, osteoporosis,
        chronic_kidney_disease, cancer_history, arthritis,
        hearing_impairment, vision_impairment,
        (polypharmacy_n_meds >= 5).astype(int),
        (hemoglobin_g_dl < 12).astype(int), (crp_mg_l > 5).astype(int),
        (albumin_g_l < 35).astype(int), (vitamin_d_nmol_l < 30).astype(int),
        (egfr_ml_min < 60).astype(int), (bmi < 20).astype(int),
        lives_alone,
    ])
    frailty_index = deficits.mean(axis=0)

    # ---- 4-year follow-up outcome (prediction TARGET) --------------------
    # Probability of clinically meaningful frailty progression / adverse
    # outcome (death, institutionalisation, severe frailty) at follow-up.
    logit = (
        -3.05
        + 6.8 * frailty_index
        + 0.065 * (age - 74)
        + 0.70 * (frailty_status_baseline == "Frail").astype(int)
        + 0.35 * (falls_last_year >= 2).astype(int)
        + 0.25 * (comorbidity_count >= 4).astype(int)
        + 0.20 * lives_alone
        - 0.15 * (physical_activity_score > 200).astype(int)
        + rng.normal(0, 0.38, n)
    )
    prob_adverse_outcome = 1 / (1 + np.exp(-logit))
    future_frailty_risk = rng.binomial(1, clip(prob_adverse_outcome, 0.01, 0.97))

    follow_up_frailty_index = clip(
        frailty_index + 0.06 * future_frailty_risk
        + rng.normal(0.01, 0.025, n), 0, 1
    )

    df = pd.DataFrame({
        "patient_id": ids,
        "age": age.astype(int),
        "sex": sex,
        "education_years": education_years.astype(int),
        "lives_alone": lives_alone,
        "municipality": municipality,
        "weight_loss_kg_last_year": weight_loss_kg.round(1),
        "exhaustion_score": exhaustion_score.round(2),
        "grip_strength_kg": grip_strength_kg.round(1),
        "gait_speed_ms": gait_speed_ms.round(2),
        "physical_activity_score": physical_activity_score.round(0),
        "timed_up_and_go_s": timed_up_and_go_s.round(1),
        "chair_stand_time_s": chair_stand_time_s.round(1),
        "falls_last_year": falls_last_year,
        "mmse_score": mmse_score.astype(int),
        "depression_screen_score": depression_screen_score.astype(int),
        "hypertension": hypertension,
        "diabetes_t2": diabetes_t2,
        "cvd_history": cvd_history,
        "copd": copd,
        "osteoporosis": osteoporosis,
        "chronic_kidney_disease": chronic_kidney_disease,
        "cancer_history": cancer_history,
        "arthritis": arthritis,
        "hearing_impairment": hearing_impairment,
        "vision_impairment": vision_impairment,
        "comorbidity_count": comorbidity_count,
        "polypharmacy_n_meds": polypharmacy_n_meds,
        "hemoglobin_g_dl": hemoglobin_g_dl.round(1),
        "crp_mg_l": crp_mg_l.round(1),
        "albumin_g_l": albumin_g_l.round(1),
        "vitamin_d_nmol_l": vitamin_d_nmol_l.round(0),
        "egfr_ml_min": egfr_ml_min.round(0),
        "bmi": bmi.round(1),
        "fried_frailty_status_baseline": frailty_status_baseline,
        "frailty_index_baseline": frailty_index.round(3),
        "follow_up_frailty_index": follow_up_frailty_index.round(3),
        "future_frailty_risk": future_frailty_risk,  # TARGET (4y adverse outcome)
    })

    # ---- inject realistic missingness (MAR-ish, not MCAR) ----------------
    def inject_missing(col, base_rate, worse_if_old=True):
        p = np.full(n, base_rate)
        if worse_if_old:
            p = clip(p + (age > 85) * 0.08, 0, 0.6)
        mask = rng.binomial(1, p).astype(bool)
        df.loc[mask, col] = np.nan

    for col, rate in [
        ("vitamin_d_nmol_l", 0.12), ("crp_mg_l", 0.07), ("albumin_g_l", 0.09),
        ("mmse_score", 0.05), ("depression_screen_score", 0.06),
        ("education_years", 0.03), ("gait_speed_ms", 0.04),
        ("grip_strength_kg", 0.03), ("egfr_ml_min", 0.08),
    ]:
        inject_missing(col, rate)

    return df


def build_data_dictionary() -> dict:
    return {
        "dataset_name": "HUNT-structured synthetic frailty cohort (demo)",
        "note": (
            "Synthetic data generated to mirror the structure of HUNT's "
            "geriatric/70+ sub-study variables. Not real HUNT data; real "
            "HUNT access requires REK/HUNT Research Centre approval."
        ),
        "n_participants": N_PATIENTS,
        "target_variable": "future_frailty_risk",
        "target_description": (
            "Binary outcome: clinically meaningful frailty progression / "
            "adverse outcome (severe frailty, institutionalisation-level "
            "decline, or death proxy) within a ~4-year synthetic follow-up, "
            "analogous to a HUNT4->HUNT5 linkage."
        ),
        "columns": {
            "patient_id": "Unique synthetic participant identifier",
            "age": "Age in years at baseline (65-95)",
            "sex": "Biological sex (Female/Male)",
            "education_years": "Years of completed education",
            "lives_alone": "1 = lives alone, 0 = lives with others",
            "municipality": "Synthetic municipality in the HUNT (Trøndelag) catchment area",
            "weight_loss_kg_last_year": "Self-reported unintentional weight loss, kg (Fried component)",
            "exhaustion_score": "Self-reported exhaustion, 0-1 scale (Fried component)",
            "grip_strength_kg": "Dominant-hand grip strength, kg (Fried component)",
            "gait_speed_ms": "Usual gait speed, m/s, 4m walk test (Fried component)",
            "physical_activity_score": "PASE-like physical activity score, 0-400 (Fried component)",
            "timed_up_and_go_s": "Timed Up & Go test, seconds",
            "chair_stand_time_s": "5x chair stand test, seconds",
            "falls_last_year": "Number of falls in the past 12 months",
            "mmse_score": "Mini-Mental State Examination score, 0-30",
            "depression_screen_score": "Geriatric Depression Scale (GDS-15)-style score, 0-15",
            "hypertension": "Diagnosed hypertension (0/1)",
            "diabetes_t2": "Diagnosed type 2 diabetes (0/1)",
            "cvd_history": "History of cardiovascular disease / stroke (0/1)",
            "copd": "Chronic obstructive pulmonary disease (0/1)",
            "osteoporosis": "Diagnosed osteoporosis (0/1)",
            "chronic_kidney_disease": "Chronic kidney disease (0/1)",
            "cancer_history": "History of cancer diagnosis (0/1)",
            "arthritis": "Diagnosed arthritis (0/1)",
            "hearing_impairment": "Self-reported hearing impairment (0/1)",
            "vision_impairment": "Self-reported vision impairment (0/1)",
            "comorbidity_count": "Count of the 8 comorbidity flags above",
            "polypharmacy_n_meds": "Number of regular medications",
            "hemoglobin_g_dl": "Haemoglobin, g/dL",
            "crp_mg_l": "C-reactive protein, mg/L",
            "albumin_g_l": "Serum albumin, g/L",
            "vitamin_d_nmol_l": "25-OH vitamin D, nmol/L",
            "egfr_ml_min": "Estimated glomerular filtration rate, mL/min",
            "bmi": "Body mass index, kg/m^2",
            "fried_frailty_status_baseline": "Fried phenotype category at baseline: Robust/Pre-frail/Frail",
            "frailty_index_baseline": "Continuous deficit-accumulation frailty index, 0-1, at baseline",
            "follow_up_frailty_index": "Frailty index at ~4y synthetic follow-up",
            "future_frailty_risk": "TARGET: 1 = adverse frailty outcome by follow-up, 0 = stable/robust",
        },
    }


if __name__ == "__main__":
    df = generate()
    out_csv = os.path.join(OUT_DIR, "patients_raw.csv")
    df.to_csv(out_csv, index=False)

    with open(os.path.join(OUT_DIR, "data_dictionary.json"), "w") as f:
        json.dump(build_data_dictionary(), f, indent=2)

    print(f"Wrote {len(df)} rows -> {out_csv}")
    print(f"Target prevalence (future_frailty_risk=1): {df['future_frailty_risk'].mean():.3f}")
    print(f"Missingness by column (top 10):")
    print(df.isna().mean().sort_values(ascending=False).head(10))
