"use client";

import { useState } from "react";
import { predictRisk, PredictionResult, ApiError } from "@/lib/api";
import { riskTier } from "@/components/RiskBadge";

const DEFAULTS = {
  age: 78,
  sex: "Female" as "Female" | "Male",
  education_years: 11,
  lives_alone: 1,
  municipality: "Trondheim",
  weight_loss_kg_last_year: 1.5,
  exhaustion_score: 0.3,
  grip_strength_kg: 20,
  gait_speed_ms: 0.8,
  physical_activity_score: 160,
  timed_up_and_go_s: 11,
  chair_stand_time_s: 14,
  falls_last_year: 0,
  mmse_score: 27,
  depression_screen_score: 3,
  hypertension: 0,
  diabetes_t2: 0,
  cvd_history: 0,
  copd: 0,
  osteoporosis: 0,
  chronic_kidney_disease: 0,
  cancer_history: 0,
  arthritis: 0,
  hearing_impairment: 0,
  vision_impairment: 0,
  comorbidity_count: 1,
  polypharmacy_n_meds: 2,
  hemoglobin_g_dl: 13.2,
  crp_mg_l: 2.0,
  albumin_g_l: 41,
  vitamin_d_nmol_l: 55,
  egfr_ml_min: 75,
  bmi: 25,
  fried_frailty_status_baseline: "Pre-frail" as "Robust" | "Pre-frail" | "Frail",
};

type FormState = typeof DEFAULTS;

const NUMERIC_FIELDS: { key: keyof FormState; label: string; unit?: string; min: number; max: number; step: number }[] = [
  { key: "age", label: "Age", unit: "years", min: 65, max: 100, step: 1 },
  { key: "education_years", label: "Education", unit: "years", min: 0, max: 20, step: 1 },
  { key: "weight_loss_kg_last_year", label: "Weight loss (1y)", unit: "kg", min: -2, max: 10, step: 0.5 },
  { key: "exhaustion_score", label: "Exhaustion score", unit: "0–1", min: 0, max: 1, step: 0.05 },
  { key: "grip_strength_kg", label: "Grip strength", unit: "kg", min: 5, max: 50, step: 1 },
  { key: "gait_speed_ms", label: "Gait speed", unit: "m/s", min: 0.2, max: 1.6, step: 0.05 },
  { key: "physical_activity_score", label: "Physical activity", unit: "score", min: 0, max: 400, step: 10 },
  { key: "timed_up_and_go_s", label: "Timed Up & Go", unit: "s", min: 4, max: 35, step: 0.5 },
  { key: "chair_stand_time_s", label: "Chair stand", unit: "s", min: 6, max: 60, step: 1 },
  { key: "falls_last_year", label: "Falls (last year)", unit: "count", min: 0, max: 10, step: 1 },
  { key: "mmse_score", label: "MMSE score", unit: "/30", min: 0, max: 30, step: 1 },
  { key: "depression_screen_score", label: "Depression screen", unit: "/15", min: 0, max: 15, step: 1 },
  { key: "comorbidity_count", label: "Comorbidity count", unit: "count", min: 0, max: 10, step: 1 },
  { key: "polypharmacy_n_meds", label: "Medications", unit: "count", min: 0, max: 20, step: 1 },
  { key: "hemoglobin_g_dl", label: "Haemoglobin", unit: "g/dL", min: 8, max: 18, step: 0.1 },
  { key: "crp_mg_l", label: "CRP", unit: "mg/L", min: 0, max: 90, step: 0.5 },
  { key: "albumin_g_l", label: "Albumin", unit: "g/L", min: 25, max: 50, step: 0.5 },
  { key: "vitamin_d_nmol_l", label: "Vitamin D", unit: "nmol/L", min: 10, max: 140, step: 1 },
  { key: "egfr_ml_min", label: "eGFR", unit: "mL/min", min: 10, max: 120, step: 1 },
  { key: "bmi", label: "BMI", unit: "kg/m²", min: 15, max: 42, step: 0.1 },
];

const BOOLEAN_FIELDS: { key: keyof FormState; label: string }[] = [
  { key: "lives_alone", label: "Lives alone" },
  { key: "hypertension", label: "Hypertension" },
  { key: "diabetes_t2", label: "Type 2 diabetes" },
  { key: "cvd_history", label: "Cardiovascular disease" },
  { key: "copd", label: "COPD" },
  { key: "osteoporosis", label: "Osteoporosis" },
  { key: "chronic_kidney_disease", label: "Chronic kidney disease" },
  { key: "cancer_history", label: "Cancer history" },
  { key: "arthritis", label: "Arthritis" },
  { key: "hearing_impairment", label: "Hearing impairment" },
  { key: "vision_impairment", label: "Vision impairment" },
];

