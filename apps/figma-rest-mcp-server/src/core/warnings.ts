import type {
  DegradationRecord,
  DiagnosticsFeature,
  FeatureDecision,
  StageName,
  SupportLevel,
} from "./contracts.js";

export class WarningCollector {
  private readonly values = new Set<string>();
  private readonly degradations: DegradationRecord[] = [];
  private readonly decisions: FeatureDecision[] = [];
  private readonly degradationKeys = new Set<string>();
  private readonly decisionKeys = new Set<string>();

  add(message: string): void {
    this.values.add(message);
  }

  remove(message: string): void {
    this.values.delete(message);
  }

  addDegradation(record: DegradationRecord): void {
    const key = [
      record.feature,
      record.stage,
      record.reason,
      record.affectsCorrectness,
      record.affectsFidelity,
    ].join("|");
    if (this.degradationKeys.has(key)) {
      this.values.add(record.reason);
      return;
    }

    this.degradationKeys.add(key);
    this.degradations.push(record);
    this.values.add(record.reason);
  }

  removeDegradations(
    predicate: (record: DegradationRecord) => boolean,
  ): void {
    const next = this.degradations.filter((record) => !predicate(record));
    this.degradations.length = 0;
    this.degradationKeys.clear();

    for (const record of next) {
      this.degradations.push(record);
      this.degradationKeys.add(
        [
          record.feature,
          record.stage,
          record.reason,
          record.affectsCorrectness,
          record.affectsFidelity,
        ].join("|"),
      );
    }
  }

  addDecision(
    feature: DiagnosticsFeature,
    requested: boolean,
    effective: boolean,
    supportLevel: SupportLevel,
    stage: StageName,
    reason: string,
  ): void {
    const key = [
      feature,
      requested,
      effective,
      supportLevel,
      stage,
      reason,
    ].join("|");
    if (this.decisionKeys.has(key)) {
      return;
    }

    this.decisionKeys.add(key);
    this.decisions.push({
      feature,
      requested,
      effective,
      supportLevel,
      stage,
      reason,
    });
  }

  removeDecisions(
    predicate: (decision: FeatureDecision) => boolean,
  ): void {
    const next = this.decisions.filter((decision) => !predicate(decision));
    this.decisions.length = 0;
    this.decisionKeys.clear();

    for (const decision of next) {
      this.decisions.push(decision);
      this.decisionKeys.add(
        [
          decision.feature,
          decision.requested,
          decision.effective,
          decision.supportLevel,
          decision.stage,
          decision.reason,
        ].join("|"),
      );
    }
  }

  list(): string[] {
    return [...this.values];
  }

  listDegradations(): DegradationRecord[] {
    return [...this.degradations];
  }

  listDecisions(): FeatureDecision[] {
    return [...this.decisions];
  }
}
