/**
 * Secrets broker (P7) — STUB INTERFACE. The point: credentials never enter the
 * model/agent context. The broker hands back an opaque handle the gateway can
 * use to authorise a tool, never the raw secret. A real implementation would
 * resolve handles against a vault at the trust boundary.
 */

export interface SecretHandle {
  readonly ref: string;
  readonly opaque: true;
}

export interface SecretsBroker {
  /** Returns an opaque handle; the raw secret is never exposed to the caller. */
  handleFor(ref: string): SecretHandle;
}

export const stubSecretsBroker: SecretsBroker = {
  handleFor(ref: string): SecretHandle {
    return { ref, opaque: true };
  },
};
