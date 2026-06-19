"""Relational / contradiction checks over governed representations.

Structured entailment / negation over (subject, predicate, value, polarity)
facts — NOT embedding similarity. A claim contradicts the governed facts if a
fact asserts the same (subject, predicate, value) with the opposite polarity.
"""

from __future__ import annotations

from typing import Any

from .checks import CheckResult


def _polarity(fact: dict[str, Any]) -> str:
    pol = fact.get("polarity", "affirm")
    return str(pol)


def contradiction_check(label: str, claim: dict[str, Any], facts: list[dict[str, Any]]) -> CheckResult:
    for fact in facts:
        same_relation = (
            fact.get("subject") == claim.get("subject")
            and fact.get("predicate") == claim.get("predicate")
            and fact.get("value") == claim.get("value")
        )
        if same_relation and _polarity(fact) != _polarity(claim):
            return CheckResult(
                ok=False,
                confidence=0.2,
                detail=f"contradiction: {label} claim {claim} is negated by governed fact {fact}",
            )
    return CheckResult(ok=True, confidence=0.9, detail=f"{label}: no contradicting governed fact")
