import re

from typing import Any, Dict, List, Optional


# ============================================================
# CONSTANTS
# ============================================================

REQUIRED_FIELDS = [
    "shipper",
    "consignee",
    "notify_party",
    "port_of_loading",
    "port_of_discharge",
    "container_count",
    "gross_weight_kg",
]


ALLOWED_REVIEW_REASONS = {
    "missing_attachment",
    "wrong_doc_type",
    "unreadable",
    "missing_value",
}


# ============================================================
# NORMALISATION FUNCTIONS
# ============================================================

def is_missing(value: Any) -> bool:
    """
    Return True when a value is empty or represents
    missing data.
    """

    if value is None:
        return True

    text = str(value).strip().lower()

    return text in {
        "",
        "missing",
        "n/a",
        "na",
        "none",
        "null",
        "unknown",
        "not available",
    }


def normalize_text(
    value: Any,
) -> Optional[str]:
    """
    Normalise ordinary text fields.

    Examples:
    'PORT KLANG' and 'Port Klang' become the same value.
    Extra spaces are also removed.
    """

    if is_missing(value):
        return None

    text = str(value).strip()

    # Change multiple spaces into one space
    text = re.sub(r"\s+", " ", text)

    # casefold() allows case-insensitive comparison
    return text.casefold()


def extract_number(
    value: Any,
) -> Optional[float]:
    """
    Extract the first number from values such as:

    - '22,000 kg'
    - '22000 KG'
    - '3 containers'
    - '3.0'
    """

    if is_missing(value):
        return None

    text = str(value).replace(",", "").strip()

    match = re.search(
        r"-?\d+(?:\.\d+)?",
        text,
    )

    if not match:
        return None

    return float(match.group())


def normalize_field(
    field: str,
    value: Any,
) -> Optional[Any]:
    """
    Apply the correct normalisation rule based on
    the field being compared.
    """

    if field == "container_count":
        number = extract_number(value)

        # Container count must be a whole number
        if number is None or not number.is_integer():
            return None

        return int(number)

    if field == "gross_weight_kg":
        number = extract_number(value)

        if number is None:
            return None

        return number

    # All other fields are text fields
    return normalize_text(value)


# ============================================================
# RESULT FUNCTION
# ============================================================

def make_result(
    status: str,
    review_reason: Optional[str],
    defect_fields: Optional[List[str]] = None,
    side_by_side: Optional[Dict[str, Any]] = None,
    message: str = "",
) -> Dict[str, Any]:
    """
    Create one consistent comparison result.
    """

    defects = defect_fields or []

    return {
        "status": status,
        "review_reason": review_reason,
        "has_defect": status == "MISMATCH",
        "defect_fields": defects,
        "side_by_side": side_by_side or {},
        "message": message,
    }


# ============================================================
# MAIN COMPARISON FUNCTION
# ============================================================

