from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

from pydantic import BaseModel

from extract_attachments import extract
from llm_client import call_llm as gemini_text
from config import ALIASES
from server.loader import Inbox


TEXT_FIELDS = [
    "shipper",
    "consignee",
    "notify_party",
    "port_of_loading",
    "port_of_discharge",
]

ALL_FIELDS = TEXT_FIELDS + [
    "container_count",
    "gross_weight_kg",
]


class Extraction(BaseModel):
    document_type_from_content: str | None
    shipper: str | None
    consignee: str | None
    notify_party: str | None
    port_of_loading: str | None
    port_of_discharge: str | None
    container_count: int | None
    gross_weight_kg: float | None


def format_aliases() -> str:
    lines = []

    for field, aliases in ALIASES.items():
        lines.append(
            f"- {field}: {', '.join(aliases)}"
        )

    return "\n".join(lines)


PROMPT = """
You extract structured shipping information from a document.

The document should be either a Shipping Instruction (SI)
or a Bill of Lading (BL).

Extract the following fields:

- document_type_from_content
- shipper
- consignee
- notify_party
- port_of_loading
- port_of_discharge
- container_count
- gross_weight_kg

IMPORTANT RULES:

1. NEVER guess a value.
   If a value is missing, unreadable, or uncertain, return null.

2. The labels in the document may be different from the examples
   below. The aliases are only examples, NOT an exhaustive list.

3. If an unfamiliar label clearly means one of the requested fields,
   use the label meaning, nearby text, following value, table headers,
   and shipping terminology to identify it.

4. For shipper, consignee, and notify_party:
   - Return the company/name only.
   - Remove addresses, cities, countries, phone numbers,
     PO boxes, and other address information.
   - If the name is split across multiple lines, join it together.

5. Preserve names and port names exactly as written.
   Do not correct spelling.

6. For container_count:
   - Return an integer.
   - Example: "12 x 20' FCL" means 12 containers.
   - If several container quantities are listed, add them together
     when the document clearly gives separate container quantities.

7. For gross_weight_kg:
   - Extract GROSS weight only.
   - Do NOT use net weight, tare weight, or VGM.
   - Return the value in kilograms.
   - Convert tonnes / metric tonnes to kilograms when necessary.
   - Example: 12.5 MT = 12500 kg.

8. Do not infer missing values from other documents.
   Only use information contained in this document.

Example aliases:
{aliases}
"""


JSON_SHAPE = """
Return ONLY a JSON object with exactly these keys:

{
    "document_type_from_content": "SI" | "BL" | null,
    "shipper": string | null,
    "consignee": string | null,
    "notify_party": string | null,
    "port_of_loading": string | null,
    "port_of_discharge": string | null,
    "container_count": integer | null,
    "gross_weight_kg": number | null
}
"""


def call_llm(text: str) -> Extraction:
    last_error = None

    for attempt in range(3):
        try:
            raw = gemini_text(
                f"{PROMPT.format(aliases=format_aliases())}"
                f"\n{JSON_SHAPE}"
                f"\n--- DOCUMENT ---\n{text}",
                json_mode=True,
            )

            raw = raw.strip()
            raw = raw.removeprefix("```json")
            raw = raw.removeprefix("```")
            raw = raw.removesuffix("```")
            raw = raw.strip()

            return Extraction.model_validate(
                json.loads(raw)
            )

        except Exception as error:
            last_error = error
            time.sleep(2 ** attempt)

    raise last_error


def type_from_filename(path: str) -> str | None:
    """
    Examples:
        email_001_SI.txt -> SI
        email_055_BL.docx -> BL
    """

    filename = Path(path).stem.upper()

    match = re.search(
        r"(?:^|[_\-\s])(SI|BL)$",
        filename,
    )

    if match:
        return match.group(1)

    return None


def _norm(s: str) -> str:
    return re.sub(
        r"[^A-Z0-9]",
        "",
        s.upper(),
    )


def _clean(value):
    if value is None:
        return None

    if isinstance(value, str):
        value = re.sub(
            r"\s+",
            " ",
            value,
        ).strip()

        if not value:
            return None

    return value


