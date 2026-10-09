"""Case brief for one ring. Template first; an LLM rewrite of the summary is optional (key stays server-side)."""
from datetime import datetime, timezone


def build_brief(ring: dict) -> dict:
    lakh = lambda n: f"₹{n / 100000:.1f} lakh"
    accounts = [h["label"] for h in ring["sharedEntities"] if h["type"] == "account"]
    agents = [h["label"] for h in ring["sharedEntities"] if h["type"] == "agent"]
    action = " ".join(filter(None, [
        f"Freeze or hold payouts to {', '.join(accounts)}." if accounts else "Hold further payouts pending verification.",
        f"Question {', '.join(agents)} about the applications they filed." if agents else None,
        "Field-verify a sample of 3 members at their registered addresses.",
    ]))
    sections = [
        {"heading": "Summary", "body": f"{ring['summary']} Risk score {ring['riskScore']}/100. "
                                       f"Estimated recoverable: {lakh(ring['priority']['recoverableInr'])}."},
        {"heading": "Evidence", "body": "\n".join(f"- {r['label']}" for r in ring["reasons"])},
        {"heading": "Shared items", "body": "\n".join(
            f"- {h['label']} ({h['type']}, linked to {h['linkedMembers']} members)" for h in ring["sharedEntities"]) or "None"},
        {"heading": "Members", "body": "\n".join(
            f"- {m['recordId']} {m['fields']['name']}, {m['fields']['address']}, {m['fields']['bankAccount']}"
            for m in ring["members"])},
        {"heading": "Recommended action", "body": action},
    ]
    title = f"Case brief: Ring {ring['ringId']} ({ring['district']})"
    markdown = f"# {title}\n\n" + "\n\n".join(f"## {s['heading']}\n\n{s['body']}" for s in sections) + "\n"
    return {
        "ringId": ring["ringId"],
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "generatedBy": "template",
        "title": title,
        "sections": sections,
        "markdown": markdown,
    }
