from ringzero_verify.contradiction import contradiction_check
from ringzero_verify.numeric import inequality_check, numeric_check
from ringzero_verify.register import register_check
from ringzero_verify.rpc import handle
from ringzero_verify.verifier import verify


def test_numeric_catches_double_counted_ebitda() -> None:
    r = numeric_check("coverage", claimed=2.82, recomputed=1.82, tolerance=0.01)
    assert r.ok is False
    assert "mismatch" in r.detail


def test_numeric_accepts_correct_ratio() -> None:
    assert numeric_check("coverage", claimed=1.82, recomputed=1.82, tolerance=0.01).ok is True


def test_inequality_check() -> None:
    assert inequality_check("ratio", 1.82, 1.0, 5.0).ok is True
    assert inequality_check("ratio", 0.5, 1.0, 5.0).ok is False


def test_register_requires_access_verified_value() -> None:
    reg = {"ebitda": 100.0}
    assert register_check("ebitda", "ebitda", 100.0, 0.01, reg).ok is True
    # absent key cannot be asserted
    assert register_check("revenue", "revenue", 50.0, 0.01, reg).ok is False


def test_contradiction_detects_negation() -> None:
    facts = [{"subject": "borrower", "predicate": "covenant", "value": "breached", "polarity": "affirm"}]
    claim = {"subject": "borrower", "predicate": "covenant", "value": "breached", "polarity": "negate"}
    assert contradiction_check("covenant", claim, facts).ok is False


def test_verify_aggregates_and_passes() -> None:
    directive = {
        "checks": [
            {"kind": "numeric", "label": "coverage", "claimed": 1.82, "recomputed": 1.82, "tolerance": 0.01},
        ]
    }
    result = verify(directive)
    assert result["verified"] == 1


def test_llm_advisory_cannot_override_a_failed_numeric_check() -> None:
    directive = {
        "checks": [
            {"kind": "numeric", "label": "coverage", "claimed": 2.82, "recomputed": 1.82, "tolerance": 0.01},
        ],
        "advisory": {"llmVerdict": "looks fine to me", "score": 0.99},
    }
    result = verify(directive)
    assert result["verified"] == 0
    assert result["advisory"]["binding"] is False
    assert result["advisory"]["present"] is True


def test_rpc_handle_verify_and_health() -> None:
    assert handle({"id": 1, "method": "health"})["result"]["ok"] is True
    resp = handle(
        {
            "id": 2,
            "method": "verify",
            "params": {
                "directive": {
                    "checks": [
                        {"kind": "numeric", "label": "c", "claimed": 2.82, "recomputed": 1.82, "tolerance": 0.01}
                    ]
                }
            },
        }
    )
    assert resp["result"]["verified"] == 0
