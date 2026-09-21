import json
import glob

def merge():
    submission = {}
    for path in glob.glob("output/submission_*.json"):
        with open(path) as f:
            submission.update(json.load(f))

    with open("output/submission.json", "w") as f:
        json.dump(submission, f, indent=2)

    print(f"Merged {len(submission)} total entries -> output/submission.json")

    review_cases = []
    for path in glob.glob("output/review_cases_*.json"):
        with open(path) as f:
            review_cases.extend(json.load(f))

    with open("output/review_cases.json", "w") as f:
        json.dump(review_cases, f, indent=2)

    print(f"Merged {len(review_cases)} review cases -> output/review_cases.json")


if __name__ == "__main__":
    merge()