"""Human review workflow for Shipping Instruction and Bill of Lading checks."""

from __future__ import annotations

import copy
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    # Used when imported as part of the pipeline package.
    from .compare import compare_shipment_data
except ImportError:
    # Used when humanreview.py is run directly from the pipeline folder.
    from compare import compare_shipment_data


REQUIRED_FIELDS = [
    "shipper",
    "consignee",
    "notify_party",
    "port_of_loading",
    "port_of_discharge",
    "container_count",
    "gross_weight_kg",
]

ALLOWED_DOCUMENT_TYPES = {"SI", "BL"}
ALLOWED_REVIEW_REASONS = {
    "missing_attachment",
    "wrong_doc_type",
    "unreadable",
    "missing_value",
}
ALLOWED_REVIEW_STATUSES = {"PENDING", "RESOLVED"}
DEFAULT_REVIEW_FILE = "review_cases.json"

review_queue: List[Dict[str, Any]] = []


def current_time() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_pending(review_case: Dict[str, Any]) -> None:
    if review_case.get("review_status") != "PENDING":
        raise ValueError("A resolved review case cannot be changed.")


def _documents(review_case: Dict[str, Any]) -> List[Dict[str, Any]]:
    payload = review_case.get("extraction_payload")
    if not isinstance(payload, dict):
        raise ValueError("The review case has no valid extraction payload.")

    documents = payload.get("documents")
    if not isinstance(documents, list):
        raise ValueError("extraction_payload['documents'] must be a list.")
    return documents


def _validate_document_type(document_type: str) -> str:
    value = str(document_type).strip().upper()
    if value not in ALLOWED_DOCUMENT_TYPES:
        raise ValueError("document_type must be 'SI' or 'BL'.")
    return value


def _validate_document_data(document_data: Dict[str, Any]) -> None:
    if not isinstance(document_data, dict):
        raise ValueError("document_data must be a dictionary.")

    invalid = set(document_data) - set(REQUIRED_FIELDS)
    if invalid:
        raise ValueError("Unknown field(s): " + ", ".join(sorted(invalid)))


def _record_action(
    review_case: Dict[str, Any],
    action: str,
    details: Dict[str, Any],
    reviewer_note: str = "",
) -> None:
    review_case.setdefault("corrections", []).append(
        {
            "action": action,
            "details": copy.deepcopy(details),
            "reviewer_note": reviewer_note,
            "timestamp": current_time(),
        }
    )
    review_case["updated_at"] = current_time()


def update_attachment_status(review_case: Dict[str, Any]) -> None:
    """Set attachments_present using the current SI and BL documents."""
    payload = review_case["extraction_payload"]
    document_types = [
        str(document.get("document_type", "")).strip().upper()
        for document in _documents(review_case)
        if isinstance(document, dict)
    ]
    payload["attachments_present"] = (
        "SI" in document_types and "BL" in document_types
    )


def create_review_case(
    email_id: str,
    extraction_payload: Dict[str, Any],
    comparison_result: Dict[str, Any],
) -> Dict[str, Any]:
    """Create a pending review case for MISMATCH or NEEDS_REVIEW."""
    status = comparison_result.get("status")
    if status not in {"MISMATCH", "NEEDS_REVIEW"}:
        raise ValueError(
            "Only MISMATCH or NEEDS_REVIEW can create a review case."
        )

    review_reason = comparison_result.get("review_reason")
    if status == "NEEDS_REVIEW" and review_reason not in ALLOWED_REVIEW_REASONS:
        raise ValueError(f"Invalid review reason: {review_reason}")

    now = current_time()
    return {
        "review_id": str(uuid.uuid4()),
        "email_id": email_id,
        "review_status": "PENDING",
        "initial_status": status,
        "review_reason": review_reason,
        "message": comparison_result.get("message", "Human review is required."),
        "original_extraction_payload": copy.deepcopy(extraction_payload),
        "extraction_payload": copy.deepcopy(extraction_payload),
        "side_by_side": copy.deepcopy(comparison_result.get("side_by_side", {})),
        "initial_defect_fields": copy.deepcopy(
            comparison_result.get("defect_fields", [])
        ),
        "corrections": [],
        "final_result": None,
        "reviewer_note": None,
        "created_at": now,
        "updated_at": now,
        "resolved_at": None,
    }


