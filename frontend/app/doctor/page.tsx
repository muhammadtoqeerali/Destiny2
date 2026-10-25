"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { listPatients, PatientListItem, ApiError } from "@/lib/api";
import RiskBadge from "@/components/RiskBadge";
import LoadingState, { ErrorState } from "@/components/LoadingState";
import StatCard from "@/components/StatCard";

export default function PatientListPage() {
  const [patients, setPatients] = useState<PatientListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listPatients({ search, risk: riskFilter, limit: 40 });
      setPatients(res.patients);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load patients.");
    } finally {
      setLoading(false);
    }
  }, [search, riskFilter]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const highRiskCount = patients?.filter((p) => p.predicted_risk_label === "High risk").length ?? 0;

  return (
    <div className="animate-fade-up">
      <div className="flex items-start justify-between gap-6 mb-7 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-fjord-950 tracking-tight mb-1">
            Patient Cohort
          </h1>
          <p className="text-sm text-fjord-700/65">
            HUNT-structured cohort of older adults — model-estimated 4-year
            frailty progression risk.
          </p>
        </div>
        <Link
          href="/doctor/predict"
          className="inline-flex items-center gap-2 rounded-lg bg-fjord-600 hover:bg-fjord-700 text-white text-sm font-medium px-4 py-2.5 transition-colors shadow-card"
        >
          + Live risk prediction
        </Link>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-7">
        <StatCard label="Cohort size" value={total ? total.toLocaleString() : "—"} />
        <StatCard
          label="Shown as high risk"
          value={String(highRiskCount)}
          sub="in current view"
          accent="rose"
          delay={60}
        />
        <StatCard label="Prediction horizon" value="~4 years" sub="synthetic follow-up" accent="teal" delay={120} />
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-fjord-700/35" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient ID or municipality…"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-fjord-200 text-sm outline-none focus:ring-2 focus:ring-fjord-300 focus:border-fjord-400 transition-shadow bg-white"
          />
        </div>
        {["High risk", "Low/stable risk"].map((r) => (
          <button
            key={r}
            onClick={() => setRiskFilter(riskFilter === r ? undefined : r)}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
              riskFilter === r
                ? "bg-fjord-600 border-fjord-600 text-white"
                : "bg-white border-fjord-200 text-fjord-700/75 hover:border-fjord-300"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {loading && <LoadingState label="Loading cohort…" />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && patients && (
        <div className="bg-white rounded-xl2 border border-fjord-100 shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fjord-100 bg-sand-50/60 text-left text-xs uppercase tracking-wide text-fjord-700/55">
                <th className="px-5 py-3 font-medium">Patient</th>
                <th className="px-5 py-3 font-medium">Age / Sex</th>
                <th className="px-5 py-3 font-medium">Municipality</th>
                <th className="px-5 py-3 font-medium">Fried status</th>
                <th className="px-5 py-3 font-medium">Comorbidities</th>
                <th className="px-5 py-3 font-medium">Falls (1y)</th>
                <th className="px-5 py-3 font-medium">Predicted risk</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p, i) => (
                <tr
                  key={p.patient_id}
                  className="border-b border-fjord-50 last:border-0 hover:bg-fjord-50/40 transition-colors animate-fade-up"
                  style={{ animationDelay: `${Math.min(i * 18, 300)}ms` }}
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/doctor/patients/${p.patient_id}`}
                      className="font-medium text-fjord-700 hover:text-fjord-900 hover:underline"
                    >
                      {p.patient_id}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-fjord-900/85">
                    {p.age} / {p.sex}
                  </td>
                  <td className="px-5 py-3 text-fjord-900/85">{p.municipality}</td>
                  <td className="px-5 py-3 text-fjord-900/85">{p.fried_frailty_status_baseline}</td>
                  <td className="px-5 py-3 text-fjord-900/85">{p.comorbidity_count}</td>
                  <td className="px-5 py-3 text-fjord-900/85">{p.falls_last_year}</td>
                  <td className="px-5 py-3">
                    <RiskBadge probability={p.predicted_risk_probability} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {patients.length === 0 && (
            <div className="py-14 text-center text-sm text-fjord-700/55">
              No patients match this filter.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}
