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

  it('neutralizes spreadsheet formulas in exported string cells', () => {
    const city = assessCity(defaultScenario.controls)
    const [firstDistrict] = city.districts
    const districtCsv = districtsToCsv([
      {
        ...firstDistrict,
        district: {
          ...firstDistrict.district,
          name: '=HYPERLINK("https://example.invalid")',
        },
        primaryDrivers: ['@IMPORTDATA("https://example.invalid")'],
      },
    ])
    const [firstAllocation] = allocateResources(city)
    const allocationCsv = allocationsToCsv([
      {
        ...firstAllocation,
        resourceLabel: '+SUM(A1:A2)',
        districtName: '-2+3',
        rationale: '\t=cmd|calc',
      },
    ])

    expect(districtCsv).toContain(`"'=HYPERLINK(""https://example.invalid"")"`)
    expect(districtCsv).toContain(`"'@IMPORTDATA(""https://example.invalid"")"`)
    expect(allocationCsv).toContain("'+SUM(A1:A2)")
    expect(allocationCsv).toContain("'-2+3")
    expect(allocationCsv).toContain("'\t=cmd|calc")
  })
})
