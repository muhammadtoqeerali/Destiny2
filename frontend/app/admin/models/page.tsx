"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, Cell,
} from "recharts";
import { getModelComparison, getFeatureImportance, ModelComparison, FeatureImportance, ApiError } from "@/lib/api";
import LoadingState, { ErrorState } from "@/components/LoadingState";
import clsx from "clsx";

const MODEL_COLORS: Record<string, string> = {
  LogisticRegression: "#2f70b8",
  KNN: "#7ad6c4",
  RandomForest: "#228a78",
  HistGradientBoosting: "#d99a1f",
  "SVM-RBF": "#cc4b37",
  XGBoost: "#8b5cf6",
};

export default function ModelsPage() {
  const [comparison, setComparison] = useState<ModelComparison | null>(null);
  const [importance, setImportance] = useState<FeatureImportance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getModelComparison(), getFeatureImportance()])
      .then(([c, i]) => {
        setComparison(c);
        setImportance(i);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load model results."));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!comparison || !importance) return <LoadingState label="Loading model comparison…" />;

  const modelNames = Object.keys(comparison.models);
  const best = comparison.best_model;
  const bestTest = comparison.models[best]?.test;

  // merge ROC curves across models into one chart dataset keyed by fpr bucket
  const rocChartData = buildMergedCurve(comparison.roc_curves_val, "fpr", "tpr", modelNames);
  const prChartData = buildMergedCurve(comparison.pr_curves_val, "recall", "precision", modelNames);

  const permData = importance.permutation_importance_val.slice(0, 12).map((d) => ({
    name: d.feature, value: d.importance_mean,
  }));

  return (
    <div className="animate-fade-up space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-fjord-950 tracking-tight mb-1">Models</h1>
        <p className="text-sm text-fjord-700/65 max-w-3xl">
          {modelNames.length} candidate models were trained with 5-fold
          cross-validation, selected on validation PR-AUC (appropriate for
          the ~{(comparison.positive_rate_train * 100).toFixed(0)}% positive
          class imbalance), then evaluated once on a held-out test set.
        </p>
      </div>

      <div className="bg-white rounded-xl2 border border-fjord-100 shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-fjord-100 bg-sand-50/60 text-left text-xs uppercase tracking-wide text-fjord-700/55">
              <th className="px-5 py-3 font-medium">Model</th>
              <th className="px-5 py-3 font-medium">CV ROC-AUC</th>
              <th className="px-5 py-3 font-medium">Val ROC-AUC</th>
              <th className="px-5 py-3 font-medium">Val PR-AUC</th>
              <th className="px-5 py-3 font-medium">Val F1</th>
              <th className="px-5 py-3 font-medium">Train time</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {modelNames
              .sort((a, b) => comparison.models[b].val.pr_auc - comparison.models[a].val.pr_auc)
              .map((name) => {
                const m = comparison.models[name];
                const isBest = name === best;
                return (
                  <tr key={name} className={clsx("border-b border-fjord-50 last:border-0", isBest && "bg-teal-50/50")}>
                    <td className="px-5 py-3 font-medium text-fjord-900 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: MODEL_COLORS[name] || "#999" }} />
                      {name}
                    </td>
                    <td className="px-5 py-3 text-fjord-900/80 tabular-nums">
                      {m.cv_train.roc_auc.mean.toFixed(3)} ± {m.cv_train.roc_auc.std.toFixed(3)}
                    </td>
                    <td className="px-5 py-3 text-fjord-900/80 tabular-nums">{m.val.roc_auc.toFixed(3)}</td>
                    <td className="px-5 py-3 text-fjord-900/80 tabular-nums">{m.val.pr_auc.toFixed(3)}</td>
                    <td className="px-5 py-3 text-fjord-900/80 tabular-nums">{m.val.f1.toFixed(3)}</td>
                    <td className="px-5 py-3 text-fjord-900/60 tabular-nums">{m.train_seconds}s</td>
                    <td className="px-5 py-3">
                      {isBest && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-600 text-white">
                          BEST
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {bestTest && (
        <div className="bg-fjord-950 text-white rounded-xl2 p-6 grid sm:grid-cols-5 gap-5">
          <TestStat label="Test ROC-AUC" value={bestTest.roc_auc.toFixed(3)} />
          <TestStat label="Test PR-AUC" value={bestTest.pr_auc.toFixed(3)} />
          <TestStat label="Precision" value={bestTest.precision.toFixed(3)} />
          <TestStat label="Recall" value={bestTest.recall.toFixed(3)} />
          <TestStat label="F1" value={bestTest.f1.toFixed(3)} />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl2 border border-fjord-100 shadow-card p-6">
          <h2 className="text-sm font-semibold text-fjord-900 mb-4">ROC curves (validation)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={rocChartData} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e3d6" />
              <XAxis dataKey="x" type="number" domain={[0, 1]} tick={{ fontSize: 11, fill: "#1a3b63aa" }} label={{ value: "False positive rate", position: "insideBottom", offset: -4, fontSize: 11 }} />
              <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: "#1a3b63aa" }} label={{ value: "True positive rate", angle: -90, position: "insideLeft", fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #d7e6f6", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {modelNames.map((name) => (
                <Line key={name} type="monotone" dataKey={name} stroke={MODEL_COLORS[name] || "#999"} dot={false} strokeWidth={name === best ? 3 : 1.5} animationDuration={800} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl2 border border-fjord-100 shadow-card p-6">
          <h2 className="text-sm font-semibold text-fjord-900 mb-4">Precision-Recall curves (validation)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={prChartData} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e3d6" />
              <XAxis dataKey="x" type="number" domain={[0, 1]} tick={{ fontSize: 11, fill: "#1a3b63aa" }} label={{ value: "Recall", position: "insideBottom", offset: -4, fontSize: 11 }} />
              <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: "#1a3b63aa" }} label={{ value: "Precision", angle: -90, position: "insideLeft", fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #d7e6f6", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {modelNames.map((name) => (
                <Line key={name} type="monotone" dataKey={name} stroke={MODEL_COLORS[name] || "#999"} dot={false} strokeWidth={name === best ? 3 : 1.5} animationDuration={800} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl2 border border-fjord-100 shadow-card p-6">
        <h2 className="text-sm font-semibold text-fjord-900 mb-1">Global feature importance</h2>
        <p className="text-xs text-fjord-700/55 mb-4">
          Permutation importance (drop in validation PR-AUC when a feature
          is shuffled) for the best model, {importance.best_model_name}.
          {importance.shap_global_importance_val ? " SHAP values also available." : " Install the `shap` package for SHAP-based importance."}
        </p>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={permData} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e3d6" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#1a3b63aa" }} />
            <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 10, fill: "#1a3b63aa" }} />
            <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #d7e6f6", fontSize: 12 }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} animationDuration={900}>
              {permData.map((d, i) => (
                <Cell key={d.name} fill={`hsl(${207 - i * 8}, 55%, ${48 + i * 2}%)`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl2 border border-fjord-100 shadow-card p-6">
        <h2 className="text-sm font-semibold text-fjord-900 mb-1">Logistic regression coefficients</h2>
        <p className="text-xs text-fjord-700/55 mb-4">
          The always-trained transparent model — its coefficients power the
          per-patient explanation shown on the clinician side.
        </p>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
          {importance.logistic_regression_coefficients.slice(0, 16).map((c) => (
            <div key={c.feature} className="flex items-center justify-between border-b border-fjord-50 py-1.5">
              <span className="text-fjord-900/80 font-mono">{c.feature}</span>
              <span className={c.coefficient >= 0 ? "text-rose-600 font-medium" : "text-emerald-600 font-medium"}>
                {c.coefficient >= 0 ? "+" : ""}{c.coefficient.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TestStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-white/50 mb-1">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function buildMergedCurve(
  curves: Record<string, { [k: string]: number }[]>,
  xKey: string,
  yKey: string,
  modelNames: string[]
) {
  // sample a common set of x-points (0..1 step 0.05) and nearest-interpolate
  // each model's y so all series share one x-axis for a combined chart.
  const xs = Array.from({ length: 21 }, (_, i) => i / 20);
  return xs.map((x) => {
    const row: Record<string, number> = { x };
    modelNames.forEach((name) => {
      const pts = curves[name] || [];
      if (pts.length === 0) return;
      let nearest = pts[0];
      let bestDist = Math.abs((pts[0] as any)[xKey] - x);
      for (const p of pts) {
        const d = Math.abs((p as any)[xKey] - x);
        if (d < bestDist) {
          bestDist = d;
          nearest = p;
        }
      }
      row[name] = (nearest as any)[yKey];
    });
    return row;
  });
}
