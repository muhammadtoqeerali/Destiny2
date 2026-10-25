"use client";

import { useEffect, useState, useCallback } from "react";
import { getModelComparison, predictRisk, ModelComparison, PredictionResult, ApiError } from "@/lib/api";
import LoadingState, { ErrorState } from "@/components/LoadingState";
import { riskTier } from "@/components/RiskBadge";

const BASE_PATIENT = {
  age: 76, sex: "Female" as const, education_years: 11, lives_alone: 0, municipality: "Trondheim",
  weight_loss_kg_last_year: 1, exhaustion_score: 0.25, grip_strength_kg: 22, gait_speed_ms: 0.85,
  physical_activity_score: 180, timed_up_and_go_s: 10, chair_stand_time_s: 13, falls_last_year: 0,
  mmse_score: 28, depression_screen_score: 2, hypertension: 0, diabetes_t2: 0, cvd_history: 0,
  copd: 0, osteoporosis: 0, chronic_kidney_disease: 0, cancer_history: 0, arthritis: 0,
  hearing_impairment: 0, vision_impairment: 0, comorbidity_count: 1, polypharmacy_n_meds: 2,
  hemoglobin_g_dl: 13.2, crp_mg_l: 1.8, albumin_g_l: 41, vitamin_d_nmol_l: 58, egfr_ml_min: 78, bmi: 25,
  fried_frailty_status_baseline: "Robust" as const,
};

export default function ResultsPage() {
  const [comparison, setComparison] = useState<ModelComparison | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getModelComparison()
      .then(setComparison)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load results."));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!comparison) return <LoadingState label="Loading final results…" />;

  const best = comparison.models[comparison.best_model];
  const cm = best.test_confusion_matrix;

  return (
    <div className="animate-fade-up space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-fjord-950 tracking-tight mb-1">Results</h1>
        <p className="text-sm text-fjord-700/65 max-w-3xl">
          What the pipeline achieved on held-out data, and a scenario tool
          to explore how changing parameters shifts projected risk.
        </p>
      </div>

      {cm && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl2 border border-fjord-100 shadow-card p-6">
            <h2 className="text-sm font-semibold text-fjord-900 mb-1">
              Test-set confusion matrix — {comparison.best_model}
            </h2>
            <p className="text-xs text-fjord-700/55 mb-5">
              At decision threshold {(comparison.decision_threshold * 100).toFixed(0)}%, on {comparison.n_test} held-out patients never seen during training or model selection.
            </p>
            <ConfusionMatrix labels={cm.labels} matrix={cm.matrix} />
          </div>

          <div className="bg-white rounded-xl2 border border-fjord-100 shadow-card p-6">
            <h2 className="text-sm font-semibold text-fjord-900 mb-4">What this means clinically</h2>
            <div className="space-y-3 text-sm text-fjord-900/80 leading-relaxed">
              <p>
                <strong className="text-fjord-950">Recall ({(best.test!.recall * 100).toFixed(0)}%)</strong> — of
                patients who actually progressed to an adverse frailty
                outcome, the model flagged this share in advance. In a
                screening context, high recall is prioritized so fewer
                at-risk patients are missed.
              </p>
              <p>
                <strong className="text-fjord-950">Precision ({(best.test!.precision * 100).toFixed(0)}%)</strong> —
                of patients flagged high-risk, this share went on to the
                adverse outcome. The remainder are false positives: worth a
                closer look clinically, but not a wasted flag given the
                stakes of missed frailty progression.
              </p>
              <p>
                <strong className="text-fjord-950">Brier score ({best.test!.brier_score.toFixed(3)})</strong> —
                measures how well-calibrated the predicted probabilities
                are (0 = perfect), relevant since the risk percentage is
                shown directly to clinicians, not just a binary flag.
              </p>
            </div>
          </div>
        </div>
      )}

      <ScenarioExplorer />
    </div>
  );
}

