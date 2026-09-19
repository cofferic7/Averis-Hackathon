FIELDS = ["shipper", "consignee", "notify_party", "port_of_loading",
          "port_of_discharge", "container_count", "gross_weight_kg"]
CATEGORIES = ["BL_COMPARISON", "SI_REQUEST", "INVOICE_QUERY", "GENERAL", "SPAM"]
REVIEW_REASONS = ["wrong_doc_type", "missing_attachment", "unreadable", "missing_value"]
ALIASES = {
    "shipper": ["shipper", "shipper/exporter", "shipper (principal or seller)"],
    "consignee": ["consignee", "consignee (non-negotiable)", "to the order of"],
    "notify_party": ["notify", "notify party"],
    "port_of_loading": ["port of loading (pol)", "port of loading", "pol", "load port"],
    "port_of_discharge": ["pod", "discharge port", "port of discharge"],
    "container_count": ["container count", "no. of containers or packages", "total containers"],
    "gross_weight_kg": ["gross wt (kgs)", "gross weight (kg)", "gross weight", "gross weight毛重(kgs)"],
}