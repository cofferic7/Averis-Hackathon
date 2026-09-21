import sys, time
sys.path.insert(0, "server")
from loader import Inbox
from pipeline.extract_fields import process_email as extract_email_fields
from pipeline.compare import compare_shipment_data

inbox = {e["email_id"]: e for e in Inbox("data_v2")}
test_ids = [f"email_{i}" for i in range(501, 521)]

def run_with_retry(email, data_dir, max_retries=5):
    for attempt in range(max_retries):
        try:
            extraction = extract_email_fields(email, data_dir)
            return compare_shipment_data(extraction)
        except Exception as e:
            if "429" in str(e):
                time.sleep(70)
            else:
                raise
    raise RuntimeError(f"gave up on {email['email_id']}")

for eid in test_ids:
    if eid in inbox:
        result = run_with_retry(inbox[eid], "data_v2")
        print(eid, "->", result["status"], "/", result["review_reason"], "/", result["defect_fields"])