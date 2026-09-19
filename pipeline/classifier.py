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


if __name__ == "__main__":
    test_cases = [
        {
            "email_id": "email_001",
            "subject": "TO CONFIRM DOCS _ 5RSG-00133 _ CALLAO_PERU _ MOORIM SP CO., LTD _ MEDUUD104332",
            "body": "Hi Najiha,\n\nAttached are the SI and draft BL for OC 5RSG-00133 (PAPERONE DIGITAL COPIER PAPER). Please check the details and confirm.\n\nBest Regards,\nWilly Situmorang",
            "expected": "BL_COMPARISON",
        },
        {
            "email_id": "email_002",
            "subject": "RE_ LOCAL CHARGES FOB - KARGOSMAR - 5AKR-61849 - TELEX RELEASE CHARGES",
            "body": "Hi,\n\nQuery on invoice 5250075931: is the THC / local charge included or billed separately? Please advise the breakdown.",
            "expected": "INVOICE_QUERY",
        },
        {
            "email_id": "email_003",
            "subject": "RE_ TO CONFIRM DOCS _ 5AAT-03056 _ AQABA_JORDAN _ ROXCEL TRADING GMBH _ SIN525534192",
            "body": "Dear Hari,\n\nPlease assist to send the draft BL for SIN832764835 for checking asap.",
            "expected": "BL_COMPARISON",
        },
        {
            "email_id": "email_004",
            "subject": "REQUEST BL DRAFT _ PO 26067_ COATED IVORY BOARD__138MT",
            "body": "Hi Mitchelle,\n\nAttached are the SI and draft BL for OC 5ALT-01226 (COATED IVORY BOARD). Please check the details and confirm.",
            "expected": "BL_COMPARISON",
        },
        {
            "email_id": "email_005",
            "subject": "RE_ Draft BL INDO SUKSES 65 V.51NW1 SINGAPORE - amend BL 057",
            "body": "Dear Elisa,\n\nPlease find attached the shipping instruction and the draft bill of lading for PSGSE8148932 for your confirmation. Kindly verify the BL matches the SI before we release to the line.",
            "expected": "BL_COMPARISON",
        },
    ]

    passed = 0
    for case in test_cases:
        result = classify(case)
        status = "PASS" if result == case["expected"] else "FAIL"
        if status == "PASS":
            passed += 1
        print(f"{status} | {case['email_id']}: got={result} expected={case['expected']}")

    print(f"\n{passed}/{len(test_cases)} passed")