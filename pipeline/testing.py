import json
import glob
from collections import Counter

all_ids = []
for path in glob.glob("output/submission_*.json"):
    with open(path) as f:
        data = json.load(f)
        all_ids.extend(data.keys())
        print(f"{path}: {len(data)} entries")

counts = Counter(all_ids)
duplicates = {eid: c for eid, c in counts.items() if c > 1}
print("\nDuplicate email_id(s):", duplicates)