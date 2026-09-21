from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
from pathlib import Path

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to your actual Vercel URL once deployed
    allow_methods=["GET"],
    allow_headers=["*"],
)

DATA_PATH = Path("output/report_data.json")


def load_data() -> dict:
    if not DATA_PATH.exists():
        raise HTTPException(status_code=500, detail="report_data.json not found")
    with open(DATA_PATH) as f:
        return json.load(f)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/results")
def get_all_results():
    """Every email, every field — the full dataset."""
    return load_data()


@app.get("/api/results/classification")
def get_classification_results():
    """Just category per email — lightweight, for a classification-only view."""
    data = load_data()
    return {
        eid: {"email_id": eid, "subject": e.get("subject"), "category": e.get("category")}
        for eid, e in data.items()
    }


@app.get("/api/results/comparison")
def get_comparison_results():
    """BL_COMPARISON emails only, with side-by-side SI/BL data and defect fields."""
    data = load_data()
    return {
        eid: e for eid, e in data.items()
        if e.get("category") == "BL_COMPARISON"
    }


@app.get("/api/results/needs-review")
def get_needs_review():
    """Only the escalated cases — useful for a dedicated 'flagged' tab."""
    data = load_data()
    return {
        eid: e for eid, e in data.items()
        if e.get("status") == "NEEDS_REVIEW"
    }


@app.get("/api/results/{email_id}")
def get_single_result(email_id: str):
    """One email's full detail — for a click-to-expand view."""
    data = load_data()
    if email_id not in data:
        raise HTTPException(status_code=404, detail=f"{email_id} not found")
    return data[email_id]