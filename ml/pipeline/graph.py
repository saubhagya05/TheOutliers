"""Step 3: graph. Records and shared items (account, upi, biometric, ip, phone, email template, address) are nodes.
Each shared attribute is an edge. Transfers (pipeline/load.load_transfers) add directed account -> account edges
for collector fan-in and cycle detection (nx.simple_cycles on the money subgraph). Uses networkx."""
import networkx as nx
import pandas as pd


def build_graph(df: pd.DataFrame, links: pd.DataFrame) -> nx.Graph:
    # TODO(ml): add beneficiary nodes + hub nodes, edges from links (keep signal and weight as edge attrs)
    raise NotImplementedError("build_graph")


def context_nodes(df: pd.DataFrame, ring_list: list, limit: int = 2000) -> list:
    """Unflagged background records for the constellation.
    Shape: {id, type: "beneficiary", label, ringId: None, riskScore}."""
    # TODO(ml)
    raise NotImplementedError("context_nodes")
