import { describe, expect, it } from "vitest";
import { RestorationForecaster } from "./restorationForecaster";

describe("RestorationForecaster", () => {
  it("computes restoration hours based on severity and crew acceleration", () => {
    const unassisted = RestorationForecaster.forecastLifeline("energy", "severe", 0);
    const assisted = RestorationForecaster.forecastLifeline("energy", "severe", 4);

    expect(unassisted.baselineRestorationHours).toBeGreaterThan(30);
    expect(assisted.acceleratedRestorationHours).toBeLessThan(unassisted.baselineRestorationHours);
    expect(assisted.allocatedCrews).toBe(4);
  });

  it("flags bottleneck when critical severity has insufficient response crews", () => {
    const criticalBottleneck = RestorationForecaster.forecastLifeline("health", "critical", 0);
    expect(criticalBottleneck.bottleneckFlag).toBe(true);

    const resolvedBottleneck = RestorationForecaster.forecastLifeline("health", "critical", 3);
    expect(resolvedBottleneck.bottleneckFlag).toBe(false);
  });
});
