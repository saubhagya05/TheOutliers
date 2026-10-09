"""Star feature: "what if fraudsters adapt". Re-score rings with some signals removed."""

SCENARIOS = [
    {"id": "freshAccounts", "label": "Ring opens a fresh account per member", "description": "Removes the shared-account signal."},
    {"id": "spreadTiming", "label": "Ring spreads applications over 3 weeks", "description": "Removes the timing-burst signal."},
    {"id": "freshDevices", "label": "Ring uses a new phone/device per member", "description": "Removes device and phone signals."},
    {"id": "allAdaptations", "label": "All of the above", "description": "Worst case."},
]
LOST = {
    "freshAccounts": ["sharedAccount"],
    "spreadTiming": ["timingBurst"],
    "freshDevices": ["sharedDevice", "sharedPhone"],
    "allAdaptations": ["sharedAccount", "timingBurst", "sharedDevice", "sharedPhone"],
}


def run(result: dict, scenario: str):
    """Return the POST /api/stress-test shape, or None for an unknown scenario.
    Simplest honest version: drop the lost signals' edges, re-run ring scoring, count rings >= threshold."""
    if scenario not in LOST:
        return None
    # TODO(ml)
    raise NotImplementedError("stress.run")
