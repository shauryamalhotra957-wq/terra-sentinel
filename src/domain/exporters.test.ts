import { describe, expect, it } from 'vitest'
import { defaultScenario } from './data'
import { allocateResources, assessCity, createBriefingPacket, generateWarnings } from './engine'
import { allocationsToCsv, districtsToCsv, packetToJson } from './exporters'

describe('exporters', () => {
  it('exports districts and allocations as CSV', () => {
    const city = assessCity(defaultScenario.controls)
    const allocations = allocateResources(city)

    expect(districtsToCsv(city.districts)).toContain('district,score,severity')
    expect(allocationsToCsv(allocations)).toContain('resource,district,units')
  })

  it('serializes briefing packets with warnings', () => {
    const city = assessCity(defaultScenario.controls)
    const selected = city.districts[0]
    const allocations = allocateResources(city)
    const warnings = generateWarnings(selected, defaultScenario.controls)
    const packet = createBriefingPacket(defaultScenario.controls, city, selected, allocations, warnings)

    const parsed = JSON.parse(packetToJson(packet))

    expect(parsed.city.averageRisk).toBe(city.averageRisk)
    expect(parsed.selectedDistrict.id).toBe(selected.district.id)
    expect(parsed.warnings).toHaveLength(4)
  })
})