def add_review_case(review_case: Dict[str, Any]) -> None:
    review_id = review_case.get("review_id")
    if any(case.get("review_id") == review_id for case in review_queue):
        raise ValueError(f"Review case '{review_id}' already exists.")
    review_queue.append(review_case)


def get_review_cases(status: Optional[str] = None) -> List[Dict[str, Any]]:
    if status is None:
        return review_queue

    value = str(status).strip().upper()
    if value not in ALLOWED_REVIEW_STATUSES:
        raise ValueError("status must be PENDING or RESOLVED.")
    return [case for case in review_queue if case.get("review_status") == value]


def update_extracted_value(
    review_case: Dict[str, Any],
    document_index: int,
    field: str,
    corrected_value: Any,
    reviewer_note: str = "",
) -> Dict[str, Any]:
    """Correct a missing or incorrectly extracted field."""
    _require_pending(review_case)
    if field not in REQUIRED_FIELDS:
        raise ValueError(f"Invalid field: {field}")
    if corrected_value is None or (
        isinstance(corrected_value, str) and not corrected_value.strip()
    ):
        raise ValueError("The corrected value cannot be empty.")

    documents = _documents(review_case)
    if document_index < 0 or document_index >= len(documents):
        raise IndexError("Invalid document index.")

    document = documents[document_index]
    if not isinstance(document, dict) or not isinstance(document.get("data"), dict):
        raise ValueError("The selected document has no editable data.")

    old_value = document["data"].get(field)
    document["data"][field] = corrected_value
    _record_action(
        review_case,
        "UPDATE_FIELD",
        {
            "document_index": document_index,
            "document_type": document.get("document_type"),
            "field": field,
            "old_value": old_value,
            "new_value": corrected_value,
        },
        reviewer_note,
    )
    return review_case


def add_document(
    review_case: Dict[str, Any],
    document_type: str,
    document_data: Dict[str, Any],
    reviewer_note: str = "",
) -> Dict[str, Any]:
    """Add a missing SI or BL using human-verified data."""
    _require_pending(review_case)
    doc_type = _validate_document_type(document_type)
    _validate_document_data(document_data)

    documents = _documents(review_case)
    new_document = {
        "document_type": doc_type,
        "data": copy.deepcopy(document_data),
    }
    documents.append(new_document)
    review_case["extraction_payload"]["extraction_errors"] = None
    update_attachment_status(review_case)
    _record_action(
        review_case,
        "ADD_DOCUMENT",
        {
            "document_index": len(documents) - 1,
            "new_document": new_document,
        },
        reviewer_note,
    )
    return review_case


def remove_document(
    review_case: Dict[str, Any],
    document_index: int,
    reviewer_note: str = "",
) -> Dict[str, Any]:
    """Remove a duplicate or incorrect document."""
    _require_pending(review_case)
    documents = _documents(review_case)
    if document_index < 0 or document_index >= len(documents):
        raise IndexError("Invalid document index.")

    removed = documents.pop(document_index)
    update_attachment_status(review_case)
    _record_action(
        review_case,
        "REMOVE_DOCUMENT",
        {"document_index": document_index, "removed_document": removed},
        reviewer_note,
    )
    return review_case


def change_document_type(
    review_case: Dict[str, Any],
    document_index: int,
    new_document_type: str,
    reviewer_note: str = "",
) -> Dict[str, Any]:
    """Correct an SI/BL document-type classification."""
    _require_pending(review_case)
    doc_type = _validate_document_type(new_document_type)
    documents = _documents(review_case)
    if document_index < 0 or document_index >= len(documents):
        raise IndexError("Invalid document index.")

    document = documents[document_index]
    if not isinstance(document, dict):
        raise ValueError("The selected document is invalid.")

    old_type = document.get("document_type")
    document["document_type"] = doc_type
    update_attachment_status(review_case)
    _record_action(
        review_case,
        "CHANGE_DOCUMENT_TYPE",
        {
            "document_index": document_index,
            "old_document_type": old_type,
            "new_document_type": doc_type,
        },
        reviewer_note,
    )
    return review_case


