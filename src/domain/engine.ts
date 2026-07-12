import { districts, incidents, lifelineDefinitions, resources } from './data'
import type {
  AllocationRecommendation,
  BriefingPacket,
  CityAssessment,
  Coordinates,
  District,
  DistrictAssessment,
  ForecastPoint,
  LifelineKey,
  LifelineStatus,
  Resource,
  ResourceType,
  ScenarioControls,
  Severity,
  WarningMessage,
} from './types'

const resourceLabels: Record<ResourceType, string> = {
  rescueTeam: 'Rescue',
  medicalTeam: 'Medical',
  waterUnit: 'Water',
  powerCrew: 'Power',
  commsKit: 'Comms',
  busFleet: 'Transport',
  shelterTeam: 'Shelter',
}

const lifelineWeights: Record<LifelineKey, Partial<Record<ResourceType, number>>> = {
  safety: { rescueTeam: 0.9, busFleet: 0.35, commsKit: 0.15 },
  foodWater: { waterUnit: 0.95, busFleet: 0.25 },
  health: { medicalTeam: 0.95, powerCrew: 0.25, commsKit: 0.2 },
  energy: { powerCrew: 0.95, commsKit: 0.15 },
  communications: { commsKit: 0.95, powerCrew: 0.25 },
  transport: { busFleet: 0.85, rescueTeam: 0.25 },
  shelter: { shelterTeam: 0.9, busFleet: 0.45, waterUnit: 0.2 },
}

export const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value))

