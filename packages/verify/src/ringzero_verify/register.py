"""Integrity-verified value register: exact figures by deterministic,
access-verified lookup. A value that is not in the register cannot be asserted —
absence is a failure, not a guess.
"""

from __future__ import annotations

from .checks import CheckResult


class IntegrityError(Exception):
    """Raised when a key has no access-verified value in the register."""


class ValueRegister:
    def __init__(self, values: dict[str, float]) -> None:
        self._values: dict[str, float] = dict(values)

    def lookup(self, key: str) -> float:
        if key not in self._values:
            raise IntegrityError(f"no access-verified value for key: {key}")
        return self._values[key]


def register_check(
    label: str,
    key: str,
    expected: float,
    tolerance: float,
    register: dict[str, float],
) -> CheckResult:
    reg = ValueRegister(register)
    try:
        actual = reg.lookup(key)
    except IntegrityError as exc:
        return CheckResult(ok=False, confidence=0.0, detail=str(exc))
    diff = abs(actual - expected)
    if diff > tolerance:
        return CheckResult(
            ok=False,
            confidence=0.2,
            detail=f"register mismatch: {label} key={key} expected={expected} actual={actual}",
        )
    return CheckResult(ok=True, confidence=0.95, detail=f"{label}: register[{key}]={actual} matches expected")
