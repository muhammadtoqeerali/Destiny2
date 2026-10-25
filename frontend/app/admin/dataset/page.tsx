"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import { getDatasetSummary, getDatasetAnnotation, getDatasetSample, DatasetSummary, DatasetAnnotation, DatasetSample, ApiError } from "@/lib/api";
import StatCard from "@/components/StatCard";
import LoadingState, { ErrorState } from "@/components/LoadingState";

const FRIED_COLORS: Record<string, string> = { Robust: "#2f9e5b", "Pre-frail": "#d99a1f", Frail: "#cc4b37" };

export default function DatasetPage() {
  const [summary, setSummary] = useState<DatasetSummary | null>(null);
  const [annotation, setAnnotation] = useState<DatasetAnnotation | null>(null);
  const [sample, setSample] = useState<DatasetSample | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getDatasetSummary(), getDatasetAnnotation(), getDatasetSample(10)])
      .then(([s, a, sm]) => {
        setSummary(s);
        setAnnotation(a);
        setSample(sm);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load dataset info."));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!summary || !annotation || !sample) return <LoadingState label="Loading dataset annotation…" />;

  const missingData = Object.entries(summary.missingness_pct)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([k, v]) => ({ name: k, pct: Math.round(v * 1000) / 10 }));

  const friedData = Object.entries(summary.fried_status_counts).map(([name, value]) => ({ name, value }));

  const corrData = Object.entries(summary.feature_target_correlation)
    .slice(0, 12)
    .map(([k, v]) => ({ name: k, corr: v }));

  return (
    <div className="animate-fade-up space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-fjord-950 tracking-tight mb-1">Dataset</h1>
        <p className="text-sm text-fjord-700/65 max-w-3xl">{annotation.note}</p>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <StatCard label="Participants" value={annotation.n_participants.toLocaleString()} />
        <StatCard label="Raw variables" value={String(summary.n_columns)} delay={60} />
        <StatCard label="Target" value={annotation.target_variable} accent="teal" delay={120} />
        <StatCard label="Outcome prevalence" value={`${(summary.target_prevalence * 100).toFixed(1)}%`} accent="amber" delay={180} />
      </div>

      <div className="bg-fjord-50 border border-fjord-100 rounded-xl2 p-5">
        <h3 className="text-sm font-semibold text-fjord-900 mb-1">Target definition</h3>
        <p className="text-sm text-fjord-700/80 leading-relaxed">{annotation.target_description}</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl2 border border-fjord-100 shadow-card p-6">
          <h2 className="text-sm font-semibold text-fjord-900 mb-4">Baseline Fried frailty phenotype</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={friedData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} animationDuration={900}>
                {friedData.map((d) => (
                  <Cell key={d.name} fill={FRIED_COLORS[d.name] || "#999"} />
                ))}
              </Pie>
              <Legend verticalAlign="bottom" height={28} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #d7e6f6", fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl2 border border-fjord-100 shadow-card p-6">
          <h2 className="text-sm font-semibold text-fjord-900 mb-4">Missingness by variable (top 12)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={missingData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e3d6" horizontal={false} />
              <XAxis type="number" unit="%" tick={{ fontSize: 11, fill: "#1a3b63aa" }} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: "#1a3b63aa" }} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #d7e6f6", fontSize: 13 }} formatter={(v: number) => [`${v}%`, "Missing"]} />
              <Bar dataKey="pct" fill="#4f8dd1" radius={[0, 4, 4, 0]} animationDuration={900} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl2 border border-fjord-100 shadow-card p-6">
        <h2 className="text-sm font-semibold text-fjord-900 mb-1">Correlation with outcome (raw features)</h2>
        <p className="text-xs text-fjord-700/55 mb-4">
          Pearson correlation between each baseline numeric feature and the 4-year adverse outcome, computed on the training split.
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={corrData} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e3d6" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#1a3b63aa" }} angle={-35} textAnchor="end" height={80} interval={0} />
            <YAxis tick={{ fontSize: 11, fill: "#1a3b63aa" }} />
            <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #d7e6f6", fontSize: 13 }} />
            <Bar dataKey="corr" radius={[4, 4, 0, 0]} animationDuration={900}>
              {corrData.map((d) => (
                <Cell key={d.name} fill={d.corr >= 0 ? "#cc4b37" : "#2f9e5b"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl2 border border-fjord-100 shadow-card p-6">
        <h2 className="text-sm font-semibold text-fjord-900 mb-4">Sample rows</h2>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="text-left text-fjord-700/55 border-b border-fjord-100">
                {sample.columns.slice(0, 14).map((c) => (
                  <th key={c} className="px-3 py-2 font-medium whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sample.rows.map((row, i) => (
                <tr key={i} className="border-b border-fjord-50 last:border-0">
                  {sample.columns.slice(0, 14).map((c) => (
                    <td key={c} className="px-3 py-2 whitespace-nowrap text-fjord-900/80">{String(row[c])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl2 border border-fjord-100 shadow-card p-6">
        <h2 className="text-sm font-semibold text-fjord-900 mb-4">Full data dictionary</h2>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
          {Object.entries(annotation.columns).map(([col, desc]) => (
            <div key={col} className="text-xs border-b border-fjord-50 pb-2">
              <span className="font-mono font-medium text-fjord-800">{col}</span>
              <p className="text-fjord-700/60 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
