import re
from typing import Any, Dict, List, Optional

PLACEHOLDER_RUN = re.compile(r"_{2,}")
MISSING_ATTACHMENT_SIGNAL = re.compile(
    r"\b(draft\s*BL\s*is\s*still\s*missing|"
    r"attachments?\s*appear[s]?\s*to\s*(have\s*been\s*)?dropped|"
    r"attachments?\s*(seem|appear)s?\s*(to\s*be\s*)?missing)\b",
    re.IGNORECASE,
)
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
# MISSING VALUE CHECK
# ============================================================

BARE_UNIT_TOKENS = {"mt", "mts", "kg", "kgs", "lbs", "cbm"}

def is_missing(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        cleaned = value.strip().casefold()
        if cleaned in {"", "missing", "n/a", "na", "none", "null", "unknown", "not available", "???", "tba"}:
            return True
        if PLACEHOLDER_RUN.search(cleaned):
            return True
        if cleaned in BARE_UNIT_TOKENS:
            return True
    return False


# ============================================================
# TEXT NORMALIZATION
# ============================================================

def normalize_text(value: Any) -> Optional[str]:
    """
    Normalize text so harmless differences such as
    capitalization and extra spaces do not create mismatches.
    """

    if is_missing(value):
        return None

    text = str(value).strip()

    text = re.sub(
        r"\s+",
        " ",
        text,
    )

    return text.casefold()


# ============================================================
# NUMBER EXTRACTION
# ============================================================

def extract_number(value: Any) -> Optional[float]:
    """
    Extract the first numeric value from a field.
    """

    if is_missing(value):
        return None

    text = str(value).strip()

    text = text.replace(",", "")

    match = re.search(
        r"-?\d+(?:\.\d+)?",
        text,
    )

    if not match:
        return None

    return float(match.group())


# ============================================================
# FIELD NORMALIZATION
# ============================================================

def normalize_field(
    field: str,
    value: Any,
) -> Any:
    """
    Normalize a field according to its type.
    """

    if is_missing(value):
        return None

    # --------------------------------------------------------
    # Container count
    # --------------------------------------------------------

    if field == "container_count":

        number = extract_number(value)

        if number is None:
            return None

        if not number.is_integer():
            return None

        return int(number)

    # --------------------------------------------------------
    # Gross weight
    # --------------------------------------------------------

    if field == "gross_weight_kg":

        number = extract_number(value)

        if number is None:
            return None

        return number

    # --------------------------------------------------------
    # Text fields
    # --------------------------------------------------------

    return normalize_text(value)


# ============================================================
# RESULT BUILDER
# ============================================================

def make_result(
    status: str,
    review_reason: Optional[str],
    defect_fields: Optional[List[str]] = None,
    side_by_side: Optional[Dict[str, Any]] = None,
    message: str = "",
) -> Dict[str, Any]:

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

def compare_shipment_data(extraction_payload: Dict[str, Any],email_body: str = "") -> Dict[str, Any]:
    """
    Compare SI and BL data produced by the
    attachment extraction stage.
    """
    escalation_reason = extraction_payload.get("escalation_reason")

    # --------------------------------------------------------
    # Get SI and BL directly from extraction output
    # --------------------------------------------------------

    si_raw = extraction_payload.get("SI")
    bl_raw = extraction_payload.get("BL")

    if escalation_reason in {"unreadable", "wrong_doc_type"}:
        return make_result(status="NEEDS_REVIEW", review_reason=escalation_reason,
                            message=f"Escalated: {escalation_reason}")
    # --------------------------------------------------------
    # Check whether required documents exist
    # --------------------------------------------------------

    missing_documents = []

    if si_raw is None:
        missing_documents.append("SI")

    if bl_raw is None:
        missing_documents.append("BL")

    if missing_documents:
        # both missing AND no explicit "missing/dropped" signal in the body
        # -> ordinary "please send the draft BL" request, not an error case
        if len(missing_documents) == 2 and not MISSING_ATTACHMENT_SIGNAL.search(email_body):
            return make_result(
                status="OK",
                review_reason=None,
                message="No attachments yet — request for future documents.",
            )

        return make_result(
            status="NEEDS_REVIEW",
            review_reason="missing_attachment",
            message="Missing required document(s): " + ", ".join(missing_documents),
        )

    # --------------------------------------------------------
    # Check that SI and BL are dictionaries
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # Compare the seven required fields
    # --------------------------------------------------------

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

        side_by_side[field] = {
            "SI": raw_si_value,
            "BL": raw_bl_value,
            "normalized_SI": normalized_si,
            "normalized_BL": normalized_bl,
        }

        # ----------------------------------------------------
        # Missing value
        # ----------------------------------------------------

        if (
            normalized_si is None
            or normalized_bl is None
        ):
            missing_fields.append(field)

        # ----------------------------------------------------
        # Actual mismatch
        # ----------------------------------------------------

        elif normalized_si != normalized_bl:
            defect_fields.append(field)

    # --------------------------------------------------------
    # Missing values take priority over mismatch
    # --------------------------------------------------------

    if missing_fields:
        return make_result(
            status="NEEDS_REVIEW",
            review_reason="missing_value",
            defect_fields=[],  # NEEDS_REVIEW rows must have empty defect_fields per spec
            side_by_side=side_by_side,
            message="Missing or unusable value in: " + ", ".join(missing_fields),
        )

    # --------------------------------------------------------
    # Mismatch
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # Everything matches
    # --------------------------------------------------------

    return make_result(
        status="OK",
        review_reason=None,
        defect_fields=[],
        side_by_side=side_by_side,
        message="No mismatch detected.",
    )


# ============================================================
# SIMPLE TEST
# ============================================================

if __name__ == "__main__":

    sample_payload = {
        "email_id": "test_001",

        "SI": {
            "document_type": "SI",
            "shipper": "ABC Logistics",
            "consignee": "XYZ Corp",
            "notify_party": "Same",
            "port_of_loading": "PORT KLANG",
            "port_of_discharge": "SINGAPORE",
            "container_count": 3,
            "gross_weight_kg": 22000,
        },

        "BL": {
            "document_type": "BL",
            "shipper": "ABC Logistics",
            "consignee": "XYZ Corp",
            "notify_party": "Same",
            "port_of_loading": "Port Klang",
            "port_of_discharge": "SINGAPORE",
            "container_count": 4,
            "gross_weight_kg": 22000,
        },
    }

    result = compare_shipment_data(
        sample_payload
    )

    print(result)