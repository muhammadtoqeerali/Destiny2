from __future__ import annotations
from typing import Optional, Literal
from pydantic import BaseModel, Field


class PatientPredictInput(BaseModel):
    """Baseline geriatric-assessment inputs a clinician can enter at the
    point of care. Lab/test fields are optional — anything omitted is
    imputed the same way missing values were handled during training."""

    age: int = Field(..., ge=65, le=100, description="Age in years")
    sex: Literal["Female", "Male"]
    education_years: Optional[float] = Field(None, ge=0, le=25)
    lives_alone: int = Field(..., ge=0, le=1)
    municipality: Optional[str] = "Trondheim"

    weight_loss_kg_last_year: Optional[float] = None
    exhaustion_score: Optional[float] = Field(None, ge=0, le=1)
    grip_strength_kg: Optional[float] = None
    gait_speed_ms: Optional[float] = None
    physical_activity_score: Optional[float] = None
    timed_up_and_go_s: Optional[float] = None
    chair_stand_time_s: Optional[float] = None
    falls_last_year: int = Field(0, ge=0, le=20)

    mmse_score: Optional[int] = Field(None, ge=0, le=30)
    depression_screen_score: Optional[int] = Field(None, ge=0, le=15)

    hypertension: int = Field(0, ge=0, le=1)
    diabetes_t2: int = Field(0, ge=0, le=1)
    cvd_history: int = Field(0, ge=0, le=1)
    copd: int = Field(0, ge=0, le=1)
    osteoporosis: int = Field(0, ge=0, le=1)
    chronic_kidney_disease: int = Field(0, ge=0, le=1)
    cancer_history: int = Field(0, ge=0, le=1)
    arthritis: int = Field(0, ge=0, le=1)
    hearing_impairment: int = Field(0, ge=0, le=1)
    vision_impairment: int = Field(0, ge=0, le=1)
    comorbidity_count: Optional[int] = Field(None, ge=0, le=10)
    polypharmacy_n_meds: Optional[int] = Field(None, ge=0, le=25)

    hemoglobin_g_dl: Optional[float] = None
    crp_mg_l: Optional[float] = None
    albumin_g_l: Optional[float] = None
    vitamin_d_nmol_l: Optional[float] = None
    egfr_ml_min: Optional[float] = None
    bmi: Optional[float] = None

    fried_frailty_status_baseline: Literal["Robust", "Pre-frail", "Frail"] = "Pre-frail"
    frailty_index_baseline: Optional[float] = Field(None, ge=0, le=1)

    class Config:
        json_schema_extra = {
            "example": {
                "age": 78, "sex": "Female", "education_years": 11, "lives_alone": 1,
                "municipality": "Trondheim", "weight_loss_kg_last_year": 2.5,
                "exhaustion_score": 0.4, "grip_strength_kg": 18.5, "gait_speed_ms": 0.75,
                "physical_activity_score": 140, "timed_up_and_go_s": 12.5,
                "chair_stand_time_s": 16.0, "falls_last_year": 1, "mmse_score": 26,
                "depression_screen_score": 4, "hypertension": 1, "diabetes_t2": 0,
                "cvd_history": 0, "copd": 0, "osteoporosis": 1,
                "chronic_kidney_disease": 0, "cancer_history": 0, "arthritis": 1,
                "hearing_impairment": 0, "vision_impairment": 0, "comorbidity_count": 2,
                "polypharmacy_n_meds": 4, "hemoglobin_g_dl": 12.8, "crp_mg_l": 2.1,
                "albumin_g_l": 39.0, "vitamin_d_nmol_l": 48, "egfr_ml_min": 68,
                "bmi": 24.5, "fried_frailty_status_baseline": "Pre-frail",
                "frailty_index_baseline": 0.18,
            }
        }


class AdminLoginRequest(BaseModel):
    password: str


class AdminLoginResponse(BaseModel):
    token: str
