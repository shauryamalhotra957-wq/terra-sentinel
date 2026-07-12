import { describe, expect, it } from 'vitest'
import { defaultScenario, districts, resources } from './data'
import {
  allocateResources,
  assessCity,
  assessDistrict,
  equityScore,
  generateWarnings,
  projectLifelines,
  severityRank,
  simulateForecast,
  summarizeCoverage,
} from './engine'

describe('risk engine', () => {
  it('raises district risk when flood stress increases', () => {
    const district = districts.find((item) => item.id === 'south-flats')
    expect(district).toBeDefined()

    const calm = assessDistrict(district!, {
      rainfallMm: 10,
      riverLevelM: 1.5,
      windKph: 12,
      heatIndexC: 30,
      commsOutagePercent: 0,
      hospitalLoadPercent: 35,
      trafficBlockagePercent: 8,
      forecastHours: 6,
    })
    const surge = assessDistrict(district!, defaultScenario.controls)

    expect(surge.score).toBeGreaterThan(calm.score + 18)
    expect(severityRank[surge.severity]).toBeGreaterThanOrEqual(severityRank.elevated)
  })

  it('keeps projected lifelines inside valid percentage bounds', () => {
    const lifelines = projectLifelines(districts[0], {
      rainfallMm: 240,
      riverLevelM: 8,
      windKph: 180,
      heatIndexC: 50,
      commsOutagePercent: 100,
      hospitalLoadPercent: 100,
      trafficBlockagePercent: 100,
      forecastHours: 12,
    })

    expect(lifelines).toHaveLength(7)
    for (const lifeline of lifelines) {
      expect(lifeline.value).toBeGreaterThanOrEqual(0)
      expect(lifeline.value).toBeLessThanOrEqual(100)
    }
  })

  it('allocates no more units than the resource inventory', () => {
    const city = assessCity(defaultScenario.controls)
    const recommendations = allocateResources(city)
    const usedByResource = new Map<string, number>()

    for (const recommendation of recommendations) {
      usedByResource.set(
        recommendation.resourceId,
        (usedByResource.get(recommendation.resourceId) ?? 0) + recommendation.units,
      )
    }

    for (const resource of resources) {
      expect(usedByResource.get(resource.id) ?? 0).toBeLessThanOrEqual(resource.availableUnits)
    }
  })

  it('produces actionable coverage and an equity score', () => {
    const city = assessCity(defaultScenario.controls)
    const recommendations = allocateResources(city)
    const coverage = summarizeCoverage(recommendations)

    expect(recommendations.length).toBeGreaterThan(4)
    expect(coverage.peopleCovered).toBeGreaterThan(1_000)
    expect(coverage.medianEta).toBeGreaterThan(0)
    expect(equityScore(city, recommendations)).toBeGreaterThanOrEqual(50)
  })

  it('simulates a forecast for every requested hour', () => {
    const forecast = simulateForecast(defaultScenario.controls, 8)

    expect(forecast).toHaveLength(9)
    expect(forecast[0].hour).toBe(0)
    expect(forecast.at(-1)?.hour).toBe(8)
    expect(forecast.every((point) => point.averageRisk >= 0 && point.averageRisk <= 100)).toBe(true)
  })

  it('sanitizes warning copy and stamps checksums', () => {
    const city = assessCity(defaultScenario.controls)
    const warnings = generateWarnings(city.districts[0], defaultScenario.controls)

    expect(warnings).toHaveLength(4)
    for (const warning of warnings) {
      expect(warning.body).not.toMatch(/[<>]/)
      expect(warning.checksum).toMatch(/^[0-9A-F]{5}$/)
    }
  })
})