export const round = (value: number, precision = 0) => {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

export const severityForScore = (score: number): Severity => {
  if (score >= 82) return 'critical'
  if (score >= 68) return 'severe'
  if (score >= 52) return 'elevated'
  if (score >= 36) return 'guarded'
  return 'stable'
}

export const severityRank: Record<Severity, number> = {
  stable: 1,
  guarded: 2,
  elevated: 3,
  severe: 4,
  critical: 5,
}

export const distance = (a: Coordinates, b: Coordinates) =>
  Math.hypot(a.x - b.x, a.y - b.y)

const incidentsForDistrict = (districtId: string) =>
  incidents.filter((incident) => incident.districtId === districtId)

const incidentPressure = (districtId: string) =>
  clamp(
    incidentsForDistrict(districtId).reduce(
      (total, incident) =>
        total + incident.severity * incident.confidence * Math.log2(incident.reports + 2) * 4,
      0,
    ),
  )

const trendFromDelta = (delta: number) => {
  if (delta > 4) return 'up' as const
  if (delta < -4) return 'down' as const
  return 'flat' as const
}

export const projectLifelines = (
  district: District,
  controls: ScenarioControls,
): LifelineStatus[] => {
  const floodStress =
    (controls.rainfallMm / 240) * district.exposure.flood * 36 +
    (controls.riverLevelM / 8) * district.exposure.flood * 25
  const windStress = (controls.windKph / 180) * district.exposure.wind * 28
  const heatStress = clamp((controls.heatIndexC - 31) * district.exposure.heat * 2.7, 0, 36)
  const incidentLoss = incidentPressure(district.id) * 0.18
  const shelterGap = clamp(
    ((district.population * 0.11 - district.shelterBeds) / Math.max(district.population * 0.11, 1)) *
      24,
    0,
    24,
  )

  const projected: Record<LifelineKey, number> = {
    safety: district.lifelines.safety - floodStress * 0.18 - windStress * 0.24 - incidentLoss,
    foodWater:
      district.lifelines.foodWater -
      floodStress * 0.42 -
      controls.trafficBlockagePercent * 0.12 -
      heatStress * 0.12,
    health:
      district.lifelines.health -
      controls.hospitalLoadPercent * 0.27 -
      heatStress * 0.35 -
      incidentLoss * 0.45,
    energy:
      district.lifelines.energy -
      windStress * 0.45 -
      heatStress * 0.18 -
      Math.max(0, 20 - district.backupPowerHours) * 0.7,
    communications:
      district.lifelines.communications -
      controls.commsOutagePercent * (0.28 + (1 - district.commsReliability) * 0.55) -
      windStress * 0.12,
    transport:
      district.lifelines.transport -
      floodStress * 0.36 -
      controls.trafficBlockagePercent * 0.34 -
      windStress * 0.1,
    shelter:
      district.lifelines.shelter -
      shelterGap -
      floodStress * 0.12 -
      controls.trafficBlockagePercent * 0.08,
  }

  return lifelineDefinitions.map((definition) => {
    const value = round(clamp(projected[definition.key]), 1)
    return {
      key: definition.key,
      label: definition.label,
      value,
      trend: trendFromDelta(value - district.lifelines[definition.key]),
      criticalThreshold: definition.criticalThreshold,
    }
  })
}

const computeHazardStress = (district: District, controls: ScenarioControls) => {
  const flood =
    district.exposure.flood *
    (controls.rainfallMm * 0.23 + controls.riverLevelM * 5.6 + (100 - district.drainageScore) * 0.32)
  const wind = district.exposure.wind * controls.windKph * 0.34
  const heat = district.exposure.heat * Math.max(0, controls.heatIndexC - 30) * 3.3
  const landslide = district.exposure.landslide * controls.rainfallMm * 0.18

  return clamp(flood + wind + heat + landslide)
}

const computeVulnerability = (district: District) =>
  clamp(
    district.vulnerablePercent * 1.15 +
      district.density * 3.2 +
      Math.max(0, 14 - district.elevationM) * 1.4 +
      Math.max(0, 8 - district.clinics) * 2.4,
  )

const primaryDrivers = (
  district: District,
  lifelines: LifelineStatus[],
  controls: ScenarioControls,
): string[] => {
  const candidates = [
    {
      label: 'Flood exposure',
      value:
        district.exposure.flood * (controls.rainfallMm * 0.45 + controls.riverLevelM * 8) +
        Math.max(0, 60 - district.drainageScore),
    },
    {
      label: 'Medical surge',
      value:
        (100 - (lifelines.find((lifeline) => lifeline.key === 'health')?.value ?? 100)) * 1.3 +
        controls.hospitalLoadPercent * 0.25,
    },
    {
      label: 'Transport access',
      value:
        (100 - (lifelines.find((lifeline) => lifeline.key === 'transport')?.value ?? 100)) * 1.2 +
        controls.trafficBlockagePercent * 0.25,
    },
    {
      label: 'Power and comms',
      value:
        (100 - (lifelines.find((lifeline) => lifeline.key === 'communications')?.value ?? 100)) +
        (100 - (lifelines.find((lifeline) => lifeline.key === 'energy')?.value ?? 100)) * 0.8,
    },
    {
      label: 'Vulnerable population',
      value: district.vulnerablePercent * 1.8 + district.density * 3,
    },
  ]

  return candidates
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((candidate) => candidate.label)
}

const deriveNeeds = (
  assessment: Omit<DistrictAssessment, 'needs' | 'expectedShelterDemand'>,
): Partial<Record<ResourceType, number>> => {
  const needs: Partial<Record<ResourceType, number>> = {}

  for (const lifeline of assessment.lifelines) {
    const deficit = clamp(lifeline.criticalThreshold + 18 - lifeline.value, 0, 48)
    if (deficit <= 0) continue

    const weightedNeeds = lifelineWeights[lifeline.key]
    for (const [resourceType, weight] of Object.entries(weightedNeeds) as [
      ResourceType,
      number,
    ][]) {
      needs[resourceType] = clamp(
        (needs[resourceType] ?? 0) + deficit * weight + assessment.score * 0.08,
      )
    }
  }

  if (assessment.hazardStress > 68) {
    needs.rescueTeam = clamp((needs.rescueTeam ?? 0) + assessment.hazardStress * 0.28)
  }

  if (assessment.vulnerability > 70) {
    needs.shelterTeam = clamp((needs.shelterTeam ?? 0) + assessment.vulnerability * 0.24)
    needs.medicalTeam = clamp((needs.medicalTeam ?? 0) + assessment.vulnerability * 0.18)
  }

  return needs
}

export const assessDistrict = (
  district: District,
  controls: ScenarioControls,
): DistrictAssessment => {
  const lifelines = projectLifelines(district, controls)
  const lifelineLoss =
    lifelines.reduce((total, lifeline) => total + (100 - lifeline.value), 0) / lifelines.length
  const hazardStress = computeHazardStress(district, controls)
  const vulnerability = computeVulnerability(district)
  const pressure = incidentPressure(district.id)
  const score = round(
    clamp(hazardStress * 0.36 + vulnerability * 0.2 + lifelineLoss * 0.3 + pressure * 0.14),
    1,
  )

  const partial = {
    district,
    score,
    severity: severityForScore(score),
    hazardStress: round(hazardStress, 1),
    vulnerability: round(vulnerability, 1),
    incidentPressure: round(pressure, 1),
    lifelines,
    primaryDrivers: primaryDrivers(district, lifelines, controls),
  }

  const expectedShelterDemand = Math.round(
    district.population *
      clamp((score - 35) / 100, 0.02, 0.38) *
      (0.42 + district.vulnerablePercent / 170),
  )

  return {
    ...partial,
    needs: deriveNeeds(partial),
    expectedShelterDemand,
  }
}

export const assessCity = (controls: ScenarioControls): CityAssessment => {
  const districtAssessments = districts
    .map((district) => assessDistrict(district, controls))
    .sort((a, b) => b.score - a.score)

  const averageRisk = round(
    districtAssessments.reduce((total, assessment) => total + assessment.score, 0) /
      districtAssessments.length,
    1,
  )
  const criticalCount = districtAssessments.filter(
    (assessment) => severityRank[assessment.severity] >= severityRank.severe,
  ).length
  const exposedPopulation = districtAssessments.reduce(
    (total, assessment) =>
      total + (assessment.score >= 52 ? Math.round(assessment.district.population * 0.72) : 0),
    0,
  )
  const estimatedShelterDemand = districtAssessments.reduce(
    (total, assessment) => total + assessment.expectedShelterDemand,
    0,
  )

  const lifelineAverages = lifelineDefinitions.map((definition) => {
    const value = round(
      districtAssessments.reduce((total, assessment) => {
        const status = assessment.lifelines.find((lifeline) => lifeline.key === definition.key)
        return total + (status?.value ?? 0)
      }, 0) / districtAssessments.length,
      1,
    )

    return {
      key: definition.key,
      label: definition.label,
      value,
      trend: value < definition.criticalThreshold ? 'down' : 'flat',
      criticalThreshold: definition.criticalThreshold,
    } satisfies LifelineStatus
  })

  const driverCounts = new Map<string, number>()
  for (const assessment of districtAssessments) {
    for (const driver of assessment.primaryDrivers) {
      driverCounts.set(driver, (driverCounts.get(driver) ?? 0) + 1)
    }
  }

  return {
    districts: districtAssessments,
    averageRisk,
    criticalCount,
    exposedPopulation,
    estimatedShelterDemand,
    lifelineAverages,
    topDrivers: [...driverCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([driver]) => driver),
  }
}

const unitsForNeed = (need: number, resource: Resource, district: District) => {
  const demandUnits = Math.ceil((district.population * (need / 100) * 0.018) / resource.unitCapacity)
  return clamp(Math.max(1, demandUnits), 1, Math.max(1, resource.availableUnits))
}

export const allocateResources = (
  assessment: CityAssessment,
  availableResources: Resource[] = resources,
): AllocationRecommendation[] => {
  const remaining = new Map(availableResources.map((resource) => [resource.id, resource.availableUnits]))
  const candidates = assessment.districts.flatMap((districtAssessment) =>
    Object.entries(districtAssessment.needs).flatMap(([resourceType, need]) => {
      if (!need || need < 16) return []
      const resource = availableResources.find((item) => item.type === resourceType)
      if (!resource) return []
      const travel = distance(resource.staging, districtAssessment.district.coordinates)
      const equityBoost = 1 + districtAssessment.district.vulnerablePercent / 180
      const impactScore = round(
        clamp(
          need * 0.54 +
            districtAssessment.score * 0.36 +
            districtAssessment.incidentPressure * 0.18 -
            travel * 0.14,
          0,
          100,
        ) * equityBoost,
        1,
      )

      return [
        {
          resource,
          districtAssessment,
          need,
          impactScore,
          travel,
        },
      ]
    }),
  )

  const recommendations: AllocationRecommendation[] = []

  for (const candidate of candidates.sort((a, b) => b.impactScore - a.impactScore)) {
    const remainingUnits = remaining.get(candidate.resource.id) ?? 0
    if (remainingUnits <= 0) continue

    const units = Math.min(
      remainingUnits,
      unitsForNeed(candidate.need, candidate.resource, candidate.districtAssessment.district),
    )
    remaining.set(candidate.resource.id, remainingUnits - units)

    const etaMinutes = Math.round(
      candidate.resource.readinessMinutes + candidate.travel * 1.45 + units * 2.5,
    )
    const peopleCovered = Math.round(
      units *
        candidate.resource.unitCapacity *
        (0.62 + candidate.districtAssessment.district.vulnerablePercent / 220),
    )

    recommendations.push({
      id: `${candidate.resource.id}-${candidate.districtAssessment.district.id}`,
      resourceId: candidate.resource.id,
      resourceType: candidate.resource.type,
      resourceLabel: candidate.resource.label,
      districtId: candidate.districtAssessment.district.id,
      districtName: candidate.districtAssessment.district.name,
      units,
      etaMinutes,
      impactScore: candidate.impactScore,
      peopleCovered,
      rationale: `${resourceLabels[candidate.resource.type]} closes a ${round(candidate.need, 0)} priority gap driven by ${candidate.districtAssessment.primaryDrivers.join(', ')}.`,
    })
  }

  return recommendations.slice(0, 12)
}

export const simulateForecast = (
  controls: ScenarioControls,
  horizon = controls.forecastHours,
): ForecastPoint[] => {
  return Array.from({ length: horizon + 1 }, (_, hour) => {
    const pulse = Math.sin((hour / Math.max(horizon, 1)) * Math.PI)
    const futureControls: ScenarioControls = {
      ...controls,
      rainfallMm: clamp(controls.rainfallMm + pulse * 36 - hour * 2.2, 0, 260),
      riverLevelM: round(clamp(controls.riverLevelM + pulse * 0.9 - hour * 0.04, 0, 8.4), 1),
      windKph: clamp(controls.windKph + pulse * 18 - hour * 1.8, 0, 190),
      heatIndexC: round(clamp(controls.heatIndexC + (controls.rainfallMm < 40 ? hour * 0.18 : 0), 20, 50), 1),
      trafficBlockagePercent: clamp(controls.trafficBlockagePercent + pulse * 8 - hour * 0.7),
    }
    const city = assessCity(futureControls)
    return {
      hour,
      averageRisk: city.averageRisk,
      criticalDistricts: city.criticalCount,
      shelterDemand: city.estimatedShelterDemand,
    }
  })
}

const checksum = (text: string) => {
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 999_983
  }
  return hash.toString(16).padStart(5, '0').slice(0, 5).toUpperCase()
}

