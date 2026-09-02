import type { LifelineKey, Severity } from "./types";
import { clamp, round } from "./engine";

export interface RestorationEstimate {
  lifeline: LifelineKey;
  currentSeverity: Severity;
  baselineRestorationHours: number;
  acceleratedRestorationHours: number;
  allocatedCrews: number;
  bottleneckFlag: boolean;
}

export class RestorationForecaster {
  private static BASELINE_HOURS: Record<LifelineKey, number> = {
    safety: 12,
    foodWater: 18,
    health: 24,
    energy: 36,
    communications: 20,
    transport: 30,
    shelter: 28,
  };

  private static SEVERITY_MULTIPLIERS: Record<Severity, number> = {
    stable: 0.2,
    guarded: 0.6,
    elevated: 1.0,
    severe: 1.6,
    critical: 2.5,
  };

  static forecastLifeline(
    lifeline: LifelineKey,
    severity: Severity,
    crewsAssigned = 0,
    cascadeDelayFactor = 1.0
  ): RestorationEstimate {
    const baseHours = this.BASELINE_HOURS[lifeline] * this.SEVERITY_MULTIPLIERS[severity];
    const rawHours = baseHours * cascadeDelayFactor;

    // Crew acceleration: each crew reduces remaining restoration time logarithmically (up to 60% max reduction)
    const accelerationMultiplier = crewsAssigned > 0 ? 1 / (1 + 0.3 * Math.log2(crewsAssigned + 1)) : 1.0;
    const acceleratedHours = round(clamp(rawHours * accelerationMultiplier, 1, 168), 1);

    const bottleneckFlag = severity === "critical" && crewsAssigned < 2;

    return {
      lifeline,
      currentSeverity: severity,
      baselineRestorationHours: round(rawHours, 1),
      acceleratedRestorationHours: acceleratedHours,
      allocatedCrews: crewsAssigned,
      bottleneckFlag,
    };
  }
}
