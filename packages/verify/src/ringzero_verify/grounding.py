"""Grounding / provenance check.

Every source a claim cites MUST be present in the set of actually-retrieved,
allowlisted sources. A citation to anything outside that set is a fabricated /
ungrounded claim (a hallucinated source) and fails closed — deterministically,
without an LLM judging whether the output "looks" grounded.
"""

from __future__ import annotations

from collections.abc import Sequence

from .checks import CheckResult


def grounding_check(label: str, cited: Sequence[str], allowed: Sequence[str]) -> CheckResult:
    allow = set(allowed)
    ungrounded = [c for c in cited if c not in allow]
    if ungrounded:
        quoted = ", ".join(f'"{u}"' for u in ungrounded)
        return CheckResult(
            ok=False,
            confidence=0.1,
            detail=f"ungrounded citation: {label} cites {quoted} not in the retrieved sources",
        )
    return CheckResult(
        ok=True,
        confidence=0.95,
        detail=f"grounding {label}: all {len(cited)} citation(s) in the retrieved set",
    )
