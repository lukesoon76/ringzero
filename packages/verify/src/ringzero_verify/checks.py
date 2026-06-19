"""Shared result type for the deterministic verifiers."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CheckResult:
    """The outcome of one deterministic check — a guarantee, not an opinion."""

    ok: bool
    confidence: float
    detail: str
