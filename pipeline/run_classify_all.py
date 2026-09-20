import sys
import time
import json
from collections import Counter

sys.path.insert(0, "server")
from loader import Inbox
from pipeline.classifier import classify

def run():
    inbox = Inbox("data_v2")
    results = {}
    counts = Counter()

    for i, email in enumerate(inbox):
        try:
            category = classify(email)
        except Exception as e:
            print(f"ERROR on {email['email_id']}: {e}")
            category = "GENERAL"  # fallback so the run doesn't die

        results[email["email_id"]] = category
        counts[category] += 1

        if (i + 1) % 50 == 0:
            print(f"...{i + 1} emails processed")

        # pace to stay under free-tier rate limit
        if (i + 1) % 14 == 0:
            time.sleep(60)

    with open("output/classification_results.json", "w") as f:
        json.dump(results, f, indent=2)

    print("\n--- Category distribution ---")
    for cat, count in counts.most_common():
        print(f"{cat}: {count}")


if __name__ == "__main__":
    import os
    os.makedirs("output", exist_ok=True)
    run()