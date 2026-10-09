"""Step 4: ring discovery and scoring.

Plan:
- Connected components on the graph, then networkx louvain_communities to split big ones.
- Cycle detection (nx.simple_cycles on a directed money-flow graph) and fan-in to collector accounts.
- Burst detection: sliding 60-minute window per agent / device.
- Ring risk = 0.30 link strength + 0.20 size/density + 0.20 signal diversity + 0.15 money flow + 0.15 timing.
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
