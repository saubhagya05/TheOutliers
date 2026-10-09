"""Step 3b: entity graph and group discovery.

Records are nodes; every hub (shared account, burst IP, phone batch, collector, ...) links its members.
Edge weight = signal strength / log2(1 + hub size): a value shared by 2 people says more than one shared by 20
(inverse-frequency weighting). Groups = connected components, split with Louvain when they are large.
"""
import math
import random

import networkx as nx

LOUVAIN_MIN_SIZE = 25
MIN_GROUP = 3


def build_graph(hubs) -> nx.Graph:
    g = nx.Graph()
    for hub in hubs:
        members = hub["members"]
        w = hub["weight"] / math.log2(1 + len(members))
        for i, a in enumerate(members):
            for b in members[i + 1:]:
                if g.has_edge(a, b):
                    g[a][b]["weight"] += w
                    g[a][b]["signals"].add(hub["signal"])
                else:
                    g.add_edge(a, b, weight=w, signals={hub["signal"]})
    return g


def find_groups(g: nx.Graph) -> list:
    """Connected components; large ones are split into Louvain communities."""
    groups = []
    for comp in nx.connected_components(g):
        if len(comp) < MIN_GROUP:
            continue
        if len(comp) < LOUVAIN_MIN_SIZE:
            groups.append(sorted(comp))
            continue
        for community in nx.community.louvain_communities(g.subgraph(comp), weight="weight", seed=42):
            if len(community) >= MIN_GROUP:
                groups.append(sorted(community))
    return groups


def context_nodes(rows, flagged_ids, limit=2000, seed=7) -> list:
    """Unflagged background records for the constellation."""
    pool = [r for r in rows if r["beneficiary_id"] not in flagged_ids]
    sample = random.Random(seed).sample(pool, min(limit, len(pool)))
    return [{"id": r["beneficiary_id"], "type": "beneficiary", "label": r["full_name"], "ringId": None, "riskScore": 5}
            for r in sample]
