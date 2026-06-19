/**
 * Mediation event stream. The gateway emits an authz/approval/containment record
 * for every decision. Phase 4 swaps the in-memory sink for OpenTelemetry; the
 * record shape stays stable so telemetry and replay can consume it.
 */

export type MediationEventKind =
  | "authz-permit"
  | "authz-deny"
  | "approval-event"
  | "approval-rejected"
  | "tool-executed";

export interface MediationEvent {
  readonly kind: MediationEventKind;
  readonly agentId: string;
  readonly actionId: string;
  readonly intent: string;
  readonly detail: string;
}

export interface EventSink {
  emit(event: MediationEvent): void;
}

export class InMemoryEventSink implements EventSink {
  private readonly events: MediationEvent[] = [];

  emit(event: MediationEvent): void {
    this.events.push(event);
  }

  all(): readonly MediationEvent[] {
    return this.events;
  }
}
