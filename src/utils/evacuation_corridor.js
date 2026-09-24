/**
 * Disaster Evacuation Route Bandwidth & Bottleneck Flow Calculator.
 * Calculates vehicular throughput capacity (vehicles/hr) and estimated transit delays.
 */
export class EvacuationRouteFlowAnalyzer {
  constructor({ baseLaneCapacityVehiclesPerHr = 1800 } = {}) {
    this.baseLaneCapacity = baseLaneCapacityVehiclesPerHr;
  }

  evaluateSegment(segment) {
    const effectiveLanes = Math.max(0.5, segment.lanes * (segment.debrisClearanceFactor || 1.0));
    const maxCapacity = Math.round(effectiveLanes * this.baseLaneCapacity);
    const volume = segment.currentVehicleVolume || 0;
    const vToCRatio = volume / (maxCapacity || 1);

    // Bureau of Public Roads (BPR) congestion delay function
    const freeFlowTimeMin = (segment.lengthKm / (segment.speedLimitKmh || 60)) * 60;
    const delayMultiplier = 1.0 + (0.15 * Math.pow(vToCRatio, 4));
    const estimatedTravelTimeMin = Number((freeFlowTimeMin * delayMultiplier).toFixed(1));

    return {
      routeId: segment.id,
      maxCapacityVehiclesPerHr: maxCapacity,
      volumeToCapacityRatio: Number(vToCRatio.toFixed(2)),
      estimatedTravelTimeMin,
      isBottleneck: vToCRatio >= 0.85,
    };
  }

  findOptimalEvacuationRoute(routes) {
    const evaluated = routes.map(r => this.evaluateSegment(r));
    return evaluated.sort((a, b) => a.estimatedTravelTimeMin - b.estimatedTravelTimeMin);
  }
}
