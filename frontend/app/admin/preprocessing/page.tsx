"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getPreprocessingSummary, PreprocessingSummary, ApiError } from "@/lib/api";
import StatCard from "@/components/StatCard";
import LoadingState, { ErrorState } from "@/components/LoadingState";

export default function PreprocessingPage() {
  const [data, setData] = useState<PreprocessingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPreprocessingSummary()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load preprocessing summary."));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState label="Loading preprocessing summary…" />;

  const beforeMissing = Object.entries(data.before.missingness_pct)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k, v]) => ({ name: k, before: Math.round(v * 1000) / 10 }));

  const afterCount = Object.keys(data.after.missingness_pct_after_imputation || {}).length;

  return (
    <div className="animate-fade-up space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-fjord-950 tracking-tight mb-1">Preprocessing</h1>
        <p className="text-sm text-fjord-700/65 max-w-3xl">
          Transparent before/after view of every transformation applied to
          the raw cohort before it reaches a model.
        </p>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <StatCard label="Train / Val / Test" value={`${data.after.n_train} / ${data.after.n_val} / ${data.after.n_test}`} />
        <StatCard label="Features after encoding" value={String(data.after.n_features_after_encoding)} accent="teal" delay={60} />
        <StatCard label="Missing after imputation" value={String(afterCount)} sub="columns still missing (target: 0)" accent={afterCount === 0 ? "teal" : "amber"} delay={120} />
        <StatCard label="Outcome prevalence (train)" value={`${(data.after.target_prevalence_train * 100).toFixed(1)}%`} delay={180} />
      </div>

      <div className="bg-white rounded-xl2 border border-fjord-100 shadow-card p-6">
        <h2 className="text-sm font-semibold text-fjord-900 mb-1">Missingness: before imputation</h2>
        <p className="text-xs text-fjord-700/55 mb-4">
          KNN imputation (k=7), fitted on the training split only, closes
          every one of these gaps — after imputation, 0 columns have
          missing values in any split.
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={beforeMissing} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e3d6" horizontal={false} />
            <XAxis type="number" unit="%" tick={{ fontSize: 11, fill: "#1a3b63aa" }} />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10, fill: "#1a3b63aa" }} />
            <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #d7e6f6", fontSize: 13 }} formatter={(v: number) => [`${v}%`, "Missing before"]} />
            <Bar dataKey="before" fill="#cc4b37" radius={[0, 4, 4, 0]} animationDuration={900} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl2 border border-fjord-100 shadow-card p-6">
          <h2 className="text-sm font-semibold text-fjord-900 mb-4">Pipeline steps applied</h2>
          <ol className="space-y-3">
            {data.preprocessing_steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-fjord-900/85 animate-fade-up" style={{ animationDelay: `${i * 70}ms` }}>
                <span className="h-5 w-5 rounded-full bg-teal-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="bg-white rounded-xl2 border border-fjord-100 shadow-card p-6">
          <h2 className="text-sm font-semibold text-fjord-900 mb-4">Design decisions worth flagging</h2>
          <div className="space-y-4 text-sm text-fjord-900/80 leading-relaxed">
            <DecisionNote
              title="No leakage across splits"
              body="The train/val/test split happens before any imputer or scaler is fit — every transformer is fit on train only, then applied to val/test."
            />
            <DecisionNote
              title="Composite indices excluded from modelling"
              body="The baseline frailty index and Fried status are deterministic aggregates of ~25 other features. Including them alongside their own components caused unstable, sign-flipping coefficients — removing them kept test ROC-AUC essentially unchanged (0.730 → 0.733) while making the per-patient explanation trustworthy."
            />
            <DecisionNote
              title="Geographic label excluded"
              body="Municipality carried no designed relationship to outcome. With ~4,200 training rows, its one-hot columns added noise that surfaced as a spurious 'top factor' for some patients — dropped from the model matrix, kept for dataset description only."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DecisionNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-l-2 border-teal-300 pl-4">
      <p className="font-medium text-fjord-900 text-sm">{title}</p>
      <p className="text-xs text-fjord-700/65 mt-0.5">{body}</p>
    </div>
  );
}
