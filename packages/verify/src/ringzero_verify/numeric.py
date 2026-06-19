"""Numeric / inequality checks with tolerances.

This is the silent-error catcher: recompute a figure and compare it to the
claimed value. It is what catches a double-counted EBITDA producing an interest
-coverage ratio of 2.82 when the correct figure is 1.82.
"""

from __future__ import annotations

from .checks import CheckResult


def numeric_check(label: str, claimed: float, recomputed: float, tolerance: float) -> CheckResult:
    diff = abs(claimed - recomputed)
    if diff > tolerance:
        return CheckResult(
            ok=False,
            confidence=0.2,
            detail=(
                f"numeric mismatch: {label} claimed={claimed} recomputed={recomputed} "
                f"(Δ={diff} > tol={tolerance})"
            ),
        )
    scale = max(abs(recomputed), 1e-9)
    closeness = 1.0 - min(diff / scale, 1.0)
    return CheckResult(ok=True, confidence=closeness, detail=f"{label}: claimed≈recomputed within tol={tolerance}")


def inequality_check(label: str, value: float, lower: float, upper: float) -> CheckResult:
    if value < lower or value > upper:
        return CheckResult(
            ok=False,
            confidence=0.2,
            detail=f"inequality violated: {label} value={value} not in [{lower}, {upper}]",
        )
    return CheckResult(ok=True, confidence=0.9, detail=f"{label}: {value} within [{lower}, {upper}]")
