import type { AllocationRecommendation, BriefingPacket, DistrictAssessment } from './types'

const csvEscape = (value: string | number) => {
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export const districtsToCsv = (districts: DistrictAssessment[]) => {
  const header = [
    'district',
    'score',
    'severity',
    'hazard_stress',
    'vulnerability',
    'incident_pressure',
    'shelter_demand',
    'primary_drivers',
  ]

  const rows = districts.map((assessment) => [
    assessment.district.name,
    assessment.score,
    assessment.severity,
    assessment.hazardStress,
    assessment.vulnerability,
    assessment.incidentPressure,
    assessment.expectedShelterDemand,
    assessment.primaryDrivers.join('; '),
  ])

  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')
}

export const allocationsToCsv = (recommendations: AllocationRecommendation[]) => {
  const header = [
    'resource',
    'district',
    'units',
    'eta_minutes',
    'impact_score',
    'people_covered',
    'rationale',
  ]

  const rows = recommendations.map((recommendation) => [
    recommendation.resourceLabel,
    recommendation.districtName,
    recommendation.units,
    recommendation.etaMinutes,
    recommendation.impactScore,
    recommendation.peopleCovered,
    recommendation.rationale,
  ])

  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')
}

export const packetToJson = (packet: BriefingPacket) => JSON.stringify(packet, null, 2)

export const downloadText = (filename: string, contents: string, mimeType: string) => {
  const blob = new Blob([contents], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
