import json
from pipeline.llm_client import call_llm
from pipeline.config import CATEGORIES

PROMPT_TEMPLATE = """You are classifying emails from a shipping operations inbox into exactly one category.

Categories:
- BL_COMPARISON: requests to check/confirm a draft Bill of Lading against a Shipping Instruction, or to send a draft BL for checking. Look for phrases like "TO CONFIRM DOCS", "REQUEST BL DRAFT", "Draft BL ... amend", "please check the details and confirm", or coded subjects like "AIE - POD - CARRIER(BL#) - OC - INV - CUSTOMER - TERM".
- SI_REQUEST: requests to prepare a new Shipping Instruction. Look for "SI - <bl> - DIRECT(<carrier>)", "CUST SI", "SI NEEDED", "REQUEST SI".
- INVOICE_QUERY: questions about billing, invoices, or charges. Look for "LOCAL CHARGES", "CANCEL INVOICE", "MISSING GR", "D & D charges", "Total Freight", "TELEX RELEASE CHARGES".
- GENERAL: operational updates, reports, reminders, HR/holiday notices, bot/RPA notifications. Not a specific action request tied to a shipment document.
- SPAM: prize notifications, unclaimed parcel fees, mailbox-full warnings, phishing attempts — unrelated to real shipping operations.

Ignore forwarded-thread boilerplate, signature blocks, and company letterhead text in the body — they appear in almost every email and are not classification signal. Focus on the subject line and the actual request in the first 1-2 sentences of the body.

Subject: {subject}
Body: {body}

Respond with strict JSON only, no other text: {{"category": "ONE_OF_THE_CATEGORIES_ABOVE"}}"""


def classify(email: dict) -> str:
    prompt = PROMPT_TEMPLATE.format(
        subject=email.get("subject", ""),
        body=email.get("body", "")[:600],
    )
    raw = call_llm(prompt, json_mode=True)
    result = json.loads(raw)
    category = result.get("category", "").strip()

    if category not in CATEGORIES:
        raise ValueError(f"Unexpected category '{category}' for email {email.get('email_id')}")

    return category