def compare_shipment_data(
    extraction_payload: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Validate Member 2's extracted documents and
    compare the seven required fields.
    """

    # This function is only for BL comparison emails
    if (
        extraction_payload.get("email_category")
        != "BL_COMPARISON"
    ):
        return make_result(
            status="NOT_APPLICABLE",
            review_reason=None,
            message=(
                "This email does not require "
                "document comparison."
            ),
        )

    # ========================================================
    # STEP 1: CHECK ATTACHMENTS
    # ========================================================

    if (
        extraction_payload.get("attachments_present")
        is not True
    ):
        return make_result(
            status="NEEDS_REVIEW",
            review_reason="missing_attachment",
            message=(
                "The Shipping Instruction or "
                "Bill of Lading is missing."
            ),
        )

    # ========================================================
    # STEP 2: CHECK EXTRACTION ERRORS
    # ========================================================

    extraction_errors = extraction_payload.get(
        "extraction_errors"
    )

    if extraction_errors:
        return make_result(
            status="NEEDS_REVIEW",
            review_reason="unreadable",
            message=(
                "Document extraction failed: "
                f"{extraction_errors}"
            ),
        )

    # ========================================================
    # STEP 3: GET DOCUMENTS FROM MEMBER 2
    # ========================================================

    documents = extraction_payload.get(
        "documents",
        [],
    )

    if not isinstance(documents, list):
        return make_result(
            status="NEEDS_REVIEW",
            review_reason="unreadable",
            message=(
                "The extracted documents are not "
                "in the expected list format."
            ),
        )

    if not documents:
        return make_result(
            status="NEEDS_REVIEW",
            review_reason="missing_attachment",
            message=(
                "No Shipping Instruction or "
                "Bill of Lading was provided."
            ),
        )

    si_raw = None
    bl_raw = None
    unknown_document_types = []

    # Read each document returned by Member 2
    for document in documents:

        if not isinstance(document, dict):
            return make_result(
                status="NEEDS_REVIEW",
                review_reason="unreadable",
                message=(
                    "One extracted document is not "
                    "in the expected format."
                ),
            )

        document_type = str(
            document.get("document_type", "")
        ).strip().upper()

        document_data = document.get("data")

        # Store the SI data
        if document_type == "SI":

            # More than one SI was provided
            if si_raw is not None:
                return make_result(
                    status="NEEDS_REVIEW",
                    review_reason="wrong_doc_type",
                    message=(
                        "More than one Shipping "
                        "Instruction was provided."
                    ),
                )

            si_raw = document_data

        # Store the BL data
        elif document_type == "BL":

            # More than one BL was provided
            if bl_raw is not None:
                return make_result(
                    status="NEEDS_REVIEW",
                    review_reason="wrong_doc_type",
                    message=(
                        "More than one Bill of "
                        "Lading was provided."
                    ),
                )

            bl_raw = document_data

        # The document is not SI or BL
        else:
            unknown_document_types.append(
                document_type or "UNKNOWN"
            )

    # An incorrect document type was found
    if unknown_document_types:
        return make_result(
            status="NEEDS_REVIEW",
            review_reason="wrong_doc_type",
            message=(
                "Unknown document type(s): "
                + ", ".join(unknown_document_types)
                + ". Expected only SI and BL."
            ),
        )

    # ========================================================
    # STEP 4: CHECK WHETHER SI AND BL ARE AVAILABLE
    # ========================================================

    missing_documents = []

    if si_raw is None:
        missing_documents.append("SI")

    if bl_raw is None:
        missing_documents.append("BL")

    if missing_documents:
        return make_result(
            status="NEEDS_REVIEW",
            review_reason="missing_attachment",
            message=(
                "Missing required document(s): "
                + ", ".join(missing_documents)
            ),
        )

    # Check that Member 2 returned dictionary data
    if (
        not isinstance(si_raw, dict)
        or not isinstance(bl_raw, dict)
    ):
        return make_result(
            status="NEEDS_REVIEW",
            review_reason="unreadable",
            message=(
                "One or both documents could "
                "not be extracted."
            ),
        )

    # ========================================================
    # STEP 5: COMPARE THE SEVEN FIELDS
    # ========================================================

    defect_fields = []
    missing_fields = []
    side_by_side = {}

    for field in REQUIRED_FIELDS:

        raw_si_value = si_raw.get(field)
        raw_bl_value = bl_raw.get(field)

        normalized_si = normalize_field(
            field,
            raw_si_value,
        )

        normalized_bl = normalize_field(
            field,
            raw_bl_value,
        )

        # Store the original and normalised values
        side_by_side[field] = {
            "SI": raw_si_value,
            "BL": raw_bl_value,
            "normalized_SI": normalized_si,
            "normalized_BL": normalized_bl,
        }

        # If either value is missing, human review is needed
        if (
            normalized_si is None
            or normalized_bl is None
        ):
            missing_fields.append(field)

        # Both values exist but they are different
        elif normalized_si != normalized_bl:
            defect_fields.append(field)

    # ========================================================
    # STEP 6: RETURN THE FINAL RESULT
    # ========================================================

    # Missing values mean the comparison is incomplete
    if missing_fields:
        return make_result(
            status="NEEDS_REVIEW",
            review_reason="missing_value",
            defect_fields=defect_fields,
            side_by_side=side_by_side,
            message=(
                "Missing or unusable value in: "
                + ", ".join(missing_fields)
            ),
        )

    # All fields are available, but some values differ
    if defect_fields:
        return make_result(
            status="MISMATCH",
            review_reason=None,
            defect_fields=defect_fields,
            side_by_side=side_by_side,
            message=(
                "Mismatch found in: "
                + ", ".join(defect_fields)
            ),
        )

    # All seven fields are available and match
    return make_result(
        status="OK",
        review_reason=None,
        defect_fields=[],
        side_by_side=side_by_side,
        message="No mismatch detected.",
    )


# ==========================================
# TEST EXAMPLES / DEMO
# ==========================================
if __name__ == "__main__":
    import json

    # ========================================================
    # TEST 1: VALID SI AND BL WITH ONE MISMATCH
    # ========================================================

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
                    "port_of_loading": "PORT KLANG",
                    "port_of_discharge": "SINGAPORE",
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
                    "port_of_discharge": "SINGAPORE",

                    # Mismatch: SI is 3 but BL is 4
                    "container_count": "4",

                    # This should match 22000 after normalisation
                    "gross_weight_kg": "22,000",
                },
            },
        ],
    }


    # ========================================================
    # TEST 2: INVALID DOCUMENT TYPES - TWO SI DOCUMENTS
    # ========================================================

    invalid_type_payload = {
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
                # Error: this should be BL
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
        ],
    }


    # ========================================================
    # RUN THE TESTS
    # ========================================================

    print("--- Test 1: Mismatch Handling ---")

    print(
        json.dumps(
            compare_shipment_data(sample_payload),
            indent=2,
        )
    )


    print("\n--- Test 2: Invalid Document Types ---")

    print(
        json.dumps(
            compare_shipment_data(invalid_type_payload),
            indent=2,
        )
    )

