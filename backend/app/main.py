from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import auth, dataset, preprocessing, models, patients, predict

app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Backend for the NTNU frailty digital-health demo platform: "
        "dataset annotation, preprocessing transparency, model comparison "
        "and explainability, patient browsing, and runtime risk prediction."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(dataset.router, prefix=settings.API_V1_PREFIX)
app.include_router(preprocessing.router, prefix=settings.API_V1_PREFIX)
app.include_router(models.router, prefix=settings.API_V1_PREFIX)
app.include_router(patients.router, prefix=settings.API_V1_PREFIX)
app.include_router(predict.router, prefix=settings.API_V1_PREFIX)


@app.get("/")
def root():
    return {"status": "ok", "service": settings.APP_NAME}


@app.get("/api/health")
def health():
    return {"status": "healthy"}
