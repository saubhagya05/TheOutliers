"""Star feature: "what if fraudsters adapt". Re-score rings with some signals removed."""

SCENARIOS = [
    {"id": "freshAccounts", "label": "Ring opens a fresh bank account and UPI ID per member", "description": "Removes shared-account and shared-UPI signals."},
    {"id": "spreadOut", "label": "Ring registers from different IPs over weeks", "description": "Removes shared-IP and burst signals."},
    {"id": "freshContacts", "label": "Ring buys unrelated SIMs and real-looking emails", "description": "Removes batch-phone, shared-phone and templated-email signals."},
    {"id": "allAdaptations", "label": "All of the above", "description": "Worst case."},
]
LOST = {
    "freshAccounts": ["sharedAccount", "sharedUpi"],
    "spreadOut": ["sharedIp", "registrationBurst"],
    "freshContacts": ["batchPhone", "sharedPhone", "templatedEmail"],
    "allAdaptations": ["sharedAccount", "sharedUpi", "sharedIp", "registrationBurst", "batchPhone", "sharedPhone", "templatedEmail"],
}


def run(result: dict, scenario: str):
    """Return the POST /api/stress-test shape, or None for an unknown scenario.
    Simplest honest version: drop the lost signals' edges, re-run ring scoring, count rings >= threshold."""
    if scenario not in LOST:
        return None
    # TODO(ml)
    raise NotImplementedError("stress.run")
