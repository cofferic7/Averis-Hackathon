import json
import sys
from pathlib import Path

from compare import compare_shipment_data
from extract_fields import process_email
from server.loader import Inbox  # pylint: disable=wrong-import-order
# Allow Python to find the sibling "server" folder
sys.path.append(
    str(Path(__file__).resolve().parent.parent)
)



def main(data_dir: str) -> None:
    results = []

    # Process every email
    for email in Inbox(data_dir):

        # For now, only process emails with attachments
        if not email.get("attachments"):
            continue

        # Step 1: Extract SI and BL fields
        extracted = process_email(
            email,
            data_dir,
        )

        # Step 2: Compare SI and BL
        comparison_result = compare_shipment_data(
            extracted
        )

        # Step 3: Save result for this email
        results.append({
            "email_id": email["email_id"],
            **comparison_result,
        })

        print(
            f"{email['email_id']}: "
            f"{comparison_result['status']}"
        )

    # Save all results
    Path("results.json").write_text(
        json.dumps(
            results,
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    print(
        f"\nWrote results.json "
        f"({len(results)} emails)"
    )


if __name__ == "__main__":
    data_directory = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "data_v2"
    )

    main(data_directory)