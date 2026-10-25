"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDatasetSummary, getModelComparison, DatasetSummary, ModelComparison, ApiError } from "@/lib/api";
import StatCard from "@/components/StatCard";
import LoadingState, { ErrorState } from "@/components/LoadingState";

const STAGES = [
  { href: "/admin/dataset", title: "1 · Dataset", desc: "Annotation, distributions, missingness" },
  { href: "/admin/preprocessing", title: "2 · Preprocessing", desc: "Cleaning, encoding, before/after" },
  { href: "/admin/models", title: "3 · Models", desc: "Training, comparison, explainability" },
  { href: "/admin/results", title: "4 · Results", desc: "Final outcomes & scenario exploration" },
];

export default function AdminOverviewPage() {
  const [dataset, setDataset] = useState<DatasetSummary | null>(null);
  const [models, setModels] = useState<ModelComparison | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getDatasetSummary(), getModelComparison()])
      .then(([d, m]) => {
        setDataset(d);
        setModels(m);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load overview."));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!dataset || !models) return <LoadingState label="Loading pipeline overview…" />;

  const bestTest = models.models[models.best_model]?.test;

  return (
    <div className="animate-fade-up">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-fjord-950 tracking-tight mb-1">
          Pipeline Overview
        </h1>
        <p className="text-sm text-fjord-700/65 max-w-2xl">
          End-to-end summary of the frailty-prediction pipeline: from the
          HUNT-structured cohort to the deployed, explainable risk model.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Participants" value={dataset.n_rows.toLocaleString()} sub={`${dataset.n_columns} raw variables`} />
        <StatCard
          label="4y adverse-outcome rate"
          value={`${(dataset.target_prevalence * 100).toFixed(1)}%`}
          sub="baseline prevalence"
          accent="amber"
          delay={60}
        />
        <StatCard
          label="Best model"
          value={models.best_model}
          sub={`ranked by ${models.ranking_metric}`}
          accent="teal"
          delay={120}
        />
        <StatCard
          label="Test ROC-AUC"
          value={bestTest ? bestTest.roc_auc.toFixed(3) : "—"}
          sub={`PR-AUC ${bestTest?.pr_auc.toFixed(3) ?? "—"}`}
          delay={180}
        />
      </div>

      <h2 className="text-sm font-semibold text-fjord-900 mb-4">Pipeline stages</h2>
      <div className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <svg className="hidden lg:block absolute top-9 left-[12.5%] right-[12.5%] h-0.5 -z-0" preserveAspectRatio="none">
          <line x1="0" y1="0" x2="100%" y2="0" stroke="#b0cdee" strokeWidth="2" className="animate-dash-flow" />
        </svg>
        {STAGES.map((s, i) => (
          <Link
            key={s.href}
            href={s.href}
            className="relative z-10 bg-white rounded-xl2 border border-fjord-100 shadow-card hover:shadow-cardHover p-5 transition-shadow animate-fade-up"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <div className="h-8 w-8 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center mb-4">
              {i + 1}
            </div>
            <h3 className="text-sm font-semibold text-fjord-950 mb-1">{s.title.replace(/^\d+\s·\s/, "")}</h3>
            <p className="text-xs text-fjord-700/60 leading-relaxed">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
