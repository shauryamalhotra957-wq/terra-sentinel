import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { EvacuationRouteFlowAnalyzer } from '../src/utils/evacuation_corridor.js';

describe('EvacuationRouteFlowAnalyzer Test Suite', () => {
  const analyzer = new EvacuationRouteFlowAnalyzer({ baseLaneCapacityVehiclesPerHr: 1000 });

  test('calculates travel time and flags bottleneck when congested', () => {
    const route = {
      id: 'highway-north',
      lanes: 2,
      lengthKm: 30,
      speedLimitKmh: 60,
      currentVehicleVolume: 1900, // capacity = 2000 -> v/c = 0.95 (bottleneck)
      debrisClearanceFactor: 1.0,
    };
    const res = analyzer.evaluateSegment(route);
    assert.strictEqual(res.isBottleneck, true);
    assert.ok(res.estimatedTravelTimeMin >= 30.0);
  });

  test('prioritizes least congested route in ranking', () => {
    const routes = [
      { id: 'route-congested', lanes: 1, lengthKm: 20, speedLimitKmh: 60, currentVehicleVolume: 1200, debrisClearanceFactor: 1.0 },
      { id: 'route-clear', lanes: 3, lengthKm: 25, speedLimitKmh: 60, currentVehicleVolume: 500, debrisClearanceFactor: 1.0 },
    ];
    const ranked = analyzer.findOptimalEvacuationRoute(routes);
    assert.strictEqual(ranked[0].routeId, 'route-clear');
  });
});
