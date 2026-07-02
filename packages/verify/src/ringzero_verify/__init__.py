"""Regent deterministic logical verifiers (Pillars P3/P4).

Phase 0: stub. Phase 3 implements three deterministic verifier classes, each
returning a correctness *guarantee* (not an LLM opinion), exposed to the kernel
via line-delimited JSON-RPC over stdio (decision D1):

  1. numeric / inequality checks with tolerances — recompute ratios; catch a
     double-counted EBITDA producing coverage 2.82 vs the correct 1.82;
  2. integrity-verified value register — exact figures by deterministic,
     access-verified lookup;
  3. relational / contradiction checks over governed representations
     (entailment / negation), structured, not embedding-similarity.

These feed Verified(s) / Confidence(s) as guard inputs. Any LLM / embedding judge
runs only as an ADVISORY signal, labelled in telemetry, and can never override a
failed deterministic check.
"""

PACKAGE: str = "ringzero-verify"
PHASE: int = 0
STANCE: str = "REAL"


def health() -> dict[str, str | int]:
    """Liveness probe used by the Phase 3 RPC bridge handshake."""
    return {"package": PACKAGE, "phase": PHASE, "stance": STANCE}
