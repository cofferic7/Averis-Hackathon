import sys
import time
import json
import os

sys.path.insert(0, "server")
from loader import Inbox
from pipeline.extract_fields import process_email as extract_email_fields
from pipeline.compare import compare_shipment_data


def run_with_retry(fn, *args, max_retries=5):
    for attempt in range(max_retries):
        try:
            return fn(*args)
        except Exception as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                print(f"  rate limited, waiting 70s (attempt {attempt+1})")
                time.sleep(70)
            else:
                print(f"  ERROR: {e}")
                return None
    return None


def build_report_data(submission_path: str, output_path: str, data_dir: str = "data_v2"):
    with open(submission_path) as f:
        submission = json.load(f)

    inbox = {e["email_id"]: e for e in Inbox(data_dir)}

    report_data = {}
    if os.path.exists(output_path):
        with open(output_path) as f:
            report_data = json.load(f)

    bl_comparison_ids = [
        eid for eid, entry in submission.items()
        if entry["category"] == "BL_COMPARISON" and eid not in report_data
    ]
    print(f"Building report data for {len(bl_comparison_ids)} BL_COMPARISON emails "
          f"(already have {len(report_data)} from a previous run)")

    for i, eid in enumerate(bl_comparison_ids):
        email = inbox[eid]
        entry = submission[eid]
        base = {**entry, "email_id": eid, "subject": email.get("subject", "")}

        extraction = run_with_retry(extract_email_fields, email, data_dir)
        if extraction:
            result = run_with_retry(compare_shipment_data, extraction, email.get("body", ""))
            base["si"] = extraction.get("SI")
            base["bl"] = extraction.get("BL")
            if result:
                base["side_by_side"] = result.get("side_by_side", {})
                base["message"] = result.get("message", "")

        report_data[eid] = base

        with open(output_path, "w") as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)

        if (i + 1) % 10 == 0:
            print(f"...{i + 1}/{len(bl_comparison_ids)} done")

    # non-BL_COMPARISON emails just carry their submission data through, no extraction needed
    for eid, entry in submission.items():
        if eid not in report_data:
            email = inbox[eid]
            report_data[eid] = {**entry, "email_id": eid, "subject": email.get("subject", "")}

    with open(output_path, "w") as f:
        json.dump(report_data, f, indent=2, ensure_ascii=False)

    print(f"\nDone. {len(report_data)} total entries -> {output_path}")


if __name__ == "__main__":
    build_report_data("output/submission.json", "output/report_data.json")