"""Step 3a: money graph from transfers.csv. Collector fan-in and kickback cycles.

- Collector: an external account that receives at least FORWARD_SHARE of the payout from MIN_SENDERS or more
  beneficiaries within FORWARD_WINDOW of their payout. Accounts paid by more than MAX_SENDERS people (colleges,
  shops) are public infrastructure and never count as collectors.
- Kickback cycle: bounded simple cycles (nx.simple_cycles, length <= CYCLE_LENGTH) through a collector,
  e.g. member -> collector -> agent -> member.
"""
from collections import defaultdict

import networkx as nx

from .util import parse_ts

FORWARD_WINDOW_S = 24 * 3600
FORWARD_SHARE = 0.5
MIN_SENDERS = 3
MAX_SENDERS = 30      # an account paid by more people than this is public (college, shop), not a collector
CYCLE_LENGTH = 4


def analyse_money(rows, transfers):
    """Return (hubs, money).

    hubs: collector hubs in the linkage format {signal, key, members, label, kind, weight}.
    money: {
      "forwards":  recordId -> [{to, amountInr, share, minutes, ts}],
      "kickbacks": recordId -> [{from, amountInr, ts}],
      "edges":     recordId|account -> list of (source, target, amountInr) transfer edges for ring graphs,
      "collectors": account -> {"senders": [recordId], "agents": [account]},
    }
    """
    beneficiary_accounts = defaultdict(list)
    for r in rows:
        beneficiary_accounts[r["bank_account_number"]].append(r)
    out_of = defaultdict(list)
    senders_into = defaultdict(set)
    g = nx.DiGraph()
    for x in transfers:
        out_of[x["from_account"]].append(x)
        senders_into[x["to_account"]].add(x["from_account"])
        g.add_edge(x["from_account"], x["to_account"])

    candidates = defaultdict(list)
    for r in rows:
        paid = parse_ts(r["payout_ts"])
        amount = int(r["amount_inr"])
        for x in out_of[r["bank_account_number"]]:
            seconds = (parse_ts(x["ts"]) - paid).total_seconds()
            if (0 <= seconds <= FORWARD_WINDOW_S and int(x["amount_inr"]) >= FORWARD_SHARE * amount
                    and x["to_account"] not in beneficiary_accounts):
                candidates[x["to_account"]].append((r, x, seconds))

    hubs = []
    money = {"forwards": defaultdict(list), "kickbacks": defaultdict(list), "collectors": {}}
    for collector, items in candidates.items():
        if len({r["bank_account_number"] for r, _, _ in items}) < MIN_SENDERS or len(senders_into[collector]) > MAX_SENDERS:
            continue
        senders = []
        for r, x, seconds in items:
            senders.append(r["beneficiary_id"])
            money["forwards"][r["beneficiary_id"]].append({
                "to": collector, "amountInr": int(x["amount_inr"]), "share": int(x["amount_inr"]) / int(r["amount_inr"]),
                "minutes": int(seconds // 60), "ts": x["ts"]})
        agents = [y["to_account"] for y in out_of[collector]]
        # Bounded cycle search in the neighbourhood of this collector.
        sender_accounts = {r["bank_account_number"] for r, _, _ in items}
        nodes = {collector, *agents, *sender_accounts}
        for a in agents:
            nodes.update(g.successors(a))
        cycle_members = set()
        for cycle in nx.simple_cycles(g.subgraph(nodes), length_bound=CYCLE_LENGTH):
            if collector in cycle:
                cycle_members.update(acc for acc in cycle if acc in beneficiary_accounts)
        for acc in cycle_members:
            for x in transfers_into(out_of, agents, acc):
                for r in beneficiary_accounts[acc]:
                    money["kickbacks"][r["beneficiary_id"]].append({"from": x["from_account"], "amountInr": int(x["amount_inr"]), "ts": x["ts"]})
        money["collectors"][collector] = {"senders": senders, "agents": agents,
                                          "agentTransfers": [(collector, y["to_account"], int(y["amount_inr"])) for y in out_of[collector]]}
        hubs.append({"signal": "collectorAccount", "key": f"collector:{collector}", "members": sorted(set(senders)),
                     "label": collector, "kind": "account", "weight": 1.0})
    return hubs, money


def transfers_into(out_of, sources, account):
    return [x for s in sources for x in out_of[s] if x["to_account"] == account]
