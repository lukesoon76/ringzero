/**
 * Agent identity bound to a supervising user, with granted authority scopes
 * (P7). Default-deny: an unknown agent has no authority at all.
 */

export interface AgentIdentity {
  readonly agentId: string;
  readonly supervisingUser: string;
  readonly grantedScopes: readonly string[];
}

export class IdentityRegistry {
  private readonly byId = new Map<string, AgentIdentity>();

  register(identity: AgentIdentity): this {
    this.byId.set(identity.agentId, identity);
    return this;
  }

  lookup(agentId: string): AgentIdentity | undefined {
    return this.byId.get(agentId);
  }

  /** Default-deny scope check: every required scope must be granted. */
  hasScopes(agentId: string, required: readonly string[]): boolean {
    const identity = this.byId.get(agentId);
    if (!identity) return false;
    const granted = new Set(identity.grantedScopes);
    return required.every((s) => granted.has(s));
  }
}