function ConfusionMatrix({ labels, matrix }: { labels: string[]; matrix: number[][] }) {
  const total = matrix.flat().reduce((a, b) => a + b, 0);
  const cells = [
    { label: "True negative", value: matrix[0][0], tone: "emerald" },
    { label: "False positive", value: matrix[0][1], tone: "amber" },
    { label: "False negative", value: matrix[1][0], tone: "rose" },
    { label: "True positive", value: matrix[1][1], tone: "fjord" },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        {cells.map((c) => (
          <div
            key={c.label}
            className={`rounded-xl border p-4 ${
              c.tone === "emerald" ? "bg-emerald-50 border-emerald-200" :
              c.tone === "amber" ? "bg-amber-50 border-amber-200" :
              c.tone === "rose" ? "bg-rose-50 border-rose-200" :
              "bg-fjord-50 border-fjord-200"
            }`}
          >
            <div className="text-2xl font-bold text-fjord-950 tabular-nums">{c.value}</div>
            <div className="text-xs text-fjord-700/60 mt-0.5">{c.label}</div>
            <div className="text-[11px] text-fjord-700/40 mt-0.5">{((c.value / total) * 100).toFixed(1)}% of test set</div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-fjord-700/45">
        Rows: actual ({labels[0]} / {labels[1]}) · Columns: predicted
      </p>
    </div>
  );
}

function ScenarioExplorer() {
  const [scenarioA, setScenarioA] = useState<Scenario>(BASE_PATIENT);
  const [scenarioB, setScenarioB] = useState<Scenario>({ ...BASE_PATIENT, age: 84, lives_alone: 1, falls_last_year: 2, gait_speed_ms: 0.5, grip_strength_kg: 14, comorbidity_count: 4, fried_frailty_status_baseline: "Frail" as const });
  const [resultA, setResultA] = useState<PredictionResult | null>(null);
  const [resultB, setResultB] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([predictRisk(scenarioA), predictRisk(scenarioB)]);
      setResultA(a);
      setResultB(b);
    } catch {
      /* surfaced inline per-card is unnecessary for a demo tool */
    } finally {
      setLoading(false);
    }
  }, [scenarioA, scenarioB]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-white rounded-xl2 border border-fjord-100 shadow-card p-6">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-fjord-900 mb-1">Scenario comparison</h2>
          <p className="text-xs text-fjord-700/55 max-w-xl">
            Adjust two profiles side by side to see how parameters change
            projected risk — e.g. a &ldquo;robust&rdquo; vs. &ldquo;high
            burden&rdquo; patient.
          </p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-fjord-600 hover:bg-fjord-700 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 transition-colors"
        >
          {loading ? "Recomputing…" : "Recompute both"}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <ScenarioCard title="Scenario A" accent="fjord" scenario={scenarioA} setScenario={setScenarioA} result={resultA} />
        <ScenarioCard title="Scenario B" accent="rose" scenario={scenarioB} setScenario={setScenarioB} result={resultB} />
      </div>
    </div>
  );
}

type Scenario = Omit<
  typeof BASE_PATIENT,
  "fried_frailty_status_baseline"
> & {
  fried_frailty_status_baseline:
    | "Robust"
    | "Pre-frail"
    | "Frail";
};

function ScenarioCard({
  title, accent, scenario, setScenario, result,
}: {
  title: string;
  accent: "fjord" | "rose";
  scenario: Scenario;
  setScenario: (s: Scenario) => void;
  result: PredictionResult | null;
}) {
  const sliders: { key: keyof Scenario; label: string; min: number; max: number; step: number }[] = [
    { key: "age", label: "Age", min: 65, max: 100, step: 1 },
    { key: "gait_speed_ms", label: "Gait speed (m/s)", min: 0.2, max: 1.6, step: 0.05 },
    { key: "grip_strength_kg", label: "Grip strength (kg)", min: 5, max: 50, step: 1 },
    { key: "falls_last_year", label: "Falls (last year)", min: 0, max: 6, step: 1 },
    { key: "comorbidity_count", label: "Comorbidities", min: 0, max: 8, step: 1 },
  ];

  const tier = result ? riskTier(result.risk_probability) : "low";
  const color = tier === "high" ? "#cc4b37" : tier === "moderate" ? "#d99a1f" : "#2f9e5b";

  return (
    <div className={`rounded-xl border p-5 ${accent === "fjord" ? "border-fjord-200 bg-fjord-50/40" : "border-rose-200 bg-rose-50/30"}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-fjord-900">{title}</h3>
        {result && (
          <span className="text-lg font-bold tabular-nums" style={{ color }}>
            {result.risk_percent}%
          </span>
        )}
      </div>

      <div className="space-y-3 mb-4">
        {sliders.map((s) => (
          <div key={s.key}>
            <div className="flex justify-between text-[11px] text-fjord-700/60 mb-0.5">
              <span>{s.label}</span>
              <span className="tabular-nums">{scenario[s.key]}</span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={scenario[s.key] as number}
              onChange={(e) => setScenario({ ...scenario, [s.key]: Number(e.target.value) })}
              className="w-full accent-fjord-600 h-1"
            />
          </div>
        ))}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-fjord-700/60">Lives alone</span>
          <button
            onClick={() => setScenario({ ...scenario, lives_alone: scenario.lives_alone ? 0 : 1 })}
            className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${
              scenario.lives_alone ? "bg-fjord-600 border-fjord-600 text-white" : "bg-white border-fjord-200 text-fjord-700/70"
            }`}
          >
            {scenario.lives_alone ? "Yes" : "No"}
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-1.5 pt-3 border-t border-fjord-100">
          {result.top_contributing_factors.slice(0, 3).map((f) => (
            <div key={f.feature} className="flex justify-between text-[11px]">
              <span className="text-fjord-900/70">{f.label}</span>
              <span className={f.direction === "increases risk" ? "text-rose-600" : "text-emerald-600"}>
                {f.direction === "increases risk" ? "↑" : "↓"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