const stripControlCharacters = (text: string) =>
  [...text]
    .map((character) => {
      const code = character.charCodeAt(0)
      if (character === '<' || character === '>' || code < 32 || code === 127) return ' '
      return character
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()

export const generateWarnings = (
  districtAssessment: DistrictAssessment,
  controls: ScenarioControls,
): WarningMessage[] => {
  const district = stripControlCharacters(districtAssessment.district.name)
  const topDriver = districtAssessment.primaryDrivers[0]?.toLowerCase() ?? 'local risk'
  const shelterCount = districtAssessment.expectedShelterDemand.toLocaleString('en-US')
  const eta = controls.forecastHours <= 6 ? 'now' : `within ${controls.forecastHours} hours`
  const priority = districtAssessment.severity

  const messages: Omit<WarningMessage, 'checksum'>[] = [
    {
      channel: 'sms',
      audience: `${district} households`,
      language: 'English',
      priority,
      body: `${district}: ${priority.toUpperCase()} risk from ${topDriver}. Move medicines, IDs, and chargers above floor level. Follow ward volunteers ${eta}. Shelter demand estimate: ${shelterCount}.`,
    },
    {
      channel: 'whatsapp',
      audience: `${district} ward captains`,
      language: 'Hindi Roman',
      priority,
      body: `${district}: ${priority.toUpperCase()} jokhim. Paani, dawa, ID aur phone charge ready rakhein. Buzurg aur bachchon ko pehle safe point par le jayen. Shelter estimate ${shelterCount}.`,
    },
    {
      channel: 'public-address',
      audience: `${district} public broadcast`,
      language: 'Tamil Roman',
      priority,
      body: `${district}: ${priority.toUpperCase()} alert. Marundhu, ID, phone charge eduthukkonga. Low area irundhaal volunteer route follow pannunga. Shelter estimate ${shelterCount}.`,
    },
    {
      channel: 'radio',
      audience: 'regional emergency desk',
      language: 'English',
      priority,
      body: `${district} is ${priority}. Main drivers: ${districtAssessment.primaryDrivers.join(', ')}. Prioritize lifeline stabilization and report unmet medical or shelter needs every 30 minutes.`,
    },
  ]

  return messages.map((message) => ({
    ...message,
    body: stripControlCharacters(message.body),
    checksum: checksum(message.body),
  }))
}

export const createBriefingPacket = (
  controls: ScenarioControls,
  city: CityAssessment,
  selected: DistrictAssessment,
  allocations: AllocationRecommendation[],
  warnings: WarningMessage[],
): BriefingPacket => ({
  generatedAt: new Date().toISOString(),
  scenario: controls,
  city: {
    averageRisk: city.averageRisk,
    criticalCount: city.criticalCount,
    exposedPopulation: city.exposedPopulation,
    estimatedShelterDemand: city.estimatedShelterDemand,
  },
  selectedDistrict: {
    id: selected.district.id,
    name: selected.district.name,
    score: selected.score,
    severity: selected.severity,
    drivers: selected.primaryDrivers,
  },
  allocations,
  warnings,
})

export const summarizeCoverage = (recommendations: AllocationRecommendation[]) => ({
  peopleCovered: recommendations.reduce(
    (total, recommendation) => total + recommendation.peopleCovered,
    0,
  ),
  responseUnits: recommendations.reduce((total, recommendation) => total + recommendation.units, 0),
  medianEta: recommendations.length
    ? recommendations
        .map((recommendation) => recommendation.etaMinutes)
        .sort((a, b) => a - b)[Math.floor(recommendations.length / 2)]
    : 0,
})

export const equityScore = (
  city: CityAssessment,
  recommendations: AllocationRecommendation[],
): number => {
  const highVulnerabilityDistricts = city.districts
    .filter((assessment) => assessment.district.vulnerablePercent >= 30)
    .map((assessment) => assessment.district.id)
  if (highVulnerabilityDistricts.length === 0) return 100

  const covered = new Set(
    recommendations
      .filter((recommendation) => highVulnerabilityDistricts.includes(recommendation.districtId))
      .map((recommendation) => recommendation.districtId),
  )

  return round((covered.size / highVulnerabilityDistricts.length) * 100, 0)
}

export const riskColor = (score: number) => {
  if (score >= 82) return '#ad1f3b'
  if (score >= 68) return '#d75b25'
  if (score >= 52) return '#d39a16'
  if (score >= 36) return '#789a36'
  return '#2d8b73'
}
