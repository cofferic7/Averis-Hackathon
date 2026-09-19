"""
extract_fields.py
Step 2 of the pipeline: attachment text -> the 8 aligned fields.

    document_type, shipper, consignee, notify_party, port_of_loading,
    port_of_discharge, container_count, gross_weight_kg

Flow per attachment:
    extract() (step 1)  ->  Gemini structured output  ->  code-side verification
The LLM only *reads*; plain code then checks every value really appears in the
source text, so a hallucinated or mis-converted value is flagged, not trusted.

Install:  pip install google-genai pydantic   (+ the step-1 dependencies)
Usage:    python extract_fields.py path/to/data [email_001 email_055 ...]
          -> writes fields.json
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path

from pydantic import BaseModel

from extract_attachments import GEMINI_MODEL, extract

TEXT_FIELDS = ["shipper", "consignee", "notify_party", "port_of_loading", "port_of_discharge"]
ALL_FIELDS = TEXT_FIELDS + ["container_count", "gross_weight_kg"]


# --------------------------------------------------------------------------
# LLM schema + prompt
# --------------------------------------------------------------------------
class FieldLabel(BaseModel):
    field: str                       # one of ALL_FIELDS
    label_in_document: str | None    # e.g. "Load Port", "Gross Wt (kgs)"


class Extraction(BaseModel):
    document_type_from_content: str | None   # "SI" | "BL" | null
    shipper: str | None
    consignee: str | None
    notify_party: str | None
    port_of_loading: str | None
    port_of_discharge: str | None
    container_count: int | None
    gross_weight_kg: float | None
    labels: list[FieldLabel]
    notes: str | None                # anything unusual (multiple sizes, unit converted...)


PROMPT = """You extract shipment fields from ONE shipping document (text below).
Return JSON matching the schema. Never guess: if a value is not in the document, return null.

document_type_from_content:
- "SI"  = Shipping Instruction: instructions sent to the carrier. A title such as
  "BL INSTRUCTION", "B/L instruction", "Shipping Instruction" means SI, NOT BL.
- "BL"  = the draft Bill of Lading issued by the carrier: titled "Bill of Lading (Draft)",
  has its own B/L number, vessel/voyage.
- null if you cannot tell.

Fields (labels vary, and may be bilingual, on the same line or on the following lines):
- shipper           : Shipper, Shipper/Exporter, Shipper (Principal or Seller), Exporter
- consignee         : Consignee, Consignee (Non-Negotiable)
- notify_party      : Notify, Notify Party
- port_of_loading   : Port of Loading, POL, Load Port, Loading Port
- port_of_discharge : Port of Discharge, POD, Discharge Port
- container_count   : Container Count, Total Containers, No. of Containers or Packages
- gross_weight_kg   : Gross Weight, Gross Wt (kgs)   (GROSS only: not net, tare or VGM)

Rules:
1. shipper / consignee / notify_party: the company NAME only. Drop street address, PO box,
   city/country lines and phone numbers. Keep lines such as "ON BEHALF OF <company>" because
   they are part of the shipper name. Join multi-line names with a single space.
2. Copy names and ports EXACTLY as written (same spelling and capitalisation, no corrections).
   For ports keep everything written after the label, including country and code in brackets.
3. container_count: integer number of containers, e.g. "12 x 20'FCL" -> 12, "1 x 40'HC" -> 1.
   If several sizes are listed, add them up and explain in notes.
4. gross_weight_kg: a plain number without thousands separators, e.g. "21,577 KG" -> 21577.
   If the unit is not kg (e.g. MT / tonnes) convert to kg and say so in notes.
5. labels: for every field you found, the exact label text used in the document.
6. notes: null unless something was ambiguous or unusual.
"""


def call_llm(text: str) -> Extraction:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    last: Exception | None = None
    for attempt in range(3):                       # retry: transient API errors happen
        try:
            resp = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=f"{PROMPT}\n--- DOCUMENT ---\n{text}",
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=Extraction,
                    temperature=0,
                ),
            )
            if resp.parsed is None:
                raise ValueError("model returned no parseable JSON")
            return resp.parsed
        except Exception as e:
            last = e
            time.sleep(2 ** attempt)
    raise last  # type: ignore[misc]


# --------------------------------------------------------------------------
# helpers: document type + verification (plain code, no LLM)
# --------------------------------------------------------------------------
def type_from_filename(path: str) -> str | None:
    """email_001_SI.txt -> 'SI', email_055_BL.docx -> 'BL'."""
    m = re.search(r"(?:^|[_\-\s])(SI|BL)$", Path(path).stem.upper())
    return m.group(1) if m else None


def _norm(s: str) -> str:
    """Upper-case and keep only letters/digits, so '|', ';', line breaks don't matter."""
    return re.sub(r"[^A-Z0-9]", "", s.upper())


def _clean(v):
    if isinstance(v, str):
        v = re.sub(r"\s+", " ", v).strip()
        return v or None
    return v


def verify(doc: dict, source_text: str) -> list[str]:
    """Return problems that should send this document to human review."""
    issues: list[str] = []
    norm_src = _norm(source_text)

    for k in ALL_FIELDS:
        if doc[k] is None:
            issues.append(f"{k}: missing in document")

    for k in TEXT_FIELDS:
        v = doc[k]
        if v is not None and _norm(v) not in norm_src:
            issues.append(f"{k}: value '{v}' not found in source text (possible hallucination)")

    # whole-number tokens in the source ("21,577 KG" -> 21577.0, "1 x 40'HC" -> 1.0, 40.0)
    numbers = {float(t) for t in re.findall(r"\d+(?:\.\d+)?", source_text.replace(",", ""))}

    n = doc["container_count"]
    if n is not None and float(n) not in numbers:
        issues.append(f"container_count: {n} not found as a number in source text")

    w = doc["gross_weight_kg"]
    if w is not None and not any(abs(w - x) < 0.01 for x in numbers):
        issues.append(f"gross_weight_kg: {w:g} not found as a number in source text "
                      "(unit conversion or decimal/thousands-separator issue?)")
    return issues


# --------------------------------------------------------------------------
# one attachment -> aligned dict
# --------------------------------------------------------------------------
def extract_fields(path: str, llm=call_llm) -> dict:
    ext = extract(path)                                        # step 1
    issues: list[str] = []
    notes: list[str] = []
    doc = {"document_type": type_from_filename(path), **{k: None for k in ALL_FIELDS}}
    meta = {"source_file": path, "extract_method": ext.method,
            "status": "ok", "issues": issues, "notes": notes, "labels": {}}
    doc["_meta"] = meta                                        # teammate can ignore _meta

    if ext.status == "needs_review":
        issues.append(f"extraction: {ext.warning}")
    elif ext.warning:
        notes.append(f"extraction: {ext.warning}")

    if not ext.text.strip():
        meta["status"] = "needs_review"
        return doc

    try:
        r = llm(ext.text)                                      # step 2
    except Exception as e:
        issues.append(f"LLM extraction failed: {e}")
        meta["status"] = "needs_review"
        return doc

    for k in ALL_FIELDS:
        doc[k] = _clean(getattr(r, k))
    meta["labels"] = {l.field: l.label_in_document for l in r.labels}
    if r.notes:
        notes.append(f"model: {r.notes}")

    # reconcile document type: filename vs. what the content says
    ctype = (r.document_type_from_content or "").upper()
    ctype = ctype if ctype in ("SI", "BL") else None
    if doc["document_type"] and ctype and doc["document_type"] != ctype:
        issues.append(f"document_type conflict: filename says {doc['document_type']}, "
                      f"content looks like {ctype}")
    doc["document_type"] = doc["document_type"] or ctype
    if doc["document_type"] is None:
        issues.append("document_type: cannot tell if this is SI or BL")

    issues += verify(doc, ext.text)                            # step 3
    meta["status"] = "needs_review" if issues else "ok"
    return doc


# --------------------------------------------------------------------------
# one email -> {SI, BL}
# --------------------------------------------------------------------------
def process_email(email: dict, data_dir: str, llm=call_llm) -> dict:
    out: dict = {"email_id": email["email_id"], "SI": None, "BL": None, "issues": []}
    attachments = email.get("attachments") or []
    if not attachments:
        out["issues"].append("no attachments")

    review_flags: list[bool] = []
    for rel in attachments:
        d = extract_fields(str(Path(data_dir) / rel), llm)
        t = d["document_type"]
        if t in ("SI", "BL") and out[t] is None:
            out[t] = d
            review_flags.append(d["_meta"]["status"] != "ok")
        else:
            out["issues"].append(f"cannot assign {rel} (document_type={t}, or duplicate)")

    for t in ("SI", "BL"):
        if out[t] is None:
            out["issues"].append(f"missing {t} attachment")

    out["needs_review"] = bool(out["issues"]) or any(review_flags)
    return out


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------
def main(data_dir: str, only: list[str]) -> None:
    sys.path.append(str(Path(__file__).resolve().parent.parent / "server"))
    from loader import Inbox  # type: ignore # pylint: disable=import-error,import-outside-toplevel,wrong-import-position

    results = []
    for email in Inbox(data_dir):
        if only and email["email_id"] not in only:
            continue
        if not email.get("attachments"):                       # classification is upstream
            continue
        r = process_email(email, data_dir)
        results.append(r)
        print(f"{r['email_id']}: {'NEEDS REVIEW' if r['needs_review'] else 'ok'}"
              + (f"  {r['issues']}" if r["issues"] else ""))

    Path("fields.json").write_text(json.dumps(results, indent=2, ensure_ascii=False))
    print(f"wrote fields.json ({len(results)} emails)")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2:])