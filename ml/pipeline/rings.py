"""Step 4: ring discovery and scoring.

Plan:
- Connected components on the graph, then networkx louvain_communities to split big ones.
- Cycle detection (nx.simple_cycles on the transfers graph) and fan-in to collector accounts. College fee accounts
  are legitimate fan-in: require fast forwarding (minutes/hours after payout) of a large share of the payout.
- Burst detection: 3+ registrations from one IP within 60 minutes (CSC IPs spread over weeks are legitimate).
- Ring risk = weighted signal coverage (see RING_WEIGHTS in ml/data/build_mock_bundle.py as a starting point).
- Priority = recoverable INR per investigation effort.
"""
import networkx as nx
import pandas as pd


def find_rings(df: pd.DataFrame, g: nx.Graph) -> list:
    """Return a list of rings in the exact shape of GET /api/rings/:ringId (docs/API.md 2.2),
    WITHOUT Express-owned fields (status, manualOverride, note, color, activeMemberCount).

    Each ring needs: ringId, riskScore, riskLevel, district, ringType, memberCount, amountAtRiskInr,
    priority {priorityScore, rank, recoverableInr, effort}, summary, reasons, topReasons,
    signalBreakdown, columns, members (Record rows with anomalies), sharedEntities,
    graph {nodes, edges}, timeline.

    Also set kind="ringMember" and ringId on member rows of df for explain.record_details.
    """
    # TODO(ml)
    raise NotImplementedError("find_rings")
