from ringzero_verify import PHASE, STANCE, health


def test_health_handshake() -> None:
    result = health()
    assert result["package"] == "ringzero-verify"
    assert result["stance"] == "REAL"


def test_phase0_stance() -> None:
    assert PHASE == 0
    assert STANCE == "REAL"
