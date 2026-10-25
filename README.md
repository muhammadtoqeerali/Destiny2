# Frailty Insight — NTNU Digital Health Demo

A full ML pipeline + explainable clinical dashboard predicting **4-year
frailty progression risk** in older adults, built on a cohort structured
like NTNU's **HUNT Study**. Built as a skills demonstration for the
*Postdoctoral Fellow in Machine Learning and Digital Health Services for
Frail Older People* interview.

> **Important**: this uses a **synthetic** cohort generated to mirror
> HUNT's real variable structure (Fried frailty phenotype, comorbidities,
> physical performance, labs, longitudinal follow-up) — not real HUNT
> data, which is access-controlled by the HUNT Research Centre / REK. The
> whole pipeline is built so the synthetic generator can be swapped for a
> real HUNT extract with the same column contract (see
> `data/raw/data_dictionary.json`).

## What's in this repo

```
NTNU2/
├── data/
│   ├── generate_dataset.py      # synthetic HUNT-structured cohort generator
│   ├── preprocess.py            # cleaning, encoding, imputation, scaling, split
│   ├── raw/                     # generated raw CSV + data dictionary (JSON)
│   ├── processed/               # train/val/test splits + engineered full table
│   └── artifacts/               # preprocessing & model-comparison JSON for the dashboard
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app
│   │   ├── routers/             # auth, dataset, preprocessing, models, patients, predict
│   │   ├── ml/
│   │   │   ├── train.py         # trains & compares 5 models, saves artifacts
│   │   │   └── predict.py       # runtime single-patient inference + explanation
│   │   ├── core/                # config, admin-auth
│   │   └── schemas.py           # pydantic request/response models
│   └── requirements.txt
├── frontend/                    # Next.js 14 (App Router) + Tailwind + Recharts
│   └── app/
│       ├── doctor/              # clinician view: patient list, patient detail, live predict
│       └── admin/                # admin console: dataset, preprocessing, models, results
├── models/                      # trained model artifacts (best_model.joblib, etc.)
└── README.md                    # this file
```

## 1. Run the ML pipeline (on your workstation)

```bash
cd /mnt/hdd16T/ToqeerHomeBackup/toqeer/NTNU2

python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt

# 1. generate the synthetic HUNT-structured cohort
python data/generate_dataset.py

# 2. preprocess: feature engineering, encoding, KNN imputation, scaling, split
python data/preprocess.py

# 3. train & compare 5 models, save the best model + explainability artifacts
python backend/app/ml/train.py
```

This writes everything the dashboard needs into `data/raw/`,
`data/processed/`, `data/artifacts/`, and `models/`. Re-run anytime to
regenerate with a different random seed, more participants, or (once you
swap in real HUNT data) a real extract.

**If `xgboost` or `shap` aren't installed**, `train.py` degrades
gracefully — it uses `HistGradientBoostingClassifier` and permutation
importance instead, and still produces every artifact the dashboard
needs. Installing both (already in `requirements.txt`) gets you one more
candidate model and real SHAP values.

## 2. Run the backend

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

API docs at `http://localhost:8000/docs`. Set `ADMIN_PASSWORD` /
`ADMIN_TOKEN` env vars to change the demo admin login (defaults to
`admin123`).

## 3. Run the frontend

```bash
cd frontend
cp .env.local.example .env.local   # points at http://localhost:8000 by default
npm install
npm run dev
```

Open `http://localhost:3000`. Home page splits into:
- **Clinician view** (`/doctor`): patient cohort browser, per-patient
  frailty trajectory, and a **live "what-if" risk predictor** where a
  doctor enters parameters and gets an instant risk score + ranked
  explanation.
- **Admin console** (`/admin`, password `admin123`): dataset annotation
  with distributions/missingness, preprocessing before/after, model
  comparison (CV + val + test metrics, ROC/PR curves, feature
  importance), and a results/scenario-comparison page.

## 4. Push to GitHub

```bash
git add .
git commit -m "Frailty Insight: full ML pipeline + explainable dashboard"
git push -u origin main
```

(Remote `https://github.com/muhammadtoqeerali/Destiny2.git` is already
configured per your setup.)

## 5. Deploy the frontend to Vercel

Vercel hosts the **frontend only** — it doesn't run a persistent Python
process for the FastAPI backend. Two options:

- **Simplest for a demo**: keep the backend running on your workstation
  (or any always-on machine) and point Vercel's `NEXT_PUBLIC_API_URL`
  environment variable at a public URL for it (e.g. via a reverse proxy /
  tunnel, or a small cloud VM).
- **Cleanest for production**: deploy `backend/` separately to a Python
  host (Railway, Render, Fly.io, or a VM) and point Vercel at that URL.

In Vercel: *New Project → Import `Destiny2` → Root Directory: `frontend`
→ add env var `NEXT_PUBLIC_API_URL=https://your-backend-url` → Deploy*.
Also set `CORS_ORIGINS` on the backend to include your Vercel URL.

## Design decisions worth knowing for the interview

- **Target**: `future_frailty_risk` — a synthetic 4-year adverse frailty
  outcome (progression/institutionalisation-level decline), built from a
  logistic generative model over the Fried phenotype, comorbidities,
  falls, and living situation, with realistic noise and ~19% prevalence.
- **No leakage**: train/val/test split happens *before* any imputer or
  scaler is fit; all transformers are fit on train only.
- **Composite indices excluded from the model matrix.** The baseline
  frailty index and Fried status are deterministic aggregates of ~25
  other features. Including them alongside their components caused
  unstable, sign-flipping logistic-regression coefficients — removing
  them kept test ROC-AUC essentially unchanged while making the
  per-patient explanation trustworthy. (See `data/preprocess.py` comments
  for the full reasoning — this is a good thing to walk through live.)
- **Municipality excluded similarly**: it was generated with no designed
  relationship to outcome; keeping it in the model produced spurious
  "top factor" explanations driven by noise in a modest-sized training
  set.
- **Model selection on validation PR-AUC** (not accuracy), appropriate
  for the imbalanced target; **test set touched exactly once**, for the
  final chosen model.
- **Explainability has two tiers**: permutation importance + (if `shap`
  installed) SHAP values for global, dataset-level explanation on the
  admin side; an exact logistic-regression linear decomposition for
  per-patient explanation on the clinician side (always available, no
  extra dependency, and faithful rather than approximate for that
  model).
- **Admin auth is intentionally simple** (shared password, static
  token) to match the brief. Flagged in `backend/app/core/security.py`
  with what a production version would need instead.
