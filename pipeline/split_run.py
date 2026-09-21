import sys
import time
import json
import os
import argparse

sys.path.insert(0, "server")
from loader import Inbox
from pipeline.main import process_single_email
from pipeline.humanreview import save_review_queue


def run_with_retry(email, data_dir, max_retries=5):
    for attempt in range(max_retries):
        try:
            return process_single_email(email, data_dir)
        except Exception as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                print(f"  rate limited on {email['email_id']}, waiting 70s (attempt {attempt+1})")
                time.sleep(70)
            else:
                print(f"  ERROR on {email['email_id']}: {e}")
                return {"category": "GENERAL", "status": "OK", "review_reason": None,
                        "has_defect": False, "defect_fields": []}
    print(f"  gave up on {email['email_id']} after {max_retries} retries")
    return {"category": "GENERAL", "status": "OK", "review_reason": None,
            "has_defect": False, "defect_fields": []}


def run(start: int, end: int, output_name: str, data_dir: str = "data_v2"):
    inbox = list(Inbox(data_dir))
    chunk = inbox[start:end]
    print(f"Processing emails {start} to {end} ({len(chunk)} total) -> output_{output_name}.json")

    submission = {}
    for i, email in enumerate(chunk):
        submission[email["email_id"]] = run_with_retry(email, data_dir)
        if (i + 1) % 10 == 0:
            print(f"...{i + 1}/{len(chunk)} done")

    os.makedirs("output", exist_ok=True)
    with open(f"output/submission_{output_name}.json", "w") as f:
        json.dump(submission, f, indent=2)

    save_review_queue(f"output/review_cases_{output_name}.json")
    print(f"\nDone. {len(submission)} entries -> output/submission_{output_name}.json")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, required=True)
    parser.add_argument("--end", type=int, required=True)
    parser.add_argument("--name", type=str, required=True, help="your name, e.g. eric")
    args = parser.parse_args()

    run(args.start, args.end, args.name)