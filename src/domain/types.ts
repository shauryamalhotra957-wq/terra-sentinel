export type LifelineKey =
  | 'safety'
  | 'foodWater'
  | 'health'
  | 'energy'
  | 'communications'
  | 'transport'
  | 'shelter'

export type HazardKey = 'flood' | 'wind' | 'heat' | 'landslide'

export type Severity = 'stable' | 'guarded' | 'elevated' | 'severe' | 'critical'

export type Trend = 'up' | 'flat' | 'down'

export type ResourceType =
  | 'rescueTeam'
  | 'medicalTeam'
  | 'waterUnit'
  | 'powerCrew'
  | 'commsKit'
  | 'busFleet'
  | 'shelterTeam'

export interface LifelineDefinition {
  key: LifelineKey
  label: string
  shortLabel: string
  criticalThreshold: number
}

export interface Coordinates {
  x: number
  y: number
}

export interface District {
  id: string
  name: string
  role: string
  population: number
  vulnerablePercent: number
  density: number
  elevationM: number
  drainageScore: number
  shelterBeds: number
  clinics: number
  backupPowerHours: number
  commsReliability: number
  coordinates: Coordinates
  polygon: string
  lifelines: Record<LifelineKey, number>
  exposure: Record<HazardKey, number>
}

export interface Incident {
  id: string
  districtId: string
  title: string
  category: LifelineKey | HazardKey
  severity: 1 | 2 | 3 | 4 | 5
  confidence: number
  reports: number
  minutesAgo: number
  channel: 'sensor' | 'field-team' | 'citizen' | 'hospital' | 'utility'
  summary: string
}

export interface ScenarioControls {
  rainfallMm: number
  riverLevelM: number
  windKph: number
  heatIndexC: number
  commsOutagePercent: number
  hospitalLoadPercent: number
  trafficBlockagePercent: number
  forecastHours: number
}

export interface ScenarioPreset {
  id: string
  name: string
  summary: string
  controls: ScenarioControls
}

export interface Resource {
  id: string
  type: ResourceType
  label: string
  availableUnits: number
  unitCapacity: number
  staging: Coordinates
  readinessMinutes: number
}

export interface LifelineStatus {
  key: LifelineKey
  label: string
  value: number
  trend: Trend
  criticalThreshold: number
}

export interface DistrictAssessment {
  district: District
  score: number
  severity: Severity
  hazardStress: number
  vulnerability: number
  incidentPressure: number
  lifelines: LifelineStatus[]
  primaryDrivers: string[]
  needs: Partial<Record<ResourceType, number>>
  expectedShelterDemand: number
}

export interface CityAssessment {
  districts: DistrictAssessment[]
  averageRisk: number
  criticalCount: number
  exposedPopulation: number
  estimatedShelterDemand: number
  lifelineAverages: LifelineStatus[]
  topDrivers: string[]
}

export interface AllocationRecommendation {
  id: string
  resourceId: string
  resourceType: ResourceType
  resourceLabel: string
  districtId: string
  districtName: string
  units: number
  etaMinutes: number
  impactScore: number
  peopleCovered: number
  rationale: string
}

export interface ForecastPoint {
  hour: number
  averageRisk: number
  criticalDistricts: number
  shelterDemand: number
}

export interface WarningMessage {
  channel: 'sms' | 'whatsapp' | 'public-address' | 'radio'
  audience: string
  language: 'English' | 'Hindi Roman' | 'Tamil Roman'
  body: string
  priority: Severity
  checksum: string
}

export interface BriefingPacket {
  generatedAt: string
  scenario: ScenarioControls
  city: Pick<
    CityAssessment,
    'averageRisk' | 'criticalCount' | 'exposedPopulation' | 'estimatedShelterDemand'
  >
  selectedDistrict: {
    id: string
    name: string
    score: number
    severity: Severity
    drivers: string[]
  }
  allocations: AllocationRecommendation[]
  warnings: WarningMessage[]
}