def replace_document(
    review_case: Dict[str, Any],
    document_index: int,
    document_type: str,
    document_data: Dict[str, Any],
    reviewer_note: str = "",
) -> Dict[str, Any]:
    """Replace unreadable or incorrect document data."""
    _require_pending(review_case)
    doc_type = _validate_document_type(document_type)
    _validate_document_data(document_data)
    documents = _documents(review_case)
    if document_index < 0 or document_index >= len(documents):
        raise IndexError("Invalid document index.")

    old_document = copy.deepcopy(documents[document_index])
    new_document = {
        "document_type": doc_type,
        "data": copy.deepcopy(document_data),
    }
    documents[document_index] = new_document
    review_case["extraction_payload"]["extraction_errors"] = None
    update_attachment_status(review_case)
    _record_action(
        review_case,
        "REPLACE_DOCUMENT",
        {
            "document_index": document_index,
            "old_document": old_document,
            "new_document": new_document,
        },
        reviewer_note,
    )
    return review_case


def retry_comparison(review_case: Dict[str, Any]) -> Dict[str, Any]:
    """Run compare.py again using the reviewed data."""
    _require_pending(review_case)
    update_attachment_status(review_case)
    result = compare_shipment_data(review_case["extraction_payload"])
    review_case["side_by_side"] = copy.deepcopy(result.get("side_by_side", {}))
    review_case["review_reason"] = result.get("review_reason")
    review_case["message"] = result.get("message", "")
    review_case["updated_at"] = current_time()
    return result


def resolve_review_case(
    review_case: Dict[str, Any],
    final_result: Dict[str, Any],
    reviewer_note: str = "",
    confirm_mismatch: bool = False,
) -> Dict[str, Any]:
    """Resolve OK, or resolve MISMATCH after human confirmation."""
    _require_pending(review_case)
    status = final_result.get("status")

    if status == "NEEDS_REVIEW":
        raise ValueError("The case still needs human review.")
    if status == "MISMATCH" and not confirm_mismatch:
        raise ValueError("The human reviewer must confirm the mismatch.")
    if status not in {"OK", "MISMATCH"}:
        raise ValueError("The final result must be OK or MISMATCH.")

    now = current_time()
    review_case["review_status"] = "RESOLVED"
    review_case["final_result"] = copy.deepcopy(final_result)
    review_case["reviewer_note"] = reviewer_note
    review_case["resolved_at"] = now
    review_case["updated_at"] = now
    return review_case


def save_review_queue(file_path: str = DEFAULT_REVIEW_FILE) -> None:
    with Path(file_path).open("w", encoding="utf-8") as file:
        json.dump(review_queue, file, indent=2, ensure_ascii=False)


def load_review_queue(file_path: str = DEFAULT_REVIEW_FILE) -> List[Dict[str, Any]]:
    path = Path(file_path)
    if not path.exists():
        return review_queue

    with path.open("r", encoding="utf-8") as file:
        saved_cases = json.load(file)
    if not isinstance(saved_cases, list):
        raise ValueError("review_cases.json must contain a list.")

    review_queue.clear()
    review_queue.extend(saved_cases)
    return review_queue


def display_documents(review_case: Dict[str, Any]) -> None:
    documents = _documents(review_case)
    if not documents:
        print("No documents are available.")
        return

    for index, document in enumerate(documents):
        print(f"\nDocument {index}: {document.get('document_type', 'UNKNOWN')}")
        data = document.get("data")
        if not isinstance(data, dict):
            print("  Data: UNREADABLE")
            continue
        for field in REQUIRED_FIELDS:
            print(f"  {field}: {data.get(field)}")


def _enter_document_data() -> Dict[str, Any]:
    return {field: input(f"Enter {field}: ").strip() for field in REQUIRED_FIELDS}


