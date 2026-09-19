
import copy
import json
import uuid

from datetime import datetime, timezone
from typing import Any, Dict, List


# Change "compare" if your comparison file has another name.
# Example:
# from comparison import compare_shipment_data
from compare import compare_shipment_data


# ============================================================
# CONSTANTS AND STORAGE
# ============================================================

REQUIRED_FIELDS = {
    "shipper",
    "consignee",
    "notify_party",
    "port_of_loading",
    "port_of_discharge",
    "container_count",
    "gross_weight_kg",
}


ALLOWED_REVIEW_REASONS = {
    "missing_attachment",
    "wrong_doc_type",
    "unreadable",
    "missing_value",
}


ALLOWED_REVIEW_STATUSES = {
    "PENDING",
    "RESOLVED",
}


# Temporary storage while the Python program is running
review_queue: List[Dict[str, Any]] = []


# ============================================================
# HELPER FUNCTION
# ============================================================

def get_current_time() -> str:
    """Return the current date and time."""

    return datetime.now(timezone.utc).isoformat()


# ============================================================
# 1. CREATE A REVIEW CASE
# ============================================================

def create_review_case(
    email_id: str,
    review_reason: str,
    message: str,
    extraction_payload: Dict[str, Any],
    comparison_result: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Create a human-review case.

    This should only be called when the comparison result
    has a NEEDS_REVIEW status.
    """

    if comparison_result.get("status") != "NEEDS_REVIEW":
        raise ValueError(
            "Only NEEDS_REVIEW results can create a review case."
        )

    if review_reason not in ALLOWED_REVIEW_REASONS:
        raise ValueError(
            f"Invalid review reason: {review_reason}. "
            f"Allowed reasons: {sorted(ALLOWED_REVIEW_REASONS)}"
        )

    review_case = {
        "review_id": str(uuid.uuid4()),
        "email_id": email_id,
        "review_status": "PENDING",
        "review_reason": review_reason,
        "message": message,

        # Keep an unchanged copy of Member 2's original extraction
        "original_extraction_payload": copy.deepcopy(
            extraction_payload
        ),

        # This copy can be corrected by the human reviewer
        "extraction_payload": copy.deepcopy(
            extraction_payload
        ),

        # Evidence from the comparison
        "side_by_side": copy.deepcopy(
            comparison_result.get("side_by_side", {})
        ),

        # List of changes made by the reviewer
        "corrections": [],

        # Completed when the case is resolved
        "final_result": None,
        "reviewer_note": None,

        "created_at": get_current_time(),
        "updated_at": get_current_time(),
        "resolved_at": None,
    }

    return review_case


# ============================================================
# 2. ADD A CASE TO THE QUEUE
# ============================================================

def add_review_case(
    review_case: Dict[str, Any],
) -> None:
    """Add a newly created case to the review queue."""

    review_id = review_case.get("review_id")

    # Prevent the same review case from being added twice
    for existing_case in review_queue:
        if existing_case.get("review_id") == review_id:
            raise ValueError(
                f"Review case '{review_id}' already exists."
            )

    review_queue.append(review_case)


# ============================================================
# 3. GET REVIEW CASES
# ============================================================

def get_review_cases(
    status: str = "PENDING",
) -> List[Dict[str, Any]]:
    """
    Return review cases with the requested status.

    Valid statuses:
    - PENDING
    - RESOLVED
    """

    status = str(status).strip().upper()

    if status not in ALLOWED_REVIEW_STATUSES:
        raise ValueError(
            "Status must be PENDING or RESOLVED."
        )

    return [
        review_case
        for review_case in review_queue
        if review_case.get("review_status") == status
    ]


# ============================================================
# 4. CORRECT AN EXTRACTED VALUE
# ============================================================

def update_extracted_value(
    review_case: Dict[str, Any],
    document_type: str,
    field: str,
    corrected_value: Any,
) -> Dict[str, Any]:
    """
    Allow a human to correct one extracted value.

    Examples:
    - Add a missing gross weight
    - Correct a wrongly extracted port
    - Correct the container count
    """

    if review_case.get("review_status") != "PENDING":
        raise ValueError(
            "A resolved review case cannot be changed."
        )

    document_type = str(document_type).strip().upper()

    if document_type not in {"SI", "BL"}:
        raise ValueError(
            "document_type must be 'SI' or 'BL'."
        )

    if field not in REQUIRED_FIELDS:
        raise ValueError(
            f"Invalid field: '{field}'. "
            f"Allowed fields: {sorted(REQUIRED_FIELDS)}"
        )

    # Do not allow another missing value as a correction
    if corrected_value is None:
        raise ValueError(
            "The corrected value cannot be None."
        )

    if isinstance(corrected_value, str):
        if not corrected_value.strip():
            raise ValueError(
                "The corrected value cannot be empty."
            )

    payload = review_case["extraction_payload"]

    target_data = None

    # Find whether the requested document is doc1 or doc2
    if (
        str(payload.get("doc1_type", "")).strip().upper()
        == document_type
    ):
        target_data = payload.get("doc1_data")

    elif (
        str(payload.get("doc2_type", "")).strip().upper()
        == document_type
    ):
        target_data = payload.get("doc2_data")

    if not isinstance(target_data, dict):
        raise ValueError(
            f"Document type '{document_type}' was not found. "
            "This function only corrects fields in an existing document."
        )

    old_value = target_data.get(field)

    # Update the extracted value
    target_data[field] = corrected_value

    # Record the correction for checking later
    review_case["corrections"].append({
        "document_type": document_type,
        "field": field,
        "old_value": old_value,
        "new_value": corrected_value,
        "corrected_at": get_current_time(),
    })

    review_case["updated_at"] = get_current_time()

    return review_case


# ============================================================
# 5. RETRY COMPARISON
# ============================================================

def retry_comparison(
    review_case: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Run comparison again after the reviewer corrects the data.

    The new result may be:
    - OK
    - MISMATCH
    - NEEDS_REVIEW
    """

    if review_case.get("review_status") != "PENDING":
        raise ValueError(
            "This review case has already been resolved."
        )

    updated_payload = review_case["extraction_payload"]

    new_result = compare_shipment_data(
        updated_payload
    )

    # Update the evidence with the newest comparison
    review_case["side_by_side"] = copy.deepcopy(
        new_result.get("side_by_side", {})
    )

    review_case["updated_at"] = get_current_time()

    # If there is still a problem, update the reason and message
    if new_result.get("status") == "NEEDS_REVIEW":
        review_case["review_reason"] = new_result.get(
            "review_reason"
        )

        review_case["message"] = new_result.get(
            "message",
            "Further human review is required.",
        )

    return new_result


# ============================================================
# 6. RESOLVE THE REVIEW CASE
# ============================================================

def resolve_review_case(
    review_case: Dict[str, Any],
    final_result: Dict[str, Any],
    reviewer_note: str = "",
) -> Dict[str, Any]:
    """
    Mark a review case as resolved.

    The final result must be OK or MISMATCH.
    A case that still needs review cannot be resolved.
    """

    if review_case.get("review_status") != "PENDING":
        raise ValueError(
            "This review case has already been resolved."
        )

    final_status = final_result.get("status")

    if final_status == "NEEDS_REVIEW":
        raise ValueError(
            "The case still needs human review. "
            "Correct the remaining problem first."
        )

    if final_status not in {"OK", "MISMATCH"}:
        raise ValueError(
            "The final result must be OK or MISMATCH."
        )

    review_case["review_status"] = "RESOLVED"
    review_case["final_result"] = copy.deepcopy(
        final_result
    )
    review_case["reviewer_note"] = reviewer_note
    review_case["resolved_at"] = get_current_time()
    review_case["updated_at"] = get_current_time()

    return review_case


# ============================================================
# 7. SAVE REVIEW QUEUE
# ============================================================

def save_review_queue(
    file_path: str = "review_cases.json",
) -> None:
    """Save all human-review cases to a JSON file."""

    with open(file_path, "w", encoding="utf-8") as file:
        json.dump(
            review_queue,
            file,
            indent=2,
            ensure_ascii=False,
        )


# ============================================================
# TERMINAL TEST
# ============================================================

if __name__ == "__main__":
    import json

    error_payload = {
        "email_category": "BL_COMPARISON",
        "attachments_present": True,
        "extraction_errors": None,

        "doc1_type": "SI",
        "doc1_data": {
            "shipper": "ABC Corp",
            "consignee": "XYZ Ltd",
            "notify_party": "Same",
            "port_of_loading": "Port Klang",
            "port_of_discharge": "Singapore",
            "container_count": "3",
            "gross_weight_kg": "22000",
        },

        "doc2_type": "BL",
        "doc2_data": {
            "shipper": "ABC Corp",
            "consignee": "XYZ Ltd",
            "notify_party": "Same",
            "port_of_loading": "Port Klang",
            "port_of_discharge": "Singapore",
            "container_count": "3",

            # Error: value is missing
            "gross_weight_kg": None,
        },
    }

    # 1. Run initial comparison
    print("\n--- Initial comparison ---")

    initial_result = compare_shipment_data(
        error_payload
    )

    print(
        json.dumps(
            initial_result,
            indent=2,
        )
    )

    if initial_result["status"] != "NEEDS_REVIEW":
        raise SystemExit(
            "Test stopped: NEEDS_REVIEW was expected."
        )

    # 2. Create and add the review case
    review_case = create_review_case(
        email_id="email_test_001",
        review_reason=initial_result["review_reason"],
        message=initial_result.get(
            "message",
            "Human review is required.",
        ),
        extraction_payload=error_payload,
        comparison_result=initial_result,
    )

    add_review_case(review_case)

    print("\nReview case created.")
    print("Reason:", review_case["review_reason"])

    # 3. Human enters the correction
    print("\n--- Human correction ---")
    print("SI gross weight: 22000")
    print("BL gross weight: MISSING")

    corrected_value = input(
        "Enter the correct BL gross weight in kilograms: "
    ).strip()

    while not corrected_value:
        print("The value cannot be empty.")

        corrected_value = input(
            "Enter the correct BL gross weight in kilograms: "
        ).strip()

    update_extracted_value(
        review_case=review_case,
        document_type="BL",
        field="gross_weight_kg",
        corrected_value=corrected_value,
    )

    # 4. Retry comparison
    print("\n--- Comparison after correction ---")

    new_result = retry_comparison(
        review_case
    )

    print(
        json.dumps(
            new_result,
            indent=2,
        )
    )

    # 5. Resolve if all required data is now usable
    if new_result["status"] == "NEEDS_REVIEW":
        print("\nThe case still needs human review.")

    else:
        reviewer_note = input(
            "\nEnter a reviewer note: "
        ).strip()

        resolve_review_case(
            review_case=review_case,
            final_result=new_result,
            reviewer_note=reviewer_note,
        )

        print("\nReview completed.")
        print(
            "Final result:",
            review_case["final_result"]["status"],
        )

    print(
        "Pending cases:",
        len(get_review_cases("PENDING")),
    )

    print(
        "Resolved cases:",
        len(get_review_cases("RESOLVED")),
    )