export default function PredictPage() {
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function runPrediction() {
    setLoading(true);
    setError(null);
    try {
      const res = await predictRisk(form);
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Prediction failed.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-7">
        <h1 className="text-2xl font-semibold text-fjord-950 tracking-tight mb-1">
          Live Risk Prediction
        </h1>
        <p className="text-sm text-fjord-700/65 max-w-2xl">
          Enter parameters for a real or hypothetical patient to get an
          instant, model-generated 4-year frailty-progression risk score with
          a ranked explanation of the main drivers.
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white rounded-xl2 border border-fjord-100 shadow-card p-6">
          <div className="grid sm:grid-cols-2 gap-5 mb-6">
            <div>
              <Label>Sex</Label>
              <div className="flex gap-2">
                {(["Female", "Male"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setField("sex", s)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      form.sex === s
                        ? "bg-fjord-600 border-fjord-600 text-white"
                        : "bg-white border-fjord-200 text-fjord-700/75"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Fried frailty status</Label>
              <select
                value={form.fried_frailty_status_baseline}
                onChange={(e) => setField("fried_frailty_status_baseline", e.target.value as FormState["fried_frailty_status_baseline"])}
                className="w-full rounded-lg border border-fjord-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fjord-300"
              >
                <option>Robust</option>
                <option>Pre-frail</option>
                <option>Frail</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5 mb-6">
            {NUMERIC_FIELDS.map((f) => (
              <div key={f.key}>
                <div className="flex items-baseline justify-between mb-1">
                  <Label>{f.label}</Label>
                  <span className="text-xs text-fjord-700/50 tabular-nums">
                    {form[f.key]} {f.unit}
                  </span>
                </div>
                <input
                  type="range"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={form[f.key] as number}
                  onChange={(e) => setField(f.key, Number(e.target.value) as FormState[typeof f.key])}
                  className="w-full accent-fjord-600"
                />
              </div>
            ))}
          </div>

          <Label>Comorbidities / impairments</Label>
          <div className="flex flex-wrap gap-2 mt-2 mb-6">
            {BOOLEAN_FIELDS.map((f) => {
              const active = Number(form[f.key]) === 1;
              return (
                <button
                  key={f.key}
                  onClick={() => setField(f.key, (active ? 0 : 1) as FormState[typeof f.key])}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                    active
                      ? "bg-fjord-600 border-fjord-600 text-white"
                      : "bg-white border-fjord-200 text-fjord-700/70 hover:border-fjord-300"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={runPrediction}
            disabled={loading}
            className="w-full rounded-lg bg-fjord-600 hover:bg-fjord-700 disabled:opacity-60 text-white text-sm font-semibold py-3 transition-colors shadow-card"
          >
            {loading ? "Running model…" : "Run prediction"}
          </button>
        </div>

        <div className="lg:col-span-2">
          <div className="sticky top-24">
            {error && (
              <div className="rounded-xl2 border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 mb-4">
                {error}
              </div>
            )}
            {!result && !error && (
              <div className="rounded-xl2 border border-dashed border-fjord-200 bg-white/60 p-10 text-center text-sm text-fjord-700/50">
                Adjust parameters and run the model to see a live risk
                estimate here.
              </div>
            )}
            {result && <ResultPanel result={result} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-fjord-700/70">{children}</label>;
}

function ResultPanel({ result }: { result: PredictionResult }) {
  const tier = riskTier(result.risk_probability);
  const color = tier === "high" ? "#cc4b37" : tier === "moderate" ? "#d99a1f" : "#2f9e5b";
  const circumference = 2 * Math.PI * 54;
  const offset = circumference * (1 - result.risk_probability);

  return (
    <div className="bg-white rounded-xl2 border border-fjord-100 shadow-card p-6 animate-fade-up">
      <h2 className="text-sm font-semibold text-fjord-900 mb-5">Predicted risk</h2>

      <div className="flex items-center justify-center mb-6">
        <div className="relative h-36 w-36">
          <svg viewBox="0 0 120 120" className="h-36 w-36 -rotate-90">
            <circle cx="60" cy="60" r="54" fill="none" stroke="#e8e3d6" strokeWidth="10" />
            <circle
              cx="60" cy="60" r="54" fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 1s cubic-bezier(.4,0,.2,1), stroke 0.4s" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold tabular-nums" style={{ color }}>
              {result.risk_percent}%
            </span>
            <span className="text-[11px] text-fjord-700/50">4y risk</span>
          </div>
        </div>
      </div>

      <div className="text-center mb-6">
        <span
          className="inline-block px-3 py-1 rounded-full text-xs font-semibold"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          {result.risk_label}
        </span>
        <p className="text-xs text-fjord-700/50 mt-2">
          Decision threshold: {(result.decision_threshold * 100).toFixed(0)}% · Model: {result.model_used}
        </p>
      </div>

      <h3 className="text-xs font-semibold text-fjord-700/70 uppercase tracking-wide mb-3">
        Top contributing factors
      </h3>
      <div className="space-y-2.5">
        {result.top_contributing_factors.map((f, i) => {
          const max = Math.max(...result.top_contributing_factors.map((x) => Math.abs(x.contribution)));
          const width = (Math.abs(f.contribution) / max) * 100;
          const up = f.direction === "increases risk";
          return (
            <div key={f.feature} className="animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-fjord-900/80 font-medium">{f.label}</span>
                <span className={up ? "text-rose-600" : "text-emerald-600"}>
                  {up ? "↑" : "↓"} {Math.abs(f.contribution).toFixed(2)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-sand-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${up ? "bg-rose-400" : "bg-emerald-400"}`}
                  style={{ width: `${width}%`, transition: "width 0.7s ease" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
