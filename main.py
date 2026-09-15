"""
FastAPI app: JSON API + serves the static frontend.
One service, one repo, one deploy target — matches how Render/Railway/Fly
expect a GitHub-connected web service to look.

Run locally:
    uvicorn app.main:app --reload
Then open http://127.0.0.1:8000
"""

from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.service import predict, PredictionError

app = FastAPI(title="CF Rating Predictor API")

# Loosely open CORS since this is a small public tool; tighten to your own
# frontend origin if you split frontend/backend into separate deployments.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).resolve().parent.parent / "docs"


@app.get("/api/predict")
def api_predict(
    handle: str = Query(..., description="Codeforces handle"),
    contest: int = Query(..., description="Contest ID"),
    rank: int | None = Query(None, description="Expected/final rank (optional)"),
):
    try:
        result = predict(handle, contest, rank)
    except PredictionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serve the frontend. Mounted last so /api/* routes above take priority.
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
