const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

function adminHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("ntnu_admin_token");
  return token ? { "X-Admin-Token": token } : {};
}

// ---- auth ---------------------------------------------------------------
export function adminLogin(password: string) {
  return request<{ token: string }>("/auth/admin-login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

// ---- dataset --------------------------------------------------------------
export function getDatasetSummary() {
  return request<DatasetSummary>("/dataset/summary", { headers: adminHeaders() });
}
export function getDatasetAnnotation() {
  return request<DatasetAnnotation>("/dataset/annotation", { headers: adminHeaders() });
}
export function getDatasetSample(limit = 15) {
  return request<DatasetSample>(`/dataset/sample?limit=${limit}`, { headers: adminHeaders() });
}

// ---- preprocessing ----------------------------------------------------------
export function getPreprocessingSummary() {
  return request<PreprocessingSummary>("/preprocessing/summary", { headers: adminHeaders() });
}

// ---- models -----------------------------------------------------------------
export function getModelComparison() {
  return request<ModelComparison>("/models/comparison", { headers: adminHeaders() });
}
export function getFeatureImportance() {
  return request<FeatureImportance>("/models/feature-importance", { headers: adminHeaders() });
}

// ---- patients (doctor side, no auth) ------------------------------------------
export function listPatients(params: { search?: string; risk?: string; limit?: number; offset?: number } = {}) {
  const q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.risk) q.set("risk", params.risk);
  q.set("limit", String(params.limit ?? 50));
  q.set("offset", String(params.offset ?? 0));
  return request<PatientListResponse>(`/patients?${q.toString()}`);
}
export function getPatient(id: string) {
  return request<PatientDetail>(`/patients/${encodeURIComponent(id)}`);
}

// ---- predict --------------------------------------------------------------
export function predictRisk(payload: Record<string, unknown>) {
  return request<PredictionResult>("/predict", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---- types ------------------------------------------------------------------
export interface DatasetSummary {
  n_rows: number;
  n_columns: number;
  target_prevalence: number;
  missingness_pct: Record<string, number>;
  numeric_summary: Record<string, { mean: number; std: number; min: number; p25: number; median: number; p75: number; max: number }>;
  fried_status_counts: Record<string, number>;
  feature_target_correlation: Record<string, number>;
}
export interface DatasetAnnotation {
  dataset_name: string;
  note: string;
  n_participants: number;
  target_variable: string;
  target_description: string;
  columns: Record<string, string>;
}
export interface DatasetSample {
  columns: string[];
  rows: Record<string, string | number>[];
}
export interface PreprocessingSummary {
  target: string;
  before: DatasetSummary & { n_rows: number };
  after: {
    n_train: number; n_val: number; n_test: number;
    n_features_after_encoding: number;
    missingness_pct_after_imputation: Record<string, number>;
    numeric_summary_scaled_train: Record<string, any>;
    target_prevalence_train: number; target_prevalence_val: number; target_prevalence_test: number;
  };
  feature_target_correlation_train: Record<string, number>;
  preprocessing_steps: string[];
}
export interface ModelMetrics {
  roc_auc: number; pr_auc: number; accuracy: number; precision: number;
  recall: number; f1: number; brier_score: number; threshold_used: number;
}
export interface ModelComparison {
  generated_at: string;
  ranking_metric: string;
  best_model: string;
  decision_threshold: number;
  models: Record<string, {
    cv_train: Record<string, { mean: number; std: number }>;
    val: ModelMetrics;
    test?: ModelMetrics;
    test_confusion_matrix?: { labels: string[]; matrix: number[][] };
    train_seconds: number;
  }>;
  roc_curves_val: Record<string, { fpr: number; tpr: number }[]>;
  pr_curves_val: Record<string, { recall: number; precision: number }[]>;
  n_train: number; n_val: number; n_test: number;
  positive_rate_train: number;
}
export interface FeatureImportance {
  best_model_name: string;
  permutation_importance_val: { feature: string; importance_mean: number; importance_std: number }[];
  logistic_regression_coefficients: { feature: string; coefficient: number }[];
  shap_global_importance_val: { feature: string; mean_abs_shap: number }[] | null;
}
export interface PatientListItem {
  patient_id: string; age: number; sex: string; municipality: string;
  fried_frailty_status_baseline: string; frailty_index_baseline: number;
  comorbidity_count: number; falls_last_year: number;
  predicted_risk_probability: number; predicted_risk_label: string;
}
export interface PatientListResponse {
  total: number; limit: number; offset: number; patients: PatientListItem[];
}
export interface PatientDetail extends Record<string, any> {
  patient_id: string;
  history: { timepoint: string; frailty_index: number | null; fried_status: string | null }[];
}
export interface PredictionResult {
  risk_probability: number;
  risk_percent: number;
  risk_label: string;
  decision_threshold: number;
  model_used: string;
  top_contributing_factors: { feature: string; label: string; contribution: number; direction: string }[];
  explanation_method: string;
}
