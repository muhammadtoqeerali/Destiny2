"use client";

import { useEffect, useState } from "react";
import { adminLogin, ApiError } from "@/lib/api";

const TOKEN_KEY = "ntnu_admin_token";

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem(TOKEN_KEY);
    setAuthed(!!token);
    setChecked(true);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { token } = await adminLogin(password);
      window.localStorage.setItem(TOKEN_KEY, token);
      setAuthed(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!checked) return null;

  if (!authed) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm bg-white rounded-xl2 border border-fjord-100 shadow-card p-8 animate-fade-up"
        >
          <div className="h-11 w-11 rounded-xl bg-teal-600 text-white flex items-center justify-center mb-5 shadow-card">
            <LockIcon />
          </div>
          <h1 className="text-lg font-semibold text-fjord-950 mb-1">Admin sign-in</h1>
          <p className="text-sm text-fjord-700/65 mb-6">
            Research &amp; model administration console.
          </p>

          <label className="block text-xs font-medium text-fjord-700/70 mb-1.5">
            Password
          </label>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-fjord-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-400 transition-shadow mb-4"
          />

          {error && <p className="text-xs text-rose-600 mb-4">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !password}
            className="w-full rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 transition-colors"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-[11px] text-fjord-700/40 mt-5 text-center">
            Demo credential: <code>admin123</code>
          </p>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" strokeLinecap="round" />
    </svg>
  );
}
