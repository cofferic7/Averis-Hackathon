import json
from pipeline.llm_client import call_llm
from pipeline.config import CATEGORIES

PROMPT_TEMPLATE = """You are classifying emails from a shipping operations inbox.

Choose exactly ONE category based primarily on the actual intent of the email.

Categories:

- BL_COMPARISON:
  The email is about checking, confirming, amending, reviewing, or requesting
  a draft Bill of Lading against shipment/document details.
  Examples of wording include "check the BL", "confirm draft BL",
  "request BL draft", or "please check the details".
  These are examples only. Other wording with the same intent is also BL_COMPARISON.

- SI_REQUEST:
  The email asks for a Shipping Instruction to be prepared, submitted,
  provided, or requested.
  Examples include "SI needed", "request SI", or "prepare the SI".
  These are examples only.

- INVOICE_QUERY:
  The email concerns invoices, billing, freight charges, local charges,
  payment-related shipment charges, or invoice corrections.
  Examples include "cancel invoice", "D&D charges", or "total freight".
  These are examples only.

- GENERAL:
  General operational communication that does not request one of the
  specific document/billing actions above.

- SPAM:
  Messages unrelated to genuine shipping operations, such as phishing,
  fake parcel fees, prizes, or suspicious notifications.

Important:
- Do NOT require an exact phrase from the examples.
- Recognize paraphrases and unfamiliar wording with the same meaning.
- Focus on the intent of the email, not exact keywords.
- Use the subject and the actual request in the first part of the body.
- Ignore signatures, forwarded-thread boilerplate, and company letterhead.
- If the subject is misleading, use the actual request in the body.
- Return exactly one category.

Subject: {subject}
Body: {body}

Respond with strict JSON only:
{{"category": "ONE_OF_THE_CATEGORIES_ABOVE"}}
"""


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
