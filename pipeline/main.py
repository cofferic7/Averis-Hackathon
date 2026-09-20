import sys
import json
import os

sys.path.insert(0, "server")
from loader import Inbox

from pipeline.classifier import classify
from pipeline.extract_fields import process_email as extract_email_fields
from pipeline.compare import compare_shipment_data
from pipeline.humanreview import create_review_case, add_review_case, save_review_queue


def build_entry(category, status, review_reason, has_defect, defect_fields):
    return {
        "category": category,
        "status": status,
        "review_reason": review_reason,
        "has_defect": has_defect,
        "defect_fields": defect_fields,
    }


def process_single_email(email: dict, data_dir: str):
    category = classify(email)

    if category != "BL_COMPARISON":
        return build_entry(category, "OK", None, False, [])

    extraction = extract_email_fields(email, data_dir)
    result = compare_shipment_data(extraction)

    entry = build_entry(category, result["status"], result["review_reason"], result["has_defect"], result["defect_fields"])

    # log flagged cases for later human review — never blocks, never calls run_terminal_review()
    if result["status"] in {"MISMATCH", "NEEDS_REVIEW"}:
        review_case = create_review_case(email["email_id"], extraction, result)
        add_review_case(review_case)

    return entry


def run(data_dir: str = "data_v2", limit: int = None):
    inbox = list(Inbox(data_dir))
    if limit:
        inbox = inbox[:limit]

    submission = {}
    for i, email in enumerate(inbox):
        try:
            submission[email["email_id"]] = process_single_email(email, data_dir)
        except Exception as e:
            print(f"ERROR on {email['email_id']}: {e}")
            submission[email["email_id"]] = build_entry("GENERAL", "OK", None, False, [])

        if (i + 1) % 20 == 0:
            print(f"...{i + 1}/{len(inbox)} processed")

    os.makedirs("output", exist_ok=True)
    with open("output/submission.json", "w") as f:
        json.dump(submission, f, indent=2)

    save_review_queue("output/review_cases.json")
    print(f"\nDone. {len(submission)} entries -> output/submission.json")
    print("Flagged cases -> output/review_cases.json (open with humanreview.py's tools, never auto-run)")


if __name__ == "__main__":
    run(limit=20)