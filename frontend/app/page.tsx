import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-5xl w-full">
          <div className="text-center mb-14 animate-fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 text-teal-700 text-xs font-semibold tracking-wide uppercase mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse-ring" />
              Digital Health · Frailty Research Platform
            </div>
            <h1 className="text-4xl sm:text-5xl font-semibold text-fjord-950 tracking-tight mb-4">
              Frailty Insight
            </h1>
            <p className="text-fjord-700/80 text-lg max-w-2xl mx-auto leading-relaxed">
              A machine-learning pipeline for predicting frailty progression in
              older adults, built on a HUNT-structured cohort — from raw data
              to an explainable, clinic-ready risk score.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <Link
              href="/doctor"
              className="group relative overflow-hidden rounded-xl2 bg-white border border-fjord-100 shadow-card hover:shadow-cardHover transition-all duration-300 p-8 animate-fade-up"
              style={{ animationDelay: "80ms" }}
            >
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-fjord-50 group-hover:scale-110 transition-transform duration-500" />
              <div className="relative">
                <div className="h-12 w-12 rounded-xl bg-fjord-600 text-white flex items-center justify-center mb-5 shadow-card">
                  <StethoscopeIcon />
                </div>
                <h2 className="text-xl font-semibold text-fjord-950 mb-2">
                  Clinician View
                </h2>
                <p className="text-sm text-fjord-700/75 leading-relaxed mb-5">
                  Browse the patient cohort, review individual frailty
                  trajectories, and run live what-if risk predictions from
                  bedside parameters.
                </p>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-fjord-600 group-hover:gap-2.5 transition-all">
                  Open clinician dashboard <ArrowIcon />
                </span>
              </div>
            </Link>

            <Link
              href="/admin"
              className="group relative overflow-hidden rounded-xl2 bg-white border border-fjord-100 shadow-card hover:shadow-cardHover transition-all duration-300 p-8 animate-fade-up"
              style={{ animationDelay: "160ms" }}
            >
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-50 group-hover:scale-110 transition-transform duration-500" />
              <div className="relative">
                <div className="h-12 w-12 rounded-xl bg-teal-600 text-white flex items-center justify-center mb-5 shadow-card">
                  <GearIcon />
                </div>
                <h2 className="text-xl font-semibold text-fjord-950 mb-2">
                  Research &amp; Model Admin
                </h2>
                <p className="text-sm text-fjord-700/75 leading-relaxed mb-5">
                  Dataset annotation, preprocessing transparency, model
                  comparison and explainability — the full ML pipeline, laid
                  bare.
                </p>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 group-hover:gap-2.5 transition-all">
                  Open admin console <ArrowIcon />
                </span>
              </div>
            </Link>
          </div>

          <p className="text-center text-xs text-fjord-700/50 mt-12">
            Demo built on a synthetic, HUNT-structured cohort for methodology
            demonstration — not real HUNT Study data.
          </p>
        </div>
      </div>
    </main>
  );
}

function StethoscopeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4.5 3v6a4.5 4.5 0 0 0 9 0V3" strokeLinecap="round" />
      <path d="M9 15.5a5.5 5.5 0 0 0 11 0v-1.5" strokeLinecap="round" />
      <circle cx="20.5" cy="12" r="1.8" />
      <circle cx="4.5" cy="3" r="1.3" />
      <circle cx="13.5" cy="3" r="1.3" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3.2" />
      <path
        d="M19.4 13a7.97 7.97 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a8 8 0 0 0-1.7-1L14.9 3h-4l-.4 2.9a8 8 0 0 0-1.7 1l-2.5-1-2 3.5L6.4 11a8 8 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a8 8 0 0 0 1.7 1l.4 2.9h4l.4-2.9a8 8 0 0 0 1.7-1l2.5 1 2-3.5L19.4 13Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
