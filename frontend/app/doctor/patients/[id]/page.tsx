"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { getPatient, PatientDetail, ApiError } from "@/lib/api";
import RiskBadge from "@/components/RiskBadge";
import LoadingState, { ErrorState } from "@/components/LoadingState";

const FIELD_GROUPS: { title: string; fields: [string, string][] }[] = [
  {
    title: "Demographics",
    fields: [
      ["age", "Age"], ["sex", "Sex"], ["municipality", "Municipality"],
      ["education_years", "Education (years)"], ["lives_alone", "Lives alone"],
    ],
  },
  {
    title: "Fried frailty components",
    fields: [
      ["weight_loss_kg_last_year", "Weight loss (kg, 1y)"], ["exhaustion_score", "Exhaustion score"],
      ["grip_strength_kg", "Grip strength (kg)"], ["gait_speed_ms", "Gait speed (m/s)"],
      ["physical_activity_score", "Physical activity score"],
    ],
  },
  {
    title: "Function & cognition",
    fields: [
      ["timed_up_and_go_s", "Timed Up & Go (s)"], ["chair_stand_time_s", "Chair stand (s)"],
      ["falls_last_year", "Falls (last year)"], ["mmse_score", "MMSE score"],
      ["depression_screen_score", "Depression screen"],
    ],
  },
  {
    title: "Labs",
    fields: [
      ["hemoglobin_g_dl", "Haemoglobin (g/dL)"], ["crp_mg_l", "CRP (mg/L)"],
      ["albumin_g_l", "Albumin (g/L)"], ["vitamin_d_nmol_l", "Vitamin D (nmol/L)"],
      ["egfr_ml_min", "eGFR (mL/min)"], ["bmi", "BMI"],
    ],
  },
];

const COMORBIDITIES: [string, string][] = [
  ["hypertension", "Hypertension"], ["diabetes_t2", "Type 2 diabetes"],
  ["cvd_history", "Cardiovascular disease"], ["copd", "COPD"],
  ["osteoporosis", "Osteoporosis"], ["chronic_kidney_disease", "CKD"],
  ["cancer_history", "Cancer history"], ["arthritis", "Arthritis"],
  ["hearing_impairment", "Hearing impairment"], ["vision_impairment", "Vision impairment"],
];

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPatient(params.id)
      .then(setPatient)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load patient."));
  }, [params.id]);

  if (error) return <ErrorState message={error} />;
  if (!patient) return <LoadingState label="Loading patient record…" />;

  const chartData = patient.history
    .filter((h) => h.frailty_index !== null)
    .map((h) => ({ name: h.timepoint.includes("Baseline") ? "Baseline" : "Follow-up", value: h.frailty_index }));

  return (
    <div className="animate-fade-up">
      <Link href="/doctor" className="text-sm text-fjord-700/60 hover:text-fjord-900 mb-4 inline-flex items-center gap-1">
        ← Back to cohort
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4 mb-7">
        <div>
          <h1 className="text-2xl font-semibold text-fjord-950 tracking-tight mb-1">{patient.patient_id}</h1>
          <p className="text-sm text-fjord-700/65">
            {patient.age}-year-old {patient.sex.toLowerCase()}, {patient.municipality} ·{" "}
            {patient.fried_frailty_status_baseline} (Fried phenotype)
          </p>
        </div>
        <RiskBadge probability={patient.predicted_risk_probability ?? 0} size="lg" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white rounded-xl2 border border-fjord-100 shadow-card p-6">
          <h2 className="text-sm font-semibold text-fjord-900 mb-4">Frailty index trajectory</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e3d6" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#1a3b63aa" }} axisLine={{ stroke: "#e8e3d6" }} />
              <YAxis domain={[0, 1]} tick={{ fontSize: 12, fill: "#1a3b63aa" }} axisLine={{ stroke: "#e8e3d6" }} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: "1px solid #d7e6f6", fontSize: 13 }}
                formatter={(v: number) => [v.toFixed(3), "Frailty index"]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#2f70b8"
                strokeWidth={2.5}
                dot={{ r: 5, fill: "#2f70b8" }}
                animationDuration={900}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl2 border border-fjord-100 shadow-card p-6">
          <h2 className="text-sm font-semibold text-fjord-900 mb-4">Comorbidities</h2>
          <div className="flex flex-wrap gap-2">
            {COMORBIDITIES.map(([key, label]) => {
              const present = Number(patient[key]) === 1;
              return (
                <span
                  key={key}
                  className={`text-xs px-2.5 py-1 rounded-full border ${
                    present
                      ? "bg-fjord-50 border-fjord-200 text-fjord-700 font-medium"
                      : "bg-sand-50 border-sand-200 text-fjord-700/35 line-through"
                  }`}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {FIELD_GROUPS.map((group, gi) => (
        <div
          key={group.title}
          className="bg-white rounded-xl2 border border-fjord-100 shadow-card p-6 mb-5 animate-fade-up"
          style={{ animationDelay: `${gi * 60}ms` }}
        >
          <h2 className="text-sm font-semibold text-fjord-900 mb-4">{group.title}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {group.fields.map(([key, label]) => (
              <div key={key}>
                <div className="text-[11px] uppercase tracking-wide text-fjord-700/50 mb-0.5">{label}</div>
                <div className="text-sm font-medium text-fjord-900">
                  {patient[key] === null || patient[key] === undefined ? "—" : String(patient[key])}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="bg-fjord-950 text-white rounded-xl2 p-6">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
            <InfoIcon />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-1">Want to explore &ldquo;what if&rdquo;?</h3>
            <p className="text-xs text-white/60 mb-3">
              Run this patient&apos;s profile (or a modified version of it)
              through the live prediction tool to see how changing a
              parameter shifts projected risk.
            </p>
            <Link
              href="/doctor/predict"
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-white/10 hover:bg-white/15 rounded-lg px-3 py-1.5 transition-colors"
            >
              Open live prediction →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
    </svg>
  );
}