def run_terminal_review(review_case: Dict[str, Any]) -> Dict[str, Any]:
    """Interactive terminal review for MISMATCH and NEEDS_REVIEW."""
    while review_case["review_status"] == "PENDING":
        print("\n========== HUMAN REVIEW ==========")
        print("Email:", review_case["email_id"])
        print("Message:", review_case["message"])
        display_documents(review_case)
        print("\n1. Correct a field")
        print("2. Add a missing document")
        print("3. Remove a duplicate/wrong document")
        print("4. Change a document type")
        print("5. Replace an unreadable document")
        print("6. Retry comparison")
        print("7. Save and exit")
        choice = input("Choose 1-7: ").strip()

        try:
            if choice == "1":
                index = int(input("Document index: "))
                field = input("Field name: ").strip()
                value = input("Correct value: ").strip()
                note = input("Reviewer note: ").strip()
                update_extracted_value(review_case, index, field, value, note)

            elif choice == "2":
                doc_type = input("Document type (SI/BL): ").strip()
                data = _enter_document_data()
                note = input("Reviewer note: ").strip()
                add_document(review_case, doc_type, data, note)

            elif choice == "3":
                index = int(input("Document index to remove: "))
                note = input("Reviewer note: ").strip()
                remove_document(review_case, index, note)

            elif choice == "4":
                index = int(input("Document index: "))
                doc_type = input("Correct type (SI/BL): ").strip()
                note = input("Reviewer note: ").strip()
                change_document_type(review_case, index, doc_type, note)

            elif choice == "5":
                index = int(input("Document index: "))
                doc_type = input("Document type (SI/BL): ").strip()
                data = _enter_document_data()
                note = input("Reviewer note: ").strip()
                replace_document(review_case, index, doc_type, data, note)

            elif choice == "6":
                result = retry_comparison(review_case)
                print(json.dumps(result, indent=2))

                if result["status"] == "OK":
                    note = input("Final reviewer note: ").strip()
                    resolve_review_case(review_case, result, note)
                    print("Case resolved: OK")
                elif result["status"] == "MISMATCH":
                    answer = input("Confirm this mismatch? (yes/no): ").strip().lower()
                    if answer in {"yes", "y"}:
                        note = input("Final reviewer note: ").strip()
                        resolve_review_case(
                            review_case,
                            result,
                            note,
                            confirm_mismatch=True,
                        )
                        print("Case resolved: confirmed MISMATCH")
                    else:
                        print("Case remains pending.")
                else:
                    print("The case still needs review.")

            elif choice == "7":
                save_review_queue()
                print("Review queue saved. Case remains pending.")
                return review_case
            else:
                print("Invalid choice.")

        except (ValueError, IndexError) as error:
            print("Unable to complete action:", error)

    save_review_queue()
    return review_case

if __name__ == "__main__":
    sample_payload = {
        "email_category": "BL_COMPARISON",
        "attachments_present": True,
        "extraction_errors": None,
        "documents": [
            {
                "document_type": "SI",
                "data": {
                    "shipper": "ABC Logistics",
                    "consignee": "XYZ Corp",
                    "notify_party": "Same",
                    "port_of_loading": "Port Klang",
                    "port_of_discharge": "Singapore",
                    "container_count": "3",
                    "gross_weight_kg": "22000",
                },
            },
            {
                "document_type": "BL",
                "data": {
                    "shipper": "ABC Logistics",
                    "consignee": "XYZ Corp",
                    "notify_party": "Same",
                    "port_of_loading": "Port Klang",
                    "port_of_discharge": "Singapore",
                    "container_count": "4",
                    "gross_weight_kg": "22000",
                },
            },
        ],
    }

    initial_result = compare_shipment_data(
        sample_payload
    )

    print("\nInitial comparison:")
    print(
        json.dumps(
            initial_result,
            indent=2,
        )
    )

    if initial_result["status"] in {
        "MISMATCH",
        "NEEDS_REVIEW",
    }:
        test_case = create_review_case(
            email_id="email_test_001",
            extraction_payload=sample_payload,
            comparison_result=initial_result,
        )

        add_review_case(test_case)
        run_terminal_review(test_case)