def verify(
    doc: dict,
    source_text: str,
) -> list[str]:

    issues = []

    normalized_source = _norm(source_text)

    # Verify text fields
    for field in TEXT_FIELDS:
        value = doc[field]

        if value is not None:
            normalized_value = _norm(value)

            if normalized_value not in normalized_source:
                issues.append(
                    f"{field}: value '{value}' "
                    f"not found in source text"
                )

    # Verify container count
    numbers = {
        float(number)
        for number in re.findall(
            r"\d+(?:\.\d+)?",
            source_text.replace(",", ""),
        )
    }

    container_count = doc["container_count"]

    if (
        container_count is not None
        and float(container_count) not in numbers
    ):
        issues.append(
            f"container_count: value "
            f"'{container_count}' not found "
            f"in source text"
        )

    return issues


def extract_fields(
    path: str,
    llm=call_llm,
) -> dict:

    extracted = extract(path)

    issues = []

    doc = {
        "document_type": type_from_filename(path),
        **{
            field: None
            for field in ALL_FIELDS
        },
    }

    meta = {
        "source_file": path,
        "extract_method": extracted.method,
        "status": "ok",
        "issues": issues,
    }

    doc["_meta"] = meta

    if extracted.status == "needs_review":
        issues.append(
            f"extraction: {extracted.warning}"
        )

    if not extracted.text.strip():
        meta["status"] = "needs_review"
        return doc

    try:
        result = llm(extracted.text)

    except Exception as error:
        issues.append(
            f"LLM extraction failed: {error}"
        )

        meta["status"] = "needs_review"
        return doc

    for field in ALL_FIELDS:
        doc[field] = _clean(
            getattr(result, field)
        )

    content_type = (
        result.document_type_from_content or ""
    ).upper()

    if content_type not in ("SI", "BL"):
        content_type = None

    filename_type = doc["document_type"]

    if (
        filename_type
        and content_type
        and filename_type != content_type
    ):
        issues.append(
            f"document_type conflict: filename says "
            f"{filename_type}, content looks like "
            f"{content_type}"
        )

    doc["document_type"] = (
        doc["document_type"]
        or content_type
    )

    if doc["document_type"] is None:
        issues.append(
            "document_type: cannot tell if this "
            "is SI or BL"
        )

    issues += verify(
        doc,
        extracted.text,
    )

    meta["status"] = (
        "needs_review"
        if issues
        else "ok"
    )

    return doc


def process_email(
    email: dict,
    data_dir: str,
    llm=call_llm,
) -> dict:

    output = {
        "email_id": email["email_id"],
        "SI": None,
        "BL": None,
    }

    attachments = email.get("attachments") or []

    for relative_path in attachments:

        path = Path(data_dir) / relative_path

        document = extract_fields(
            str(path),
            llm,
        )

        document_type = document["document_type"]

        if (
            document_type == "SI"
            and output["SI"] is None
        ):
            output["SI"] = {
                "document_type": document["document_type"],
                "shipper": document["shipper"],
                "consignee": document["consignee"],
                "notify_party": document["notify_party"],
                "port_of_loading": document["port_of_loading"],
                "port_of_discharge": document["port_of_discharge"],
                "container_count": document["container_count"],
                "gross_weight_kg": document["gross_weight_kg"],
            }

        elif (
            document_type == "BL"
            and output["BL"] is None
        ):
            output["BL"] = {
                "document_type": document["document_type"],
                "shipper": document["shipper"],
                "consignee": document["consignee"],
                "notify_party": document["notify_party"],
                "port_of_loading": document["port_of_loading"],
                "port_of_discharge": document["port_of_discharge"],
                "container_count": document["container_count"],
                "gross_weight_kg": document["gross_weight_kg"],
            }

    return output


def main(
    data_dir: str,
    only: list[str],
) -> None:

    sys.path.append(
        str(
            Path(__file__).resolve().parent.parent
            / "server"
        )
    )

    results = []

    for email in Inbox(data_dir):

        if (
            only
            and email["email_id"] not in only
        ):
            continue

        if not email.get("attachments"):
            continue

        result = process_email(
            email,
            data_dir,
        )

        results.append(result)

        print(
            f"{result['email_id']}: extracted"
        )

    Path("fields.json").write_text(
        json.dumps(
            results,
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    print(
        f"wrote fields.json "
        f"({len(results)} emails)"
    )


if __name__ == "__main__":

    data_directory = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "data_v2"
    )

    selected_emails = sys.argv[2:]

    main(
        data_directory,
        selected_emails,
    )