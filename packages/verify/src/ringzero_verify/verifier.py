"""Top-level verifier: evaluate a directive of deterministic checks and return a
correctness guarantee. Any LLM / embedding judge in the directive is recorded as
an ADVISORY signal, explicitly labelled non-binding — it can NEVER override a
failed deterministic check.
"""

from __future__ import annotations

from typing import Any

from .checks import CheckResult
from .contradiction import contradiction_check
from .numeric import inequality_check, numeric_check
from .register import register_check


def _advisory(signal: Any) -> dict[str, Any]:
    if signal is None:
        return {"present": False, "binding": False}
    return {
        "present": True,
        "binding": False,
        "label": "ADVISORY (LLM/embedding) — non-binding signal",
        "signal": signal,
    }


def _run_check(check: dict[str, Any], register: dict[str, float]) -> CheckResult:
    kind = check.get("kind")
    label = str(check.get("label", kind))
    if kind == "numeric":
        return numeric_check(label, float(check["claimed"]), float(check["recomputed"]), float(check["tolerance"]))
    if kind == "inequality":
        return inequality_check(label, float(check["value"]), float(check["lower"]), float(check["upper"]))
    if kind == "register":
        return register_check(label, str(check["key"]), float(check["expected"]), float(check["tolerance"]), register)
    if kind == "contradiction":
        return contradiction_check(label, check["claim"], list(check["facts"]))
    if kind == "assert":
        ok = bool(check.get("ok", False))
        return CheckResult(ok=ok, confidence=0.9 if ok else 0.2, detail=f"assertion {label}: {ok}")
    return CheckResult(ok=False, confidence=0.0, detail=f"unknown check kind: {kind}")


def verify(directive: dict[str, Any]) -> dict[str, Any]:
    advisory = _advisory(directive.get("advisory"))
    if directive.get("simulateTimeout"):
        return {
            "verified": 0,
            "confidence": 0.0,
            "detail": "verifier timed out",
            "timedOut": True,
            "advisory": advisory,
        }

    checks: list[dict[str, Any]] = list(directive.get("checks", []))
    register: dict[str, float] = dict(directive.get("register", {}))
    if not checks:
        return {
            "verified": 0,
            "confidence": 0.0,
            "detail": "no checks declared",
            "timedOut": False,
            "advisory": advisory,
        }

    worst = 1.0
    for check in checks:
        result = _run_check(check, register)
        if not result.ok:
            # A deterministic failure is final — advisory signals cannot rescue it.
            return {
                "verified": 0,
                "confidence": result.confidence,
                "detail": result.detail,
                "timedOut": False,
                "advisory": advisory,
            }
        worst = min(worst, result.confidence)

    return {
        "verified": 1,
        "confidence": worst,
        "detail": f"all {len(checks)} check(s) passed",
        "timedOut": False,
        "advisory": advisory,
    }
