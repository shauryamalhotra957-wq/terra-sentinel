import { describe, expect, it, vi } from 'vitest'
import { defaultScenario } from './data'
import { allocateResources, assessCity, createBriefingPacket, generateWarnings } from './engine'
import { allocationsToCsv, districtsToCsv, downloadText, packetToJson } from './exporters'

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

  it('defers export URL cleanup until after the anchor click', async () => {
    const objectUrl = 'blob:test-briefing'
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue(objectUrl)
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    downloadText('briefing.json', '{}', 'application/json')

    expect(createObjectUrl).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectUrl).not.toHaveBeenCalled()

    await new Promise((resolve) => window.setTimeout(resolve, 0))

    expect(revokeObjectUrl).toHaveBeenCalledWith(objectUrl)

    createObjectUrl.mockRestore()
    revokeObjectUrl.mockRestore()
    click.mockRestore()
  })
})
