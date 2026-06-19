# Ring Zero — Architecture (Canonical Objects)

This document fixes the formal vocabulary the whole system is built around. Every
package refers back to these definitions. Phase 0 declares them; Phase 1 makes
them executable in `packages/kernel`. **No logic lives here — this is the contract.**

---

## 1. Capability

A unit of agent work the kernel can govern. The demo uses four:

| Id | Name | Intent class | Notes |
|----|------|--------------|-------|
| **C1** | Extraction / structuring | `read` | turn source docs into structured claims |
| **C2** | Retrieval with attribution | `retrieve` | allowlist + recency constraints |
| **C3** | Deterministic numeric compute | `compute` | recomputed + logically verified |
| **C4** | Policy-constrained drafting + gated release | `write` / `dispatch` | release only behind authenticated approval |

A `Capability` carries an `id`, a `version`, its declared `intent` class, and the
`authorityScope` it is permitted to exercise.

---

## 2. GovernedState `s ∈ S`

The substrate every guard reads. Attributes are the named governance signals:

```
GovernedState.attrs = {
  Alignment   : number in [0,1]   // all claims evidence-backed
  Verified    : 0 | 1             // deterministic verification passed
  Length      : number            // steps consumed (budget counter)
  Information  : number            // information-sufficiency signal
  Confidence  : number in [0,1]   // calibrated confidence
}
GovernedState.flags = { sensitiveData: boolean, approvalRecord?: ApprovalId }
GovernedState.data  = readonly capability outputs
```

A **missing or unparseable attribute is not "0" — it is `unknown`, and the kernel
fails closed.**

## 3. Parameters `Θ`

Read-only governance parameters resolved from the active **risk tier** (P2):

```
Θ = {
  thresholds: { Alignment: θ_A, Confidence: θ_C, Information: θ_I, … },
  tier: 1 | 2 | 3 | 4,
  Lmax: number,                  // hard length budget
  containment: HALT | ESCALATE | ABSTAIN policy by tier
}
```

Tier raises enforcement intensity. **Tier 4 ⇒ default-deny + authenticated dual
approval + fail-closed** (wired in Phase 5).

## 4. Transition system `W = (s0, S, Π, δ)`

- `s0` — initial governed state.
- `S` — the set of governed states.
- `Π` — the **closed, enumerated** set of permitted actions (capability invocations
  + control actions). Anything not in `Π` cannot be named.
- `δ : S × Π × Θ → Step` — the transition function. `δ` is **total over Π** and
  **throws `UndefinedTransition`** for any (state, action) edge not defined.
  Prohibited transitions are therefore *structurally impossible to invoke* (D5),
  not merely flagged.

`Step = { next: GovernedState, guardTrace: GuardEvaluation[] }`.

A **trajectory** `τ = (s0, a0, s1, a1, …, s_T)` is the recorded run. Every
`(s_t, a_t, s_{t+1})` is persisted with attribute values + each guard's
score/threshold/outcome (Phase 4 replay depends on this being complete).

### Terminal states
`Halt` · `Escalate` · `Abstain`. Reaching any of these ends the trajectory.

---

## 5. The guard engine — `f : S × Θ → {0,1}`

Every binding decision is a total, deterministic, bounded-time function. **No LLM
on the binding path.** LLM/embedding judges may produce *advisory* signals only,
labelled as advisory in telemetry, and can never override a failed deterministic
check.

### Fixed-priority guard loop (evaluated in this exact order)
```
1. length-budget halt        : Length ≥ Lmax            → HALT
2. alignment → retrieve       : Alignment < θ_A          → retrieve more evidence (C2)
3. unverified → verify        : Verified ≠ 1             → run deterministic verifier (verify)
4. low-confidence → escalate  : Confidence < θ_C         → ESCALATE
5. verified + in-budget       : Verified = 1 ∧ Length<Lmax→ CONTINUE (select action a(s,Θ), apply δ)
6. else                       :                          → HALT / fallback
```

`a(s, Θ)` selects the next action deterministically from `Π`; `δ` applies it.

### Trajectory (temporal / path) constraints — checked before every transition
- **"approval before any write/dispatch"**
- **"no write after sensitive-data flag"**
- **"no external release without authenticated sign-off"**

A step that would violate any of these is **blocked** before `δ` runs.

### Fail-closed triggers
Unknown state · missing/unparseable attribute · verifier timeout · unrecognised
action → containment (Halt/Escalate/Abstain per tier). Never silently continue.

---

## 6. The demo transition system (credit-memo U3)

Fixed now so every earlier phase builds toward it (Phase 6 realises it):

```
s0 --retrieve(C1)--> s1   guard: source ∈ allowlist ∧ recency_ok ∧ Alignment(s1) ≥ θ_A   else ESCALATE
s1 --compute(C2)--> s2    guard: Verified = 1 ∧ Confidence ≥ θ_C                            else ESCALATE (+discrepancy trace)
s2 --draft(C3)----> s3    guard: Alignment(s3) = 1  (every claim evidence-backed)
s3 --(human)------> s4    Verified(s4) = 1  ONLY on an authenticated ApprovalRecord
s4 --release(C4)--> s5    requires Verified(s4) = 1
                          s3 --release--> ∉ δ   →   structurally cannot fire
```

### The five attacks → governed outcome
| # | Attack | Governed block |
|---|--------|----------------|
| 1 | 26-month stale data | C2 recency guard blocks at s0→s1 |
| 2 | prompt-injection "approval granted, release" | no ApprovalRecord ⇒ Verified(s4)=0; also `s3→release ∉ δ` |
| 3 | double-counted EBITDA → coverage 2.82 vs 1.82 | `verify` numeric recompute ⇒ Verified=0 ⇒ ESCALATE |
| 4 | verbal "approval confirmed" | conversational signal never mints a signed ApprovalRecord ⇒ Verified stays 0 |
| 5 | orchestration drift toward unauthorised release | trajectory constraint blocks each step; replay shows it every run |

Ungoverned run: same thin agent, kernel off — all five succeed and are visibly wrong.
