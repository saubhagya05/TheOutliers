"""Small shared helpers: timestamps, Aadhaar / phone validation, masking."""
from datetime import datetime, timezone

_D = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
      [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
      [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
      [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]]
_P = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
      [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
      [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]]


def verhoeff_valid(num: str) -> bool:
    """Aadhaar: 12 digits, does not start with 0/1, Verhoeff checksum holds."""
    if len(num) != 12 or not num.isdigit() or num[0] in "01":
        return False
    c = 0
    for i, d in enumerate(reversed(num)):
        c = _D[c][_P[i % 8][int(d)]]
    return c == 0


def phone_valid(p: str) -> bool:
    """Indian mobile: 10 digits starting 6-9, not all the same digit."""
    return len(p) == 10 and p.isdigit() and p[0] in "6789" and len(set(p)) > 1


def parse_ts(ts: str) -> datetime:
    return datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def mask_phone(p: str) -> str:
    return p[:4] + "X" * max(0, len(p) - 6) + p[-2:] if len(p) >= 6 else "X" * len(p)


def risk_level(score: int) -> str:
    return "high" if score >= 70 else "medium" if score >= 40 else "low"


def plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"
