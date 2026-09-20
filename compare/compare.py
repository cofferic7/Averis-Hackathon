import re
from typing import Dict, Any, List, Tuple, Optional


def normalize_value(val: Any) -> Optional[str]:
    """
    Standardizes formatting (Rule 2):
    - Strips whitespace & normalizes casing.
    - Standardizes numbers (e.g., '3.0' vs '3' or '22,000' vs '22000').
    - Returns None for empty/missing values.
    """
    if val is None:
        return None
    
    val_str = str(val).strip()
    if not val_str or val_str.lower() in ["missing", "n/a", "none", "null"]:
        return None

    # Handle numeric formatting differences (remove commas, trailing zeros)
    cleaned_num = val_str.replace(',', '')
    try:
        num = float(cleaned_num)
        if num.is_integer():
            return str(int(num))
        return str(num)
    except ValueError:
        pass

    # Standardize spaces and text casing
    val_str = re.sub(r'\s+', ' ', val_str)
    return val_str.upper()


def compare_shipment_data(extraction_payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Member 3 Core Engine:
    Inputs:
        extraction_payload containing:
            - email_category (str)
            - attachments_present (bool)
            - extraction_errors (list or str)
            - doc1_type (str) -> "SI" or "BL"
            - doc1_data (dict of 7 fields)
            - doc2_type (str) -> "SI" or "BL"
            - doc2_data (dict of 7 fields)
    
    Returns:
        Structured result with status (OK, MISMATCH, NEEDS_REVIEW),
        defect_fields, side_by_side comparison, and review_reason.
    """
    REQUIRED_FIELDS = [
        "shipper",
        "consignee",
        "notify_party",
        "port_of_loading",
        "port_of_discharge",
        "container_count",
        "gross_weight_kg"
    ]

    # Rule: Apply this workflow ONLY to BL_COMPARISON emails
    if extraction_payload.get("email_category") != "BL_COMPARISON":
        return {
            "status": "NOT_APPLICABLE",
            "review_reason": "Email is not a BL_COMPARISON request",
            "defect_fields": [],
            "side_by_side": {}
        }

    # STEP 1: VALIDATE ATTACHMENTS & EXTRACTION ERRORS
    attachments_ok = extraction_payload.get("attachments_present", True)
    extraction_errors = extraction_payload.get("extraction_errors")

    if not attachments_ok:
        return {
            "status": "NEEDS_REVIEW",
            "review_reason": "Missing required attachment (SI or BL missing)",
            "defect_fields": [],
            "side_by_side": {}
        }

    if extraction_errors:
        return {
            "status": "NEEDS_REVIEW",
            "review_reason": f"Extraction unreadable/failed: {extraction_errors}",
            "defect_fields": [],
            "side_by_side": {}
        }

    # STEP 2: VALIDATE DOCUMENT TYPES (Check for exact SI and BL pair)
    doc1_type = str(extraction_payload.get("doc1_type", "")).upper()
    doc2_type = str(extraction_payload.get("doc2_type", "")).upper()

    doc1_data = extraction_payload.get("doc1_data")
    doc2_data = extraction_payload.get("doc2_data")

    si_raw = None
    bl_raw = None

    # Map the document data based on document_type
    if doc1_type == "SI":
        si_raw = doc1_data
    elif doc1_type == "BL":
        bl_raw = doc1_data

    if doc2_type == "SI":
        si_raw = doc2_data
    elif doc2_type == "BL":
        bl_raw = doc2_data

    # Check if both document types were correctly identified
    if not si_raw or not bl_raw:
        return {
            "status": "NEEDS_REVIEW",
            "review_reason": f"Document type mismatch or missing: Received doc types '{doc1_type}' and '{doc2_type}' (Required: 1 SI and 1 BL)",
            "defect_fields": [],
            "side_by_side": {}
        }

    # STEP 3: STANDARDISE FORMATTING & COMPARE FIELDS
    defect_fields = []
    side_by_side = {}
    missing_fields_reason = []

    for field in REQUIRED_FIELDS:
        raw_si_val = si_raw.get(field)
        raw_bl_val = bl_raw.get(field)

        norm_si_val = normalize_value(raw_si_val)
        norm_bl_val = normalize_value(raw_bl_val)

        # Build Side-by-Side Display Report
        side_by_side[field] = {
            "SI": raw_si_val if raw_si_val is not None else "MISSING",
            "BL": raw_bl_val if raw_bl_val is not None else "MISSING"
        }

        # Rule: Never treat two missing values as a match & flag missing fields as NEEDS_REVIEW
        if norm_si_val is None or norm_bl_val is None:
            missing_fields_reason.append(field)
        elif norm_si_val != norm_bl_val:
            defect_fields.append(field)

    # STEP 4: REPORT VERDICT
    # If any required field is unusable/missing -> NEEDS_REVIEW
    if missing_fields_reason:
        return {
            "status": "NEEDS_REVIEW",
            "review_reason": f"Missing/unusable value in field(s): {', '.join(missing_fields_reason)}",
            "defect_fields": defect_fields,
            "side_by_side": side_by_side
        }

    # If any fields differ -> MISMATCH
    if defect_fields:
        return {
            "status": "MISMATCH",
            "review_reason": f"Mismatches found in: {', '.join(defect_fields)}",
            "defect_fields": defect_fields,
            "side_by_side": side_by_side
        }

    # If all 7 fields match -> OK
    return {
        "status": "OK",
        "review_reason": "No mismatch detected",
        "defect_fields": [],
        "side_by_side": side_by_side
    }


# ==========================================
# TEST EXAMPLES / DEMO
# ==========================================
if __name__ == "__main__":
    import json

    # Demo 1: Correct payload with SI and BL document types
    sample_payload = {
        "email_category": "BL_COMPARISON",
        "attachments_present": True,
        "extraction_errors": None,
        "doc1_type": "SI",
        "doc1_data": {
            "shipper": "ABC Logistics", "consignee": "XYZ Corp", "notify_party": "Same",
            "port_of_loading": "PORT KLANG", "port_of_discharge": "SINGAPORE",
            "container_count": "3", "gross_weight_kg": "22000"
        },
        "doc2_type": "BL",
        "doc2_data": {
            "shipper": "ABC Logistics", "consignee": "XYZ Corp", "notify_party": "Same",
            "port_of_loading": "Port Klang", "port_of_discharge": "SINGAPORE",
            "container_count": "4", "gross_weight_kg": "22,000" # Container mismatch
        }
    }

    # Demo 2: Document type error (e.g., Member 2 passed two SIs)
    invalid_type_payload = {
        "email_category": "BL_COMPARISON",
        "attachments_present": True,
        "extraction_errors": None,
        "doc1_type": "SI",
        "doc1_data": {},
        "doc2_type": "SI", # Duplicate document type
        "doc2_data": {}
    }

    print("--- Test 1: Mismatch Handling ---")
    print(json.dumps(compare_shipment_data(sample_payload), indent=2))

    print("\n--- Test 2: Invalid Document Types ---")
    print(json.dumps(compare_shipment_data(invalid_type_payload), indent=2))