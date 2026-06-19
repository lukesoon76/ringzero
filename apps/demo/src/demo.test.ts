import { Gateway, IdentityRegistry } from "@ring-zero/mediation";
import { buildCreditMemoPolicy, thetaForTier } from "@ring-zero/policy";
import { describe, expect, it } from "vitest";
import { runGovernedAttack } from "./governed.js";
import { ATTACKS, DEMO_AGENT_ID, DEMO_AGENT_SCOPES } from "./scenario.js";
import { runUngovernedAttack } from "./ungoverned.js";

const W = buildCreditMemoPolicy();
const theta = thetaForTier(4);
const identities = new IdentityRegistry().register({
  agentId: DEMO_AGENT_ID,
  supervisingUser: "risk-officer@bank",
  grantedScopes: DEMO_AGENT_SCOPES,
});
const gateway = new Gateway(W, { identities });

describe("ACCEPTANCE — the whole-prototype side-by-side", () => {
  for (const attack of ATTACKS) {
    it(`#${attack.n} ${attack.id}: ungoverned fails, governed blocks/contains`, () => {
      expect(runUngovernedAttack(attack.id).failureLanded).toBe(true);
      expect(runGovernedAttack(attack.id, W, theta, gateway).blocked).toBe(true);
    });
  }
